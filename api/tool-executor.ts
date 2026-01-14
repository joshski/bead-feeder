import { spawn } from 'node:child_process'

/**
 * Result of executing an LLM tool call
 */
export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
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
 */
async function runBdCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: process.cwd(),
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
        resolve(stdout)
      } else {
        reject(
          new Error(`bd ${args.join(' ')} failed with code ${code}: ${stderr}`)
        )
      }
    })

    proc.on('error', err => {
      reject(err)
    })
  })
}

/**
 * Execute create_issue tool
 */
async function executeCreateIssue(
  input: CreateIssueInput
): Promise<ToolExecutionResult> {
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

    const output = await runBdCommand(args)
    const result = JSON.parse(output)
    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute add_dependency tool
 */
async function executeAddDependency(
  input: AddDependencyInput
): Promise<ToolExecutionResult> {
  try {
    const args = [
      'dep',
      'add',
      input.blocked_issue_id,
      input.blocker_issue_id,
      '--json',
    ]

    const output = await runBdCommand(args)
    const result = JSON.parse(output)
    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute remove_dependency tool
 */
async function executeRemoveDependency(
  input: RemoveDependencyInput
): Promise<ToolExecutionResult> {
  try {
    const args = [
      'dep',
      'remove',
      input.blocked_issue_id,
      input.blocker_issue_id,
      '--json',
    ]

    const output = await runBdCommand(args)
    const result = JSON.parse(output)
    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute update_issue tool
 */
async function executeUpdateIssue(
  input: UpdateIssueInput
): Promise<ToolExecutionResult> {
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

    const output = await runBdCommand(args)
    const result = JSON.parse(output)
    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute close_issue tool
 */
async function executeCloseIssue(
  input: CloseIssueInput
): Promise<ToolExecutionResult> {
  try {
    const args = ['close', input.issue_id, '--json']

    if (input.reason) {
      args.push('--reason', input.reason)
    }

    const output = await runBdCommand(args)
    const result = JSON.parse(output)
    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute a tool by name with the given input
 */
export async function executeTool(
  toolName: string,
  input: unknown
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'create_issue':
      return executeCreateIssue(input as CreateIssueInput)
    case 'add_dependency':
      return executeAddDependency(input as AddDependencyInput)
    case 'remove_dependency':
      return executeRemoveDependency(input as RemoveDependencyInput)
    case 'update_issue':
      return executeUpdateIssue(input as UpdateIssueInput)
    case 'close_issue':
      return executeCloseIssue(input as CloseIssueInput)
    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
