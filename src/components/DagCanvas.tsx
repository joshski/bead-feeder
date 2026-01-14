import type { Edge, Node } from '@xyflow/react'
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface DagCanvasProps {
  nodes: Node[]
  edges: Edge[]
}

function DagCanvas({ nodes, edges }: DagCanvasProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default DagCanvas
