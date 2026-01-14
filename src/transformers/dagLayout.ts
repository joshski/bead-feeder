import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

/**
 * Options for configuring DAG layout
 */
export interface DagLayoutOptions {
  /**
   * Direction of the graph layout
   * TB = top-to-bottom, LR = left-to-right
   * Default: 'TB'
   */
  direction?: 'TB' | 'LR'
  /**
   * Horizontal spacing between nodes (default: 50)
   */
  nodeSpacingX?: number
  /**
   * Vertical spacing between nodes (default: 50)
   */
  nodeSpacingY?: number
  /**
   * Width of each node (default: 250)
   */
  nodeWidth?: number
  /**
   * Height of each node (default: 100)
   */
  nodeHeight?: number
}

const DEFAULT_OPTIONS: Required<DagLayoutOptions> = {
  direction: 'TB',
  nodeSpacingX: 50,
  nodeSpacingY: 50,
  nodeWidth: 250,
  nodeHeight: 100,
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
  if (nodes.length === 0) {
    return []
  }

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
  for (const node of nodes) {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    })
  }

  // Add edges to the dagre graph
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }

  // Run the layout algorithm
  dagre.layout(dagreGraph)

  // Map the dagre positions back to React Flow nodes
  return nodes.map(node => {
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
}
