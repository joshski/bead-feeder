import type { Edge, Node } from '@xyflow/react'
import DagCanvas from '../components/DagCanvas'

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

function DagView() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <DagCanvas nodes={sampleNodes} edges={sampleEdges} />
    </div>
  )
}

export default DagView
