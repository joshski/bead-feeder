import type { Edge, Node } from '@xyflow/react'
import DagCanvas from '../components/DagCanvas'

const sampleNodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Issue 1' } },
  { id: '2', position: { x: 200, y: 100 }, data: { label: 'Issue 2' } },
]

const sampleEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }]

function DagView() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
      <DagCanvas nodes={sampleNodes} edges={sampleEdges} />
    </div>
  )
}

export default DagView
