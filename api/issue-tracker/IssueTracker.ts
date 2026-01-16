/**
 * IssueTracker abstraction interface and types.
 * Enables pluggable issue tracker backends (beads CLI, in-memory fake, etc.)
 */

// Core types
export type IssueType = 'task' | 'bug' | 'feature'
export type IssueStatus = 'open' | 'in_progress' | 'closed'
export type IssuePriority = 0 | 1 | 2 | 3

export interface Issue {
  id: string
  title: string
  status: IssueStatus
  type?: IssueType
  priority?: IssuePriority
  description?: string
  assignee?: string
  created_at: string
  updated_at: string
  dependency_count: number
  dependent_count: number
}

export interface Dependency {
  issue_id: string // blocked issue
  depends_on_id: string // blocker issue
  type: string
  created_at?: string
}

export interface IssueGraph {
  issues: Issue[]
  dependencies: Dependency[]
  issueMap: Record<string, Issue>
}

export interface OperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface IssueTrackerConfig {
  owner?: string
  repo?: string
  cwd?: string
}

// Input types
export interface CreateIssueInput {
  title: string
  description?: string
  type?: IssueType
  priority?: IssuePriority
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  type?: IssueType
  priority?: IssuePriority
  status?: 'open' | 'in_progress'
  assignee?: string
}

// Full interface - sync is part of the contract
export interface IssueTracker {
  readonly config: IssueTrackerConfig

  // Issue operations
  createIssue(input: CreateIssueInput): Promise<OperationResult<Issue>>
  getIssue(issueId: string): Promise<OperationResult<Issue>>
  listIssues(): Promise<OperationResult<Issue[]>>
  updateIssue(
    issueId: string,
    input: UpdateIssueInput
  ): Promise<OperationResult<Issue>>
  closeIssue(issueId: string, reason?: string): Promise<OperationResult<Issue>>

  // Dependency operations
  addDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<Dependency>>
  removeDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<void>>

  // Graph operations
  getGraph(): Promise<OperationResult<IssueGraph>>

  // Sync (part of contract - all implementations must handle)
  sync(): Promise<OperationResult<void>>
}
