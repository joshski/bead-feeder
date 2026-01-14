import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from '@xyflow/react'
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback } from 'react'
import '@xyflow/react/dist/style.css'
import IssueNode from './IssueNode'

const nodeTypes = {
  issue: IssueNode,
}

interface DagCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange?: OnNodesChange
  onEdgesChange?: OnEdgesChange
  onConnect?: OnConnect
}

function DagCanvasInner({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: externalOnNodesChange,
  onEdgesChange: externalOnEdgesChange,
  onConnect: externalOnConnect,
}: DagCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const handleConnect = useCallback(
    (connection: Connection) => {
      // Add the edge to the local state for immediate visual feedback
      setEdges(eds => addEdge({ ...connection, type: 'smoothstep' }, eds))

      // Call external handler if provided
      if (externalOnConnect) {
        externalOnConnect(connection)
      }
    },
    [setEdges, externalOnConnect]
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={externalOnNodesChange ?? onNodesChange}
        onEdgesChange={externalOnEdgesChange ?? onEdgesChange}
        onConnect={handleConnect}
        fitView
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.1}
        maxZoom={4}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showZoom showFitView showInteractive />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  )
}

function DagCanvas(props: DagCanvasProps) {
  return (
    <ReactFlowProvider>
      <DagCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

export default DagCanvas
