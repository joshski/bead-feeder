import { spawn } from 'node:child_process'
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
 * Run a bd command and return the output
 * @param args - Command arguments to pass to bd
 * @param cwd - Working directory to run the command in
 */
async function runBdCommand(args: string[], cwd?: string): Promise<string> {
  const workDir = cwd ?? process.cwd()
  log.debug(`Running bd command: bd ${args.join(' ')} in ${workDir}`)

  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: workDir,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', data => {
      stdout += data.toString()
    })

    proc.stderr.on('data', data => {
      stderr += data.toString()
    })

    proc.on('close', code => {
      if (code === 0) {
        log.debug(`bd command succeeded: bd ${args.join(' ')}`)
        resolve(stdout)
      } else {
        const errorMsg = `bd ${args.join(' ')} failed with code ${code}: ${stderr}`
        log.error(`bd command failed: ${errorMsg}`)
        reject(new Error(errorMsg))
      }
    })

    proc.on('error', err => {
      log.error(`bd command spawn error: ${err.message}`)
      reject(err)
    })
  })
}

/**
 * Execute create_issue tool
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd command
 */
async function executeCreateIssue(
  input: CreateIssueInput,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.info(
    `Creating issue: "${input.title}" (type: ${input.type ?? 'task'}, priority: ${input.priority ?? 2})`
  )

  try {
    const args = ['create', input.title, '--json']

    if (input.description) {
      args.push('--description', input.description)
    }

    if (input.type) {
      args.push('--type', input.type)
    }

    if (input.priority !== undefined) {
      args.push('--priority', String(input.priority))
    }

    const output = await runBdCommand(args, cwd)
    const result = JSON.parse(output) as { id?: string }
    const issueId = result.id || 'unknown'
    log.info(`Issue created successfully: ${issueId}`)
    return {
      success: true,
      result,
      commitMessage: `feat(beads): Create issue ${issueId} - ${input.title}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error(`Failed to create issue "${input.title}": ${message}`)
    return { success: false, error: message }
  }
}

/**
 * Execute add_dependency tool
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd command
 */
async function executeAddDependency(
  input: AddDependencyInput,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.info(
    `Adding dependency: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )

  try {
    const args = [
      'dep',
      'add',
      input.blocked_issue_id,
      input.blocker_issue_id,
      '--json',
    ]

    const output = await runBdCommand(args, cwd)
    const result = JSON.parse(output)
    log.info(
      `Dependency added: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
    )
    return {
      success: true,
      result,
      commitMessage: `feat(beads): Add dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error(
      `Failed to add dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}: ${message}`
    )
    return { success: false, error: message }
  }
}

/**
 * Execute remove_dependency tool
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd command
 */
async function executeRemoveDependency(
  input: RemoveDependencyInput,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.info(
    `Removing dependency: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
  )

  try {
    const args = [
      'dep',
      'remove',
      input.blocked_issue_id,
      input.blocker_issue_id,
      '--json',
    ]

    const output = await runBdCommand(args, cwd)
    const result = JSON.parse(output)
    log.info(
      `Dependency removed: ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`
    )
    return {
      success: true,
      result,
      commitMessage: `feat(beads): Remove dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error(
      `Failed to remove dependency ${input.blocker_issue_id} blocks ${input.blocked_issue_id}: ${message}`
    )
    return { success: false, error: message }
  }
}

/**
 * Execute update_issue tool
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd command
 */
async function executeUpdateIssue(
  input: UpdateIssueInput,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.info(`Updating issue: ${input.issue_id}`)

  try {
    const args = ['update', input.issue_id]

    if (input.title) {
      args.push('--title', input.title)
    }

    if (input.description) {
      args.push('--description', input.description)
    }

    if (input.type) {
      args.push('--type', input.type)
    }

    if (input.priority !== undefined) {
      args.push('--priority', String(input.priority))
    }

    if (input.status) {
      args.push('--status', input.status)
    }

    if (input.assignee) {
      args.push('--assignee', input.assignee)
    }

    args.push('--json')

    const output = await runBdCommand(args, cwd)
    const result = JSON.parse(output)

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
      result,
      commitMessage: `feat(beads): Update issue ${input.issue_id} (${changesSummary})`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error(`Failed to update issue ${input.issue_id}: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * Execute close_issue tool
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd command
 */
async function executeCloseIssue(
  input: CloseIssueInput,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.info(`Closing issue: ${input.issue_id}`)

  try {
    const args = ['close', input.issue_id, '--json']

    if (input.reason) {
      args.push('--reason', input.reason)
    }

    const output = await runBdCommand(args, cwd)
    const result = JSON.parse(output)
    log.info(`Issue closed: ${input.issue_id}`)
    return {
      success: true,
      result,
      commitMessage: `feat(beads): Close issue ${input.issue_id}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log.error(`Failed to close issue ${input.issue_id}: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * Execute a tool by name with the given input
 * @param toolName - Name of the tool to execute
 * @param input - Tool input parameters
 * @param cwd - Working directory for bd commands (defaults to process.cwd())
 */
export async function executeTool(
  toolName: string,
  input: unknown,
  cwd?: string
): Promise<ToolExecutionResult> {
  log.debug(`Executing tool: ${toolName} with input: ${JSON.stringify(input)}`)

  switch (toolName) {
    case 'create_issue':
      return executeCreateIssue(input as CreateIssueInput, cwd)
    case 'add_dependency':
      return executeAddDependency(input as AddDependencyInput, cwd)
    case 'remove_dependency':
      return executeRemoveDependency(input as RemoveDependencyInput, cwd)
    case 'update_issue':
      return executeUpdateIssue(input as UpdateIssueInput, cwd)
    case 'close_issue':
      return executeCloseIssue(input as CloseIssueInput, cwd)
    default:
      log.error(`Unknown tool requested: ${toolName}`)
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
