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
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect } from 'react'
import '@xyflow/react/dist/style.css'
import { dagLog } from '../utils/dagLogger'
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  dagLog(`DagCanvasInner render: ${nodes.length} nodes, ${edges.length} edges`)

  // Sync nodes/edges when props change (e.g., after API fetch)
  useEffect(() => {
    dagLog(`Syncing nodes from props: ${initialNodes.length} nodes`)
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    dagLog(`Syncing edges from props: ${initialEdges.length} edges`)
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const handleConnect = useCallback(
    (connection: Connection) => {
      dagLog(`New connection: ${connection.source} → ${connection.target}`)

      // Add the edge to the local state for immediate visual feedback
      setEdges(eds => addEdge({ ...connection, type: 'default' }, eds))

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
