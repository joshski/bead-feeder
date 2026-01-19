import type { IssueTracker } from './issue-tracker'
import * as log from './logger'

/**
 * Result of executing an LLM tool call
 */
export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  /** Suggested commit message for this tool execution */
  commitMessage?: string
}

/**
 * Input types for each tool
 */
export interface CreateIssueInput {
  title: string
  description?: string
  type?: 'task' | 'bug' | 'feature'
  priority?: 0 | 1 | 2 | 3
}

export interface AddDependencyInput {
  blocked_issue_id: string
  blocker_issue_id: string
}

export interface RemoveDependencyInput {
  blocked_issue_id: string
  blocker_issue_id: string
}

export interface UpdateIssueInput {
  issue_id: string
  title?: string
  description?: string
  type?: 'task' | 'bug' | 'feature'
  priority?: 0 | 1 | 2 | 3
  status?: 'open' | 'in_progress'
  assignee?: string
}

export interface CloseIssueInput {
  issue_id: string
  reason?: string
}

/**
 * Execute create_issue tool
 */
async function executeCreateIssue(
  tracker: IssueTracker,
  input: CreateIssueInput
): Promise<ToolExecutionResult> {
  log.info(
    `Creating issue: "${input.title}" (type: ${input.type ?? 'task'}, priority: ${input.priority ?? 2})`
  )

  const result = await tracker.createIssue({
    title: input.title,
    description: input.description,
    type: input.type,
    priority: input.priority,
  })

  if (!result.success) {
    log.error(`Failed to create issue "${input.title}": ${result.error}`)
    return { success: false, error: result.error }
  }

  const issueId = result.data?.id || 'unknown'
  log.info(`Issue created successfully: ${issueId}`)
  return {
    success: true,
    result: result.data,
    commitMessage: `feat(beads): Create issue ${issueId} - ${input.title}`,
  }
}

/**
 * Execute add_dependency tool
 */
async function executeAddDependency(
  tracker: IssueTracker,
  input: AddDependencyInput
): Promise<ToolExecutionResult> {
  log.info(
    `Adding dependency: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )

  const result = await tracker.addDependency(
    input.blocked_issue_id,
    input.blocker_issue_id
  )

  if (!result.success) {
    log.error(
      `Failed to add dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}: ${result.error}`
    )
    return { success: false, error: result.error }
  }

  log.info(
    `Dependency added: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )
  return {
    success: true,
    result: result.data,
    commitMessage: `feat(beads): Add dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`,
  }
}

/**
 * Execute remove_dependency tool
 */
async function executeRemoveDependency(
  tracker: IssueTracker,
  input: RemoveDependencyInput
): Promise<ToolExecutionResult> {
  log.info(
    `Removing dependency: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )

  const result = await tracker.removeDependency(
    input.blocked_issue_id,
    input.blocker_issue_id
  )

  if (!result.success) {
    log.error(
      `Failed to remove dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}: ${result.error}`
    )
    return { success: false, error: result.error }
  }

  log.info(
    `Dependency removed: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )
  return {
    success: true,
    result: undefined,
    commitMessage: `feat(beads): Remove dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`,
  }
}

/**
 * Execute update_issue tool
 */
async function executeUpdateIssue(
  tracker: IssueTracker,
  input: UpdateIssueInput
): Promise<ToolExecutionResult> {
  log.info(`Updating issue: ${input.issue_id}`)

  const result = await tracker.updateIssue(input.issue_id, {
    title: input.title,
    description: input.description,
    type: input.type,
    priority: input.priority,
    status: input.status,
    assignee: input.assignee,
  })

  if (!result.success) {
    log.error(`Failed to update issue ${input.issue_id}: ${result.error}`)
    return { success: false, error: result.error }
  }

  // Build a descriptive commit message for the update
  const changes: string[] = []
  if (input.status) changes.push(`status -> ${input.status}`)
  if (input.title) changes.push('title')
  if (input.description) changes.push('description')
  if (input.type) changes.push(`type -> ${input.type}`)
  if (input.priority !== undefined)
    changes.push(`priority -> P${input.priority}`)
  if (input.assignee) changes.push(`assignee -> ${input.assignee}`)
  const changesSummary = changes.length > 0 ? changes.join(', ') : 'fields'

  log.info(`Issue updated: ${input.issue_id} (${changesSummary})`)
  return {
    success: true,
    result: result.data,
    commitMessage: `feat(beads): Update issue ${input.issue_id} (${changesSummary})`,
  }
}

/**
 * Execute close_issue tool
 */
async function executeCloseIssue(
  tracker: IssueTracker,
  input: CloseIssueInput
): Promise<ToolExecutionResult> {
  log.info(`Closing issue: ${input.issue_id}`)

  const result = await tracker.closeIssue(input.issue_id, input.reason)

  if (!result.success) {
    log.error(`Failed to close issue ${input.issue_id}: ${result.error}`)
    return { success: false, error: result.error }
  }

  log.info(`Issue closed: ${input.issue_id}`)
  return {
    success: true,
    result: result.data,
    commitMessage: `feat(beads): Close issue ${input.issue_id}`,
  }
}

/**
 * Execute a tool by name with the given input
 * @param toolName - Name of the tool to execute
 * @param input - Tool input parameters
 * @param tracker - IssueTracker instance to use
 */
export async function executeTool(
  toolName: string,
  input: unknown,
  tracker: IssueTracker
): Promise<ToolExecutionResult> {
  log.debug(`Executing tool: ${toolName} with input: ${JSON.stringify(input)}`)

  switch (toolName) {
    case 'create_issue':
      return executeCreateIssue(tracker, input as CreateIssueInput)
    case 'add_dependency':
      return executeAddDependency(tracker, input as AddDependencyInput)
    case 'remove_dependency':
      return executeRemoveDependency(tracker, input as RemoveDependencyInput)
    case 'update_issue':
      return executeUpdateIssue(tracker, input as UpdateIssueInput)
    case 'close_issue':
      return executeCloseIssue(tracker, input as CloseIssueInput)
    default:
      log.error(`Unknown tool requested: ${toolName}`)
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
