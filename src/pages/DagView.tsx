import type { Connection, Edge, Node } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatPanel, { type ChatMessage } from '../components/ChatPanel'
import CreateIssueModal, {
  type CreateIssueData,
} from '../components/CreateIssueModal'
import DagCanvas from '../components/DagCanvas'
import FloatingActionButton from '../components/FloatingActionButton'
import { applyDagLayout } from '../transformers/dagLayout'
import {
  type BdDependency,
  dependenciesToEdges,
} from '../transformers/dependencyToEdge'
import { type BdIssue, issuesToNodes } from '../transformers/issueToNode'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface GraphApiResponse {
  Root: BdIssue
  Issues: BdIssue[]
  Dependencies: BdDependency[] | null
  IssueMap: Record<string, BdIssue>
}

async function createIssue(data: CreateIssueData): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to create issue')
  }
}

async function createDependency(
  blocked: string,
  blocker: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/dependencies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ blocked, blocker }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to create dependency')
  }
}

async function fetchGraph(
  owner?: string,
  repo?: string
): Promise<{
  nodes: Node[]
  edges: Edge[]
}> {
  const url = new URL(`${API_BASE_URL}/api/graph`)
  if (owner && repo) {
    url.searchParams.set('owner', owner)
    url.searchParams.set('repo', repo)
  }
  // Only include credentials when fetching from GitHub (requires auth)
  const fetchOptions: RequestInit =
    owner && repo ? { credentials: 'include' } : {}
  const response = await fetch(url.toString(), fetchOptions)
  if (!response.ok) {
    throw new Error('Failed to fetch graph')
  }
  const graphs: GraphApiResponse[] = await response.json()

  // Collect all unique issues and dependencies from all graph entries
  const issueMap = new Map<string, BdIssue>()
  const allDependencies: BdDependency[] = []

  for (const graph of graphs) {
    for (const issue of graph.Issues) {
      issueMap.set(issue.id, issue)
    }
    if (graph.Dependencies) {
      allDependencies.push(...graph.Dependencies)
    }
  }

  const issues = Array.from(issueMap.values())
  const nodes = issuesToNodes(issues)
  const edges = dependenciesToEdges(allDependencies)

  // Apply DAG layout for proper hierarchical positioning
  const layoutedNodes = applyDagLayout(nodes, edges)

  return { nodes: layoutedNodes, edges }
}

function DagView() {
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Fetch graph data on mount and provide refresh function
  const refreshGraph = useCallback(async () => {
    try {
      const { nodes: newNodes, edges: newEdges } = await fetchGraph(owner, repo)
      setNodes(newNodes)
      setEdges(newEdges)
    } catch (error) {
      console.error('Failed to fetch graph:', error)
    }
  }, [owner, repo])

  useEffect(() => {
    refreshGraph()
  }, [refreshGraph])

  const handleCreateIssue = async (data: CreateIssueData) => {
    await createIssue(data)
    // Refresh the graph after creating an issue
    await refreshGraph()
  }

  const handleConnect = useCallback(
    (connection: Connection) => {
      // In React Flow: source is where you drag FROM, target is where you drag TO
      // In our DAG: source handle (bottom) = blocker, target handle (top) = blocked
      // So: source node blocks target node
      if (connection.source && connection.target) {
        createDependency(connection.target, connection.source)
          .then(() => refreshGraph())
          .catch(error => {
            console.error('Failed to create dependency:', error)
          })
      }
    },
    [refreshGraph]
  )

  const handleSendMessage = useCallback(
    async (message: string) => {
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
      }
      setChatMessages(prev => [...prev, userMessage])
      setIsChatLoading(true)

      try {
        // Build messages array for API (exclude IDs, include history)
        const apiMessages = [...chatMessages, userMessage].map(m => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: apiMessages }),
        })

        if (!response.ok) {
          throw new Error('Failed to send message')
        }

        // Handle SSE stream
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let assistantContent = ''
        const assistantMessageId = `assistant-${Date.now()}`

        // Add empty assistant message that we'll update
        setChatMessages(prev => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: '' },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                continue
              }

              try {
                const parsed = JSON.parse(data)

                if (parsed.text) {
                  assistantContent += parsed.text
                  // Update the assistant message with accumulated content
                  setChatMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  )
                }

                if (parsed.graphUpdated) {
                  // Graph was modified by tool calls, refresh it
                  await refreshGraph()
                }
              } catch {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error)
        // Add error message
        setChatMessages(prev => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, there was an error processing your message.',
          },
        ])
      } finally {
        setIsChatLoading(false)
      }
    },
    [chatMessages, refreshGraph]
  )

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: 'calc(100vh - 100px)',
      }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <DagCanvas nodes={nodes} edges={edges} onConnect={handleConnect} />
        <FloatingActionButton onClick={() => setIsModalOpen(true)} />
        <CreateIssueModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateIssue}
        />
      </div>
      <div style={{ width: '350px', flexShrink: 0 }}>
        <ChatPanel
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
        />
      </div>
    </div>
  )
}

export default DagView
