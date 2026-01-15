import type { Edge } from '@xyflow/react'
import { dagLog, dagWarn } from '../utils/dagLogger'

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
    type: 'default',
    animated: false,
  }
}

/**
 * Transforms an array of bd dependencies to React Flow edges
 */
export function dependenciesToEdges(dependencies: BdDependency[]): Edge[] {
  dagLog(`Transforming ${dependencies.length} dependencies to edges`)

  const edges = dependencies.map(dependencyToEdge)

  // Check for any edges with missing source/target
  const invalidEdges = edges.filter(e => !e.source || !e.target)
  if (invalidEdges.length > 0) {
    dagWarn(
      `Found ${invalidEdges.length} edges with missing source/target`,
      invalidEdges
    )
  }

  dagLog(`Created ${edges.length} edges`, {
    connections: edges.map(e => `${e.source} → ${e.target}`),
  })

  return edges
}
