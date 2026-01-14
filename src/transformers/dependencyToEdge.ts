import type { Edge } from '@xyflow/react'

/**
 * Raw dependency data from the bd graph API
 */
export interface BdDependency {
  issue_id: string
  depends_on_id: string
  type: string
  created_at?: string
  created_by?: string
}

/**
 * Transforms a single bd dependency to a React Flow edge
 * The edge goes from blocker (depends_on_id) to blocked (issue_id)
 */
export function dependencyToEdge(dependency: BdDependency): Edge {
  return {
    id: `${dependency.depends_on_id}-${dependency.issue_id}`,
    source: dependency.depends_on_id,
    target: dependency.issue_id,
    type: 'smoothstep',
    animated: false,
  }
}

/**
 * Transforms an array of bd dependencies to React Flow edges
 */
export function dependenciesToEdges(dependencies: BdDependency[]): Edge[] {
  return dependencies.map(dependencyToEdge)
}
