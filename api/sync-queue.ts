import { spawn } from 'node:child_process'
import { getCurrentBranch, pullRepository, pushRepository } from './git-service'

export interface SyncJob {
  id: string
  type: 'commit' | 'push' | 'pull'
  message?: string
  createdAt: number
}

export interface SyncQueueConfig {
  /** Debounce delay in milliseconds before processing commits (default: 2000) */
  debounceMs?: number
  /** Interval in milliseconds for periodic push (default: 30000) */
  pushIntervalMs?: number
  /** Working directory for git operations */
  cwd?: string
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

export interface SyncQueueState {
  status: SyncStatus
  pendingJobs: number
  lastSync: number | null
  lastError: string | null
}

type SyncEventType = 'statusChange' | 'syncComplete' | 'syncError'
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
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pushInterval: ReturnType<typeof setInterval> | null = null
  private processing = false
  private token: string | null = null
  private config: Required<SyncQueueConfig>
  private eventHandlers: Map<SyncEventType, Set<SyncEventHandler>> = new Map()
  private hasPendingChanges = false

  constructor(config: SyncQueueConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 2000,
      pushIntervalMs: config.pushIntervalMs ?? 30000,
      cwd: config.cwd ?? process.cwd(),
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
    const { cwd } = this.config

    switch (job.type) {
      case 'commit':
        await this.executeCommit(job.message || 'Update graph')
        break

      case 'push': {
        if (!this.token) {
          throw new Error('No access token available for push')
        }
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
          throw new Error(`Push failed: ${pushResult.error}`)
        }
        this.hasPendingChanges = false
        break
      }

      case 'pull': {
        if (!this.token) {
          throw new Error('No access token available for pull')
        }
        const pullResult = await pullRepository(cwd, this.token)
        if (!pullResult.success) {
          throw new Error(`Pull failed: ${pullResult.error}`)
        }
        break
      }
    }
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
