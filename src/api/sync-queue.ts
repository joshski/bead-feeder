import { spawn } from 'node:child_process'
import {
  abortMerge,
  compareBranches,
  fetchRepository,
  getCurrentBranch,
  hasConflicts,
  pullRepository,
  pushRepository,
  resolveConflictsTheirs,
} from './git-service'

export interface SyncJob {
  id: string
  type: 'commit' | 'push' | 'pull' | 'resolve'
  message?: string
  createdAt: number
  retryCount?: number
  resolution?: 'theirs' | 'ours' | 'abort'
}

export interface SyncQueueConfig {
  /** Debounce delay in milliseconds before processing commits (default: 2000) */
  debounceMs?: number
  /** Interval in milliseconds for periodic push (default: 30000) */
  pushIntervalMs?: number
  /** Working directory for git operations */
  cwd?: string
  /** Maximum number of retry attempts for push failures (default: 3) */
  maxRetries?: number
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  retryBaseDelayMs?: number
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict'

export interface SyncQueueState {
  status: SyncStatus
  pendingJobs: number
  lastSync: number | null
  lastError: string | null
  conflictInfo?: {
    ahead: number
    behind: number
  }
}

type SyncEventType = 'statusChange' | 'syncComplete' | 'syncError' | 'conflict'
type SyncEventHandler = (data: unknown) => void

/**
 * Background job queue for git sync operations.
 * Debounces rapid changes and pushes periodically or on queue drain.
 */
export class SyncQueue {
  private queue: SyncJob[] = []
  private status: SyncStatus = 'idle'
  private lastSync: number | null = null
  private lastError: string | null = null
  private conflictInfo: { ahead: number; behind: number } | undefined =
    undefined
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pushInterval: ReturnType<typeof setInterval> | null = null
  private processing = false
  private token: string | null = null
  private config: Required<Omit<SyncQueueConfig, 'cwd'>> & { cwd: string }
  private eventHandlers: Map<SyncEventType, Set<SyncEventHandler>> = new Map()
  private hasPendingChanges = false

  constructor(config: SyncQueueConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 2000,
      pushIntervalMs: config.pushIntervalMs ?? 30000,
      cwd: config.cwd ?? process.cwd(),
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 1000,
    }
  }

  /**
   * Set the GitHub access token for authenticated operations
   */
  setToken(token: string | null): void {
    this.token = token
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Start the periodic push interval
   */
  start(): void {
    if (this.pushInterval) return

    this.pushInterval = setInterval(() => {
      if (this.hasPendingChanges && this.token) {
        this.enqueuePush()
      }
    }, this.config.pushIntervalMs)
  }

  /**
   * Stop the periodic push interval
   */
  stop(): void {
    if (this.pushInterval) {
      clearInterval(this.pushInterval)
      this.pushInterval = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * Subscribe to sync events
   */
  on(event: SyncEventType, handler: SyncEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.add(handler)
    }

    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  private emit(event: SyncEventType, data: unknown): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(data)
      }
    }
  }

  private setStatus(status: SyncStatus): void {
    if (this.status !== status) {
      this.status = status
      this.emit('statusChange', { status, state: this.getState() })
    }
  }

  /**
   * Get the current state of the sync queue
   */
  getState(): SyncQueueState {
    return {
      status: this.status,
      pendingJobs: this.queue.length,
      lastSync: this.lastSync,
      lastError: this.lastError,
      conflictInfo: this.conflictInfo,
    }
  }

  /**
   * Clear conflict state (call after resolution)
   */
  clearConflict(): void {
    if (this.status === 'conflict') {
      this.conflictInfo = undefined
      this.lastError = null
      this.setStatus('idle')
    }
  }

  /**
   * Queue a commit after a graph change.
   * Multiple rapid calls will be debounced into a single commit.
   */
  enqueueCommit(message: string): void {
    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Remove any pending commit jobs (we'll replace with the latest)
    this.queue = this.queue.filter(job => job.type !== 'commit')

    const job: SyncJob = {
      id: crypto.randomUUID(),
      type: 'commit',
      message,
      createdAt: Date.now(),
    }

    this.queue.push(job)
    this.hasPendingChanges = true

    // Debounce: wait before processing
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.processQueue()
    }, this.config.debounceMs)
  }

  /**
   * Queue a push operation
   */
  enqueuePush(): void {
    // Don't queue multiple pushes
    if (this.queue.some(job => job.type === 'push')) {
      return
    }

    const job: SyncJob = {
      id: crypto.randomUUID(),
      type: 'push',
      createdAt: Date.now(),
    }

    this.queue.push(job)
    this.processQueue()
  }

  /**
   * Queue a pull operation
   */
  enqueuePull(): void {
    // Don't queue multiple pulls
    if (this.queue.some(job => job.type === 'pull')) {
      return
    }

    const job: SyncJob = {
      id: crypto.randomUUID(),
      type: 'pull',
      createdAt: Date.now(),
    }

    // Pull should happen before commits/pushes
    this.queue.unshift(job)
    this.processQueue()
  }

  /**
   * Queue a conflict resolution operation
   * @param resolution - 'theirs' to accept remote changes, 'ours' to keep local, 'abort' to cancel merge
   */
  enqueueResolve(resolution: 'theirs' | 'ours' | 'abort'): void {
    // Clear any existing resolve jobs
    this.queue = this.queue.filter(job => job.type !== 'resolve')

    const job: SyncJob = {
      id: crypto.randomUUID(),
      type: 'resolve',
      resolution,
      createdAt: Date.now(),
    }

    // Resolution should happen first
    this.queue.unshift(job)
    this.clearConflict()
    this.processQueue()
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    this.setStatus('syncing')

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()
        if (!job) break

        try {
          await this.executeJob(job)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error'
          this.lastError = message
          this.setStatus('error')
          this.emit('syncError', { job, error: message })
          // Continue processing other jobs
        }
      }

      this.lastSync = Date.now()
      this.setStatus('idle')
      this.emit('syncComplete', { timestamp: this.lastSync })
    } finally {
      this.processing = false
    }
  }

  /**
   * Execute a single sync job
   */
  private async executeJob(job: SyncJob): Promise<void> {
    switch (job.type) {
      case 'commit':
        await this.executeCommit(job.message || 'Update graph')
        break

      case 'push':
        await this.executePush(job)
        break

      case 'pull':
        await this.executePull()
        break

      case 'resolve':
        await this.executeResolve(job.resolution || 'theirs')
        break
    }
  }

  /**
   * Execute a push with conflict detection and retry logic
   */
  private async executePush(job: SyncJob): Promise<void> {
    const { cwd, maxRetries, retryBaseDelayMs } = this.config

    if (!this.token) {
      throw new Error('No access token available for push')
    }

    // Fetch first to get latest remote state
    await fetchRepository(cwd, this.token)

    // Check if we're behind the remote
    const compareResult = await compareBranches(cwd)
    if (compareResult.success && compareResult.status) {
      const { ahead, behind, diverged } = compareResult.status

      if (behind > 0) {
        // We're behind - need to pull first or branches have diverged
        this.conflictInfo = { ahead, behind }

        if (diverged) {
          // Branches have diverged - this is a conflict
          this.lastError = `Branches have diverged: ${ahead} commits ahead, ${behind} commits behind`
          this.setStatus('conflict')
          this.emit('conflict', {
            ahead,
            behind,
            message: this.lastError,
          })
          throw new Error(this.lastError)
        }

        // Just behind, auto-pull with rebase
        const pullResult = await this.executePullWithRebase()
        if (!pullResult) {
          // Pull failed, conflict detected during pull
          return
        }
      }
    }

    // Attempt push
    const branchResult = await getCurrentBranch(cwd)
    if (!branchResult.success) {
      throw new Error(`Failed to get current branch: ${branchResult.error}`)
    }

    const pushResult = await pushRepository(
      cwd,
      this.token,
      'origin',
      branchResult.output
    )

    if (!pushResult.success) {
      const retryCount = job.retryCount || 0

      // Check if this is a conflict error (rejected push)
      if (
        pushResult.error?.includes('rejected') ||
        pushResult.error?.includes('non-fast-forward')
      ) {
        // Fetch and check status again
        await fetchRepository(cwd, this.token)
        const statusResult = await compareBranches(cwd)

        if (statusResult.success && statusResult.status?.behind) {
          this.conflictInfo = {
            ahead: statusResult.status.ahead,
            behind: statusResult.status.behind,
          }
          this.lastError =
            'Remote has new commits. Pull required before pushing.'
          this.setStatus('conflict')
          this.emit('conflict', {
            ahead: statusResult.status.ahead,
            behind: statusResult.status.behind,
            message: this.lastError,
          })
          throw new Error(this.lastError)
        }
      }

      // Retry with exponential backoff for transient errors
      if (retryCount < maxRetries) {
        const delay = retryBaseDelayMs * 2 ** retryCount
        await this.sleep(delay)

        // Re-queue with incremented retry count
        const retryJob: SyncJob = {
          ...job,
          retryCount: retryCount + 1,
        }
        this.queue.unshift(retryJob)
        return
      }

      throw new Error(
        `Push failed after ${maxRetries} retries: ${pushResult.error}`
      )
    }

    this.hasPendingChanges = false
  }

  /**
   * Execute a pull operation
   */
  private async executePull(): Promise<void> {
    const { cwd } = this.config

    if (!this.token) {
      throw new Error('No access token available for pull')
    }

    const pullResult = await pullRepository(cwd, this.token)
    if (!pullResult.success) {
      // Check if there are merge conflicts
      if (await hasConflicts(cwd)) {
        const compareResult = await compareBranches(cwd)
        this.conflictInfo = {
          ahead: compareResult.status?.ahead || 0,
          behind: compareResult.status?.behind || 0,
        }
        this.lastError = 'Merge conflicts detected. Please resolve conflicts.'
        this.setStatus('conflict')
        this.emit('conflict', {
          ...this.conflictInfo,
          message: this.lastError,
          hasConflicts: true,
        })
        throw new Error(this.lastError)
      }
      throw new Error(`Pull failed: ${pullResult.error}`)
    }
  }

  /**
   * Execute a pull with rebase
   * Returns true if successful, false if conflicts occurred
   */
  private async executePullWithRebase(): Promise<boolean> {
    const { cwd } = this.config

    if (!this.token) {
      throw new Error('No access token available for pull')
    }

    const pullResult = await pullRepository(cwd, this.token)
    if (!pullResult.success) {
      // Check if there are merge conflicts
      if (await hasConflicts(cwd)) {
        const compareResult = await compareBranches(cwd)
        this.conflictInfo = {
          ahead: compareResult.status?.ahead || 0,
          behind: compareResult.status?.behind || 0,
        }
        this.lastError = 'Merge conflicts detected during auto-pull.'
        this.setStatus('conflict')
        this.emit('conflict', {
          ...this.conflictInfo,
          message: this.lastError,
          hasConflicts: true,
        })
        return false
      }
      throw new Error(`Pull failed: ${pullResult.error}`)
    }
    return true
  }

  /**
   * Execute a conflict resolution
   */
  private async executeResolve(
    resolution: 'theirs' | 'ours' | 'abort'
  ): Promise<void> {
    const { cwd } = this.config

    if (resolution === 'abort') {
      const result = await abortMerge(cwd)
      if (!result.success) {
        throw new Error(`Failed to abort merge: ${result.error}`)
      }
      return
    }

    // For beads, we typically want to accept remote changes (theirs)
    // since the .beads directory can be regenerated from issue state
    const resolveResult =
      resolution === 'theirs'
        ? await resolveConflictsTheirs(cwd)
        : await this.resolveConflictsOurs(cwd)

    if (!resolveResult.success) {
      throw new Error(`Failed to resolve conflicts: ${resolveResult.error}`)
    }

    // Commit the merge
    await this.runGitCommand(['commit', '-m', 'Merge remote changes'], cwd)

    // Queue a push after successful resolution
    this.enqueuePush()
  }

  /**
   * Accept all local changes during a conflict (ours strategy)
   */
  private async resolveConflictsOurs(
    cwd: string
  ): Promise<{ success: boolean; error?: string }> {
    // Get list of conflicted files
    const conflictedResult = await this.runGitCommand(
      ['diff', '--name-only', '--diff-filter=U'],
      cwd
    )

    const files = conflictedResult.output.trim().split('\n').filter(Boolean)
    if (files.length === 0) {
      return { success: true }
    }

    for (const file of files) {
      const checkoutResult = await this.runGitCommand(
        ['checkout', '--ours', file],
        cwd
      )
      if (checkoutResult.exitCode !== 0) {
        return { success: false, error: `Failed to checkout ours: ${file}` }
      }
      const addResult = await this.runGitCommand(['add', file], cwd)
      if (addResult.exitCode !== 0) {
        return { success: false, error: `Failed to add file: ${file}` }
      }
    }

    return { success: true }
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Execute a git commit
   */
  private async executeCommit(message: string): Promise<void> {
    const { cwd } = this.config

    // Stage all changes in .beads directory
    await this.runGitCommand(['add', '.beads'], cwd)

    // Check if there are staged changes
    const statusResult = await this.runGitCommand(
      ['diff', '--cached', '--quiet'],
      cwd
    )

    // Exit code 1 means there are changes, 0 means no changes
    if (statusResult.exitCode === 0) {
      // No changes to commit
      return
    }

    // Commit the changes
    await this.runGitCommand(['commit', '-m', message], cwd)
  }

  /**
   * Run a git command and return the result
   */
  private runGitCommand(
    args: string[],
    cwd: string
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd })

      let output = ''
      let error = ''

      proc.stdout.on('data', data => {
        output += data.toString()
      })

      proc.stderr.on('data', data => {
        error += data.toString()
      })

      proc.on('close', code => {
        resolve({ exitCode: code ?? 0, output: output || error })
      })

      proc.on('error', err => {
        reject(err)
      })
    })
  }
}

// Global sync queue instance
let globalSyncQueue: SyncQueue | null = null

/**
 * Get or create the global sync queue instance
 */
export function getSyncQueue(config?: SyncQueueConfig): SyncQueue {
  if (!globalSyncQueue) {
    globalSyncQueue = new SyncQueue(config)
  }
  return globalSyncQueue
}

/**
 * Reset the global sync queue (for testing)
 */
export function resetSyncQueue(): void {
  if (globalSyncQueue) {
    globalSyncQueue.stop()
    globalSyncQueue = null
  }
}
