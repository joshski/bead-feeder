import type { Node } from '@xyflow/react'
import type {
  IssueNodeData,
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../components/IssueNode'

/**
 * Raw issue data from the bd API
 */
export interface BdIssue {
  id: string
  title: string
  description?: string
  status: string
  priority: number
  issue_type: string
  owner?: string
  created_at: string
  created_by?: string
  updated_at: string
  dependency_count: number
  dependent_count: number
}

/**
 * Maps bd API status values to IssueNode status
 */
function mapStatus(status: string): IssueStatus {
  switch (status) {
    case 'open':
      return 'open'
    case 'in_progress':
      return 'in_progress'
    case 'closed':
      return 'closed'
    default:
      return 'open'
  }
}

/**
 * Maps bd API issue_type values to IssueNode type
 */
function mapType(issueType: string): IssueType {
  switch (issueType) {
    case 'task':
      return 'task'
    case 'bug':
      return 'bug'
    case 'feature':
      return 'feature'
    default:
      return 'task'
  }
}

/**
 * Maps bd API priority number (0-3) to IssueNode priority string
 */
function mapPriority(priority: number): IssuePriority {
  switch (priority) {
    case 0:
      return 'P0'
    case 1:
      return 'P1'
    case 2:
      return 'P2'
    case 3:
      return 'P3'
    default:
      return 'P2'
  }
}

/**
 * Options for configuring node transformation
 */
export interface TransformOptions {
  /**
   * Starting X position for nodes (default: 0)
   */
  startX?: number
  /**
   * Starting Y position for nodes (default: 0)
   */
  startY?: number
  /**
   * Horizontal spacing between nodes (default: 300)
   */
  spacingX?: number
  /**
   * Vertical spacing between nodes (default: 150)
   */
  spacingY?: number
  /**
   * Number of nodes per row before wrapping (default: 4)
   */
  nodesPerRow?: number
}

const DEFAULT_OPTIONS: Required<TransformOptions> = {
  startX: 0,
  startY: 0,
  spacingX: 300,
  spacingY: 150,
  nodesPerRow: 4,
}

/**
 * Transforms a single bd issue to a React Flow node
 */
export function issueToNode(
  issue: BdIssue,
  position: { x: number; y: number }
): Node<IssueNodeData> {
  return {
    id: issue.id,
    type: 'issue',
    position,
    data: {
      issueId: issue.id,
      title: issue.title,
      status: mapStatus(issue.status),
      type: mapType(issue.issue_type),
      priority: mapPriority(issue.priority),
    },
  }
}

/**
 * Transforms an array of bd issues to React Flow nodes
 * Positions nodes in a grid layout
 */
export function issuesToNodes(
  issues: BdIssue[],
  options: TransformOptions = {}
): Node<IssueNodeData>[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return issues.map((issue, index) => {
    const row = Math.floor(index / opts.nodesPerRow)
    const col = index % opts.nodesPerRow
    const position = {
      x: opts.startX + col * opts.spacingX,
      y: opts.startY + row * opts.spacingY,
    }
    return issueToNode(issue, position)
  })
}
