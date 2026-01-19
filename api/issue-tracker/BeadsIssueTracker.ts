/**
 * IssueTracker implementation that wraps the beads (bd) CLI.
 */

import { spawn } from 'node:child_process'
import * as log from '../logger'
import type {
  CreateIssueInput,
  Dependency,
  Issue,
  IssueGraph,
  IssueTracker,
  IssueTrackerConfig,
  IssueType,
  OperationResult,
  UpdateIssueInput,
} from './IssueTracker'

/**
 * Raw issue type from bd CLI (uses issue_type instead of type)
 */
interface BdRawIssue {
  id: string
  title: string
  status: string
  issue_type?: string
  priority?: number
  description?: string
  owner?: string
  assignee?: string
  created_at: string
  created_by?: string
  updated_at: string
  closed_at?: string
  close_reason?: string
  dependency_count?: number
  dependent_count?: number
  // bd show includes dependencies array
  dependencies?: unknown[]
  // bd show includes dependents array
  dependents?: unknown[]
}

/**
 * Raw graph structure from bd CLI
 */
interface BdRawGraphEntry {
  Root?: BdRawIssue
  Issues?: BdRawIssue[]
  Dependencies?: Dependency[] | null
  IssueMap?: Record<string, BdRawIssue>
  VarDefs?: unknown
  Phase?: string
}

/**
 * Extract JSON from bd CLI output that may contain warnings/messages before the JSON
 */
function extractJson(output: string): string {
  // Find the start of JSON (either { or [)
  const jsonStart = Math.min(
    output.indexOf('{') === -1 ? Number.POSITIVE_INFINITY : output.indexOf('{'),
    output.indexOf('[') === -1 ? Number.POSITIVE_INFINITY : output.indexOf('[')
  )
  if (jsonStart === Number.POSITIVE_INFINITY) {
    throw new Error('No JSON found in output')
  }
  return output.slice(jsonStart)
}

/**
 * Transform bd CLI issue to IssueTracker Issue type
 */
function transformIssue(raw: BdRawIssue): Issue {
  // Compute dependency/dependent counts from arrays if provided, otherwise use count fields
  const dependencyCount = raw.dependency_count ?? raw.dependencies?.length ?? 0
  const dependentCount = raw.dependent_count ?? raw.dependents?.length ?? 0

  return {
    id: raw.id,
    title: raw.title,
    status: raw.status as Issue['status'],
    type: raw.issue_type as IssueType | undefined,
    priority: raw.priority as Issue['priority'],
    description: raw.description,
    assignee: raw.assignee,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    dependency_count: dependencyCount,
    dependent_count: dependentCount,
  }
}

/**
 * Run a bd command and return the output
 */
async function runBdCommand(args: string[], cwd?: string): Promise<string> {
  const workDir = cwd ?? process.cwd()

  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: workDir,
      env: { ...process.env, BD_NO_DAEMON: 'true' },
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
      const output = stdout.trim()
      const errOutput = stderr.trim()
      // BD_NO_DAEMON mode may exit with code 0 even on errors, detect by checking for Error prefix on stderr
      if (code === 0 && !errOutput.startsWith('Error')) {
        resolve(stdout)
      } else {
        // For errors, try to extract error from JSON first
        const errorOutput = output || errOutput
        try {
          const json = extractJson(errorOutput)
          const parsed = JSON.parse(json)
          if (parsed.error) {
            reject(new Error(parsed.error))
            return
          }
        } catch {
          // Not JSON, use raw output
        }
        reject(new Error(errorOutput || `bd command failed with code ${code}`))
      }
    })

    proc.on('error', err => {
      reject(err)
    })
  })
}

export class BeadsIssueTracker implements IssueTracker {
  readonly config: IssueTrackerConfig

  constructor(config: IssueTrackerConfig = {}) {
    this.config = config
  }

  private get cwd(): string | undefined {
    return this.config.cwd
  }

  async createIssue(input: CreateIssueInput): Promise<OperationResult<Issue>> {
    // Validate title locally first
    if (!input.title || input.title.trim() === '') {
      return { success: false, error: 'Title is required' }
    }

    try {
      const args = ['create', input.title.trim(), '--json']

      if (input.description) {
        args.push('--description', input.description)
      }

      if (input.type) {
        args.push('--type', input.type)
      }

      if (input.priority !== undefined) {
        args.push('--priority', String(input.priority))
      }

      const output = await runBdCommand(args, this.cwd)
      // bd create outputs warnings before JSON, extract just the JSON part
      const json = extractJson(output)
      const raw = JSON.parse(json) as BdRawIssue
      return { success: true, data: transformIssue(raw) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async getIssue(issueId: string): Promise<OperationResult<Issue>> {
    try {
      const output = await runBdCommand(['show', issueId, '--json'], this.cwd)
      const json = extractJson(output)
      // bd show returns an array with a single element
      const rawArray = JSON.parse(json) as BdRawIssue[]
      if (!Array.isArray(rawArray) || rawArray.length === 0) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: true, data: transformIssue(rawArray[0]) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('no issue found')
      ) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: false, error: message }
    }
  }

  async listIssues(): Promise<OperationResult<Issue[]>> {
    try {
      const output = await runBdCommand(['list', '--json'], this.cwd)
      const json = extractJson(output)
      const rawArray = JSON.parse(json) as BdRawIssue[]
      const issues = rawArray.map(transformIssue)
      return { success: true, data: issues }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async updateIssue(
    issueId: string,
    input: UpdateIssueInput
  ): Promise<OperationResult<Issue>> {
    try {
      const args = ['update', issueId]

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

      const output = await runBdCommand(args, this.cwd)
      const json = extractJson(output)
      // bd update returns an array with a single element
      const rawArray = JSON.parse(json) as BdRawIssue[]
      if (!Array.isArray(rawArray) || rawArray.length === 0) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: true, data: transformIssue(rawArray[0]) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('no issue found')
      ) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: false, error: message }
    }
  }

  async closeIssue(
    issueId: string,
    reason?: string
  ): Promise<OperationResult<Issue>> {
    try {
      const args = ['close', issueId, '--json']

      if (reason) {
        args.push('--reason', reason)
      }

      const output = await runBdCommand(args, this.cwd)
      const json = extractJson(output)
      // bd close returns an array with a single element
      const rawArray = JSON.parse(json) as BdRawIssue[]
      if (!Array.isArray(rawArray) || rawArray.length === 0) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: true, data: transformIssue(rawArray[0]) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('no issue found')
      ) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: false, error: message }
    }
  }

  async addDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<Dependency>> {
    try {
      const args = ['dep', 'add', blockedId, blockerId, '--json']

      const output = await runBdCommand(args, this.cwd)
      const result = JSON.parse(output) as Dependency
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const lowerMessage = message.toLowerCase()

      // Normalize error messages for consistency with FakeIssueTracker
      if (
        lowerMessage.includes('not found') ||
        lowerMessage.includes('issue not found')
      ) {
        return { success: false, error: 'Issue not found' }
      }
      if (lowerMessage.includes('cycle') || lowerMessage.includes('circular')) {
        return {
          success: false,
          error: 'Adding this dependency would create a cycle',
        }
      }
      if (
        lowerMessage.includes('already') ||
        lowerMessage.includes('exists') ||
        lowerMessage.includes('duplicate')
      ) {
        return { success: false, error: 'Dependency already exists' }
      }
      return { success: false, error: message }
    }
  }

  async removeDependency(
    blockedId: string,
    blockerId: string
  ): Promise<OperationResult<void>> {
    try {
      const args = ['dep', 'remove', blockedId, blockerId, '--json']

      await runBdCommand(args, this.cwd)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.includes('Dependency not found')
      ) {
        return { success: false, error: 'Dependency not found' }
      }
      return { success: false, error: message }
    }
  }

  async getGraph(): Promise<OperationResult<IssueGraph>> {
    try {
      const output = await runBdCommand(['graph', '--all', '--json'], this.cwd)

      // bd graph may output "No open issues found" when empty
      if (
        output.trim() === 'No open issues found' ||
        !output.includes('[') ||
        !output.includes('{')
      ) {
        return {
          success: true,
          data: {
            issues: [],
            dependencies: [],
            issueMap: {},
          },
        }
      }

      const json = extractJson(output)
      // bd graph returns an array of graph entries with nested structure
      const rawEntries = JSON.parse(json) as BdRawGraphEntry[]

      // Flatten all issues from all graph entries
      const allIssues: Issue[] = []
      const allDependencies: Dependency[] = []
      const issueMap: Record<string, Issue> = {}

      for (const entry of rawEntries) {
        // Collect issues from the Issues array
        if (entry.Issues) {
          for (const rawIssue of entry.Issues) {
            const issue = transformIssue(rawIssue)
            // Avoid duplicates
            if (!issueMap[issue.id]) {
              allIssues.push(issue)
              issueMap[issue.id] = issue
            }
          }
        }
        // Collect dependencies
        if (entry.Dependencies) {
          for (const dep of entry.Dependencies) {
            // Check for duplicates
            const exists = allDependencies.some(
              d =>
                d.issue_id === dep.issue_id &&
                d.depends_on_id === dep.depends_on_id
            )
            if (!exists) {
              allDependencies.push(dep)
            }
          }
        }
      }

      return {
        success: true,
        data: {
          issues: allIssues,
          dependencies: allDependencies,
          issueMap,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async sync(options?: {
    importOnly?: boolean
  }): Promise<OperationResult<void>> {
    try {
      const args = ['sync']
      if (options?.importOnly) {
        args.push('--import-only')
      }
      log.info(`Running bd ${args.join(' ')} in ${this.cwd}`)
      const output = await runBdCommand(args, this.cwd)
      log.info(`bd sync output: ${output.trim()}`)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.error(`bd sync failed: ${message}`)
      return { success: false, error: message }
    }
  }
}
