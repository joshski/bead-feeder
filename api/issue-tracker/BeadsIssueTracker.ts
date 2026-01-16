/**
 * IssueTracker implementation that wraps the beads (bd) CLI.
 */

import { spawn } from 'node:child_process'
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

/**
 * Run a bd command and return the output
 */
async function runBdCommand(args: string[], cwd?: string): Promise<string> {
  const workDir = cwd ?? process.cwd()

  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: workDir,
      env: process.env,
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
          new Error(
            stderr.trim() ||
              stdout.trim() ||
              `bd command failed with code ${code}`
          )
        )
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
      const result = JSON.parse(output) as Issue
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async getIssue(issueId: string): Promise<OperationResult<Issue>> {
    try {
      const output = await runBdCommand(['show', issueId, '--json'], this.cwd)
      const result = JSON.parse(output) as Issue
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.includes('Issue not found')
      ) {
        return { success: false, error: 'Issue not found' }
      }
      return { success: false, error: message }
    }
  }

  async listIssues(): Promise<OperationResult<Issue[]>> {
    try {
      const output = await runBdCommand(['list', '--json'], this.cwd)
      const result = JSON.parse(output) as Issue[]
      return { success: true, data: result }
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
      const result = JSON.parse(output) as Issue
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.includes('Issue not found')
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
      const result = JSON.parse(output) as Issue
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Normalize error message for consistency with FakeIssueTracker
      if (
        message.toLowerCase().includes('not found') ||
        message.includes('Issue not found')
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
      const result = JSON.parse(output) as IssueGraph
      return { success: true, data: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async sync(): Promise<OperationResult<void>> {
    try {
      await runBdCommand(['sync'], this.cwd)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }
}
