/**
 * In-memory IssueTracker implementation for testing.
 * Implements identical behavior to beads CLI including:
 * - Same validation rules
 * - Same error messages
 * - Cycle detection for dependencies
 */

import type {
  CreateIssueInput,
  Dependency,
  Issue,
  IssueGraph,
  IssueTracker,
  IssueTrackerConfig,
  OperationResult,
  UpdateIssueInput,
} from './IssueTracker'

// ID generation similar to beads format
function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'bead-'
  let id = ''
  for (let i = 0; i < 3; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return prefix + id
}

export class FakeIssueTracker implements IssueTracker {
  private issues: Map<string, Issue> = new Map()
  private dependencies: Dependency[] = []
  readonly config: IssueTrackerConfig

  constructor(config: IssueTrackerConfig = {}) {
    this.config = config
  }

  /**
   * Reset all state - useful for testing
   */
  reset(): void {
    this.issues.clear()
    this.dependencies = []
  }

  /**
   * Seed with initial data - useful for testing
   */
  seed(issues: Issue[], dependencies: Dependency[] = []): void {
    this.reset()
    for (const issue of issues) {
      this.issues.set(issue.id, { ...issue })
    }
    this.dependencies = [...dependencies]
    this.updateDependencyCounts()
  }

  private updateDependencyCounts(): void {
    // Reset counts
    for (const issue of this.issues.values()) {
      issue.dependency_count = 0
      issue.dependent_count = 0
    }

    // Count dependencies
    for (const dep of this.dependencies) {
      const blocked = this.issues.get(dep.issue_id)
      const blocker = this.issues.get(dep.depends_on_id)
      if (blocked) {
        blocked.dependency_count++
      }
      if (blocker) {
        blocker.dependent_count++
      }
    }
  }

  private detectCycle(
    blockedId: string,
    blockerId: string
  ): { hasCycle: boolean; path?: string[] } {
    // Check for self-dependency
    if (blockedId === blockerId) {
      return { hasCycle: true, path: [blockedId, blockerId] }
    }

    // Build adjacency list: blockerId -> [blockedIds]
    // If A blocks B, then B depends on A
    // We want to check: if we add "blockerId blocks blockedId",
    // does it create a cycle where blockedId can reach blockerId?
    const graph = new Map<string, string[]>()
    for (const dep of this.dependencies) {
      // dep.depends_on_id blocks dep.issue_id
      // So dep.issue_id -> dep.depends_on_id means "issue_id depends on depends_on_id"
      const dependents = graph.get(dep.issue_id) || []
      dependents.push(dep.depends_on_id)
      graph.set(dep.issue_id, dependents)
    }

    // Add the proposed dependency: blockedId depends on blockerId
    const blockedDeps = graph.get(blockedId) || []
    blockedDeps.push(blockerId)
    graph.set(blockedId, blockedDeps)

    // DFS to check if blockerId can reach blockedId (which would be a cycle)
    const visited = new Set<string>()
    const path: string[] = []

    const dfs = (current: string, target: string): boolean => {
      if (current === target) {
        path.push(current)
        return true
      }

      if (visited.has(current)) {
        return false
      }

      visited.add(current)
      path.push(current)

      const neighbors = graph.get(current) || []
      for (const neighbor of neighbors) {
        if (dfs(neighbor, target)) {
          return true
        }
      }

      path.pop()
      return false
    }

    // Start from blockerId and try to reach blockedId
    if (dfs(blockerId, blockedId)) {
      return { hasCycle: true, path }
    }

    return { hasCycle: false }
  }

  async createIssue(input: CreateIssueInput): Promise<OperationResult<Issue>> {
    // Validate title
    if (!input.title || input.title.trim() === '') {
      return { success: false, error: 'Title is required' }
    }

    // Validate type if provided
    if (input.type && !['task', 'bug', 'feature'].includes(input.type)) {
      return {
        success: false,
        error: `Invalid type: ${input.type}. Must be task, bug, or feature`,
      }
    }

    // Validate priority if provided
    if (
      input.priority !== undefined &&
      ![0, 1, 2, 3].includes(input.priority)
    ) {
      return {
        success: false,
        error: `Invalid priority: ${input.priority}. Must be 0, 1, 2, or 3`,
      }
    }

    const now = new Date().toISOString()
    const issue: Issue = {
      id: generateId(),
      title: input.title.trim(),
      status: 'open',
      type: input.type || 'task',
      priority: input.priority ?? 2,
      description: input.description,
      created_at: now,
      updated_at: now,
      dependency_count: 0,
      dependent_count: 0,
    }

    this.issues.set(issue.id, issue)
    return { success: true, data: { ...issue } }
  }

  async getIssue(issueId: string): Promise<OperationResult<Issue>> {
    const issue = this.issues.get(issueId)
    if (!issue) {
      return { success: false, error: 'Issue not found' }
    }
    return { success: true, data: { ...issue } }
  }

  async listIssues(): Promise<OperationResult<Issue[]>> {
    const issues = Array.from(this.issues.values()).map(i => ({ ...i }))
    return { success: true, data: issues }
  }

  async updateIssue(
    issueId: string,
    input: UpdateIssueInput
  ): Promise<OperationResult<Issue>> {
    const issue = this.issues.get(issueId)
    if (!issue) {
      return { success: false, error: 'Issue not found' }
    }

    // Validate type if provided
    if (input.type && !['task', 'bug', 'feature'].includes(input.type)) {
      return {
        success: false,
        error: `Invalid type: ${input.type}. Must be task, bug, or feature`,
      }
    }

    // Validate priority if provided
    if (
      input.priority !== undefined &&
      ![0, 1, 2, 3].includes(input.priority)
    ) {
      return {
        success: false,
        error: `Invalid priority: ${input.priority}. Must be 0, 1, 2, or 3`,
      }
    }

    // Validate status if provided
    if (input.status && !['open', 'in_progress'].includes(input.status)) {
      return {
        success: false,
        error: `Invalid status: ${input.status}. Must be open or in_progress`,
      }
    }

    // Apply updates
    if (input.title !== undefined) {
      issue.title = input.title.trim()
    }
    if (input.description !== undefined) {
      issue.description = input.description
    }
    if (input.type !== undefined) {
      issue.type = input.type
    }
    if (input.priority !== undefined) {
      issue.priority = input.priority
    }
    if (input.status !== undefined) {
      issue.status = input.status
    }
    if (input.assignee !== undefined) {
      issue.assignee = input.assignee
    }
    issue.updated_at = new Date().toISOString()

    return { success: true, data: { ...issue } }
  }

  async closeIssue(
    issueId: string,
    _reason?: string
  ): Promise<OperationResult<Issue>> {
    const issue = this.issues.get(issueId)
    if (!issue) {
      return { success: false, error: 'Issue not found' }
    }

    issue.status = 'closed'
    issue.updated_at = new Date().toISOString()

    return { success: true, data: { ...issue } }
  }

  async addDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<Dependency>> {
    // Validate both issues exist
    if (!this.issues.has(blockedId)) {
      return { success: false, error: 'Issue not found' }
    }
    if (!this.issues.has(blockerId)) {
      return { success: false, error: 'Issue not found' }
    }

    // Check for duplicate dependency
    const existing = this.dependencies.find(
      d => d.issue_id === blockedId && d.depends_on_id === blockerId
    )
    if (existing) {
      return { success: false, error: 'Dependency already exists' }
    }

    // Check for cycles
    const cycleResult = this.detectCycle(blockedId, blockerId)
    if (cycleResult.hasCycle) {
      return {
        success: false,
        error: 'Adding this dependency would create a cycle',
      }
    }

    const dependency: Dependency = {
      issue_id: blockedId,
      depends_on_id: blockerId,
      type: 'blocks',
      created_at: new Date().toISOString(),
    }

    this.dependencies.push(dependency)
    this.updateDependencyCounts()

    return { success: true, data: { ...dependency } }
  }

  async removeDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<void>> {
    const index = this.dependencies.findIndex(
      d => d.issue_id === blockedId && d.depends_on_id === blockerId
    )

    if (index === -1) {
      return { success: false, error: 'Dependency not found' }
    }

    this.dependencies.splice(index, 1)
    this.updateDependencyCounts()

    return { success: true }
  }

  async getGraph(): Promise<OperationResult<IssueGraph>> {
    const issues = Array.from(this.issues.values()).map(i => ({ ...i }))
    const issueMap: Record<string, Issue> = {}
    for (const issue of issues) {
      issueMap[issue.id] = issue
    }

    return {
      success: true,
      data: {
        issues,
        dependencies: this.dependencies.map(d => ({ ...d })),
        issueMap,
      },
    }
  }

  async sync(_options?: {
    importOnly?: boolean
  }): Promise<OperationResult<void>> {
    // In-memory implementation - sync is a no-op
    return { success: true }
  }
}
