import type { Edge, Node } from '@xyflow/react'
import { useState } from 'react'
import CreateIssueModal, {
  type CreateIssueData,
} from '../components/CreateIssueModal'
import DagCanvas from '../components/DagCanvas'
import FloatingActionButton from '../components/FloatingActionButton'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const sampleNodes: Node[] = [
  {
    id: '1',
    type: 'issue',
    position: { x: 0, y: 0 },
    data: {
      issueId: 'issue-1',
      title: 'Set up project infrastructure',
      status: 'closed',
      type: 'task',
      priority: 'P1',
    },
  },
  {
    id: '2',
    type: 'issue',
    position: { x: 200, y: 150 },
    data: {
      issueId: 'issue-2',
      title: 'Implement user authentication',
      status: 'in_progress',
      type: 'feature',
      priority: 'P0',
    },
  },
  {
    id: '3',
    type: 'issue',
    position: { x: -100, y: 150 },
    data: {
      issueId: 'issue-3',
      title: 'Fix login redirect bug',
      status: 'open',
      type: 'bug',
      priority: 'P2',
    },
  },
]

const sampleEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
]

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

function DagView() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCreateIssue = async (data: CreateIssueData) => {
    await createIssue(data)
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <DagCanvas nodes={sampleNodes} edges={sampleEdges} />
      <FloatingActionButton onClick={() => setIsModalOpen(true)} />
      <CreateIssueModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateIssue}
      />
    </div>
  )
}

export default DagView
