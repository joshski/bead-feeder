import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'
import { dagLog, dagWarn, logLayoutComputed } from '../utils/dagLogger'

/**
 * Options for configuring DAG layout
 */
export interface DagLayoutOptions {
  /**
   * Direction of the graph layout
   * TB = top-to-bottom, LR = left-to-right
   * Default: 'LR'
   */
  direction?: 'TB' | 'LR'
  /**
   * Horizontal spacing between nodes (default: 120)
   */
  nodeSpacingX?: number
  /**
   * Vertical spacing between nodes (default: 50)
   */
  nodeSpacingY?: number
  /**
   * Width of each node (default: 300)
   */
  nodeWidth?: number
  /**
   * Height of each node (default: 80)
   */
  nodeHeight?: number
}

const DEFAULT_OPTIONS: Required<DagLayoutOptions> = {
  direction: 'LR',
  nodeSpacingX: 180,
  nodeSpacingY: 30,
  nodeWidth: 300,
  nodeHeight: 80,
}

/**
 * Applies a DAG (directed acyclic graph) layout to nodes using dagre.
 * Nodes with no dependencies are placed at the top/left,
 * dependent nodes are positioned below/right.
 *
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges defining dependencies
 * @param options - Layout configuration options
 * @returns New array of nodes with updated positions
 */
export function applyDagLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: DagLayoutOptions = {}
): Node<T>[] {
  dagLog(`Applying DAG layout: ${nodes.length} nodes, ${edges.length} edges`)

  if (nodes.length === 0) {
    dagLog('Empty node array, returning empty result')
    return []
  }

  const startTime = performance.now()
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Configure graph direction and spacing
  dagreGraph.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSpacingX,
    ranksep: opts.nodeSpacingY,
  })

  // Add nodes to the dagre graph
  const nodeIds = new Set<string>()
  for (const node of nodes) {
    nodeIds.add(node.id)
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    })
  }

  // Add edges to the dagre graph, checking for validity
  let skippedEdges = 0
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      dagWarn(`Edge source "${edge.source}" not found in nodes, skipping edge`)
      skippedEdges++
      continue
    }
    if (!nodeIds.has(edge.target)) {
      dagWarn(`Edge target "${edge.target}" not found in nodes, skipping edge`)
      skippedEdges++
      continue
    }
    dagreGraph.setEdge(edge.source, edge.target)
  }

  if (skippedEdges > 0) {
    dagWarn(`Skipped ${skippedEdges} edges due to missing nodes`)
  }

  // Run the layout algorithm
  dagre.layout(dagreGraph)

  // Map the dagre positions back to React Flow nodes
  const layoutedNodes = nodes.map(node => {
    const dagreNode = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        // Dagre positions are center-based, convert to top-left
        x: dagreNode.x - opts.nodeWidth / 2,
        y: dagreNode.y - opts.nodeHeight / 2,
      },
    }
  })

  const durationMs = performance.now() - startTime
  logLayoutComputed(nodes.length, opts.direction, durationMs)

  dagLog('Layout positions', {
    nodes: layoutedNodes.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    })),
  })

  return layoutedNodes
}
