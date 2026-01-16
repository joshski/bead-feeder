import type { Connection, Edge, Node } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import CreateIssueModal, {
  type ChatMessage,
} from '../components/CreateIssueModal'
import DagCanvas from '../components/DagCanvas'
import FloatingActionButton from '../components/FloatingActionButton'
import IssueDetailModal from '../components/IssueDetailModal'
import type { IssueNodeData } from '../components/IssueNode'
import { applyDagLayout } from '../transformers/dagLayout'
import {
  type BdDependency,
  dependenciesToEdges,
} from '../transformers/dependencyToEdge'
import { type BdIssue, issuesToNodes } from '../transformers/issueToNode'
import { dagError, dagLog, logGraphSummary } from '../utils/dagLogger'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface GraphApiResponse {
  Root: BdIssue
  Issues: BdIssue[]
  Dependencies: BdDependency[] | null
  IssueMap: Record<string, BdIssue>
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
  repo?: string,
  localPath?: string
): Promise<{
  nodes: Node[]
  edges: Edge[]
}> {
  const url = new URL(`${API_BASE_URL}/api/graph`)
  if (owner && repo) {
    url.searchParams.set('owner', owner)
    url.searchParams.set('repo', repo)
  } else if (localPath) {
    url.searchParams.set('local', localPath)
  }

  dagLog(`Fetching graph from ${url.toString()}`)

  // Only include credentials when fetching from GitHub (requires auth)
  const fetchOptions: RequestInit =
    owner && repo ? { credentials: 'include' } : {}
  const response = await fetch(url.toString(), fetchOptions)
  if (!response.ok) {
    dagError(`Failed to fetch graph: ${response.status} ${response.statusText}`)
    throw new Error('Failed to fetch graph')
  }
  const graphs: GraphApiResponse[] = await response.json()

  dagLog(`Received ${graphs.length} graph entries from API`)

  // Collect all unique issues and dependencies from all graph entries
  const issueMap = new Map<string, BdIssue>()
  const allDependencies: BdDependency[] = []

  for (const graph of graphs) {
    dagLog(`Processing graph entry with root: ${graph.Root?.id ?? 'none'}`, {
      issueCount: graph.Issues?.length ?? 0,
      dependencyCount: graph.Dependencies?.length ?? 0,
    })
    for (const issue of graph.Issues) {
      issueMap.set(issue.id, issue)
    }
    if (graph.Dependencies) {
      allDependencies.push(...graph.Dependencies)
    }
  }

  const issues = Array.from(issueMap.values())
  dagLog(
    `Collected ${issues.length} unique issues, ${allDependencies.length} dependencies`
  )

  const nodes = issuesToNodes(issues)
  const edges = dependenciesToEdges(allDependencies)

  logGraphSummary(
    issues.length,
    allDependencies.length,
    nodes.length,
    edges.length
  )

  // Apply DAG layout for proper hierarchical positioning
  const layoutedNodes = applyDagLayout(nodes, edges)

  dagLog('Graph fetch complete', {
    nodeCount: layoutedNodes.length,
    edgeCount: edges.length,
  })

  return { nodes: layoutedNodes, edges }
}

function DagView() {
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>()
  const [searchParams] = useSearchParams()
  const localPath = searchParams.get('path') ?? undefined
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<IssueNodeData | null>(null)

  const handleIssueSelect = useCallback((issueData: IssueNodeData) => {
    setSelectedIssue(issueData)
  }, [])

  // Fetch graph data on mount and provide refresh function
  const refreshGraph = useCallback(async () => {
    dagLog('Refreshing graph data')
    try {
      const { nodes: newNodes, edges: newEdges } = await fetchGraph(
        owner,
        repo,
        localPath
      )
      // Inject onSelect callback into each node's data
      const nodesWithCallback = newNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onSelect: handleIssueSelect,
        },
      }))
      dagLog(
        `Setting state: ${nodesWithCallback.length} nodes, ${newEdges.length} edges`
      )
      setNodes(nodesWithCallback)
      setEdges(newEdges)
    } catch (error) {
      dagError('Failed to fetch graph', error)
    }
  }, [owner, repo, localPath, handleIssueSelect])

  useEffect(() => {
    refreshGraph()
  }, [refreshGraph])

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
      console.log('[CHAT] handleSendMessage called with:', message)
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

        console.log('[CHAT] Sending request to:', `${API_BASE_URL}/api/chat`)
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: apiMessages, owner, repo }),
          credentials: owner && repo ? 'include' : 'omit',
        })
        console.log('[CHAT] Response status:', response.status)

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

        console.log('[CHAT] Starting SSE stream processing')

        // Add empty assistant message that we'll update
        setChatMessages(prev => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: '' },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log(
              '[CHAT] Stream done, final content length:',
              assistantContent.length
            )
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                console.log('[CHAT] Received [DONE] marker')
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
                  console.log('[CHAT] Graph updated, refreshing')
                  // Graph was modified by tool calls, refresh it
                  await refreshGraph()
                }
              } catch {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
        console.log('[CHAT] Stream processing complete')
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
    [chatMessages, refreshGraph, owner, repo]
  )

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <DagCanvas nodes={nodes} edges={edges} onConnect={handleConnect} />
      <FloatingActionButton onClick={() => setIsModalOpen(true)} />
      <CreateIssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        chatMessages={chatMessages}
        onSendMessage={handleSendMessage}
        isChatLoading={isChatLoading}
      />
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </div>
  )
}

export default DagView
