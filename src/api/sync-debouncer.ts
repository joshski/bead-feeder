import { spawn } from 'node:child_process'
import * as log from './logger'

export interface SyncDebouncerConfig {
  /** Debounce delay in milliseconds before processing commits (default: 2000) */
  debounceMs?: number
  /** Working directory for git operations */
  cwd?: string
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

export interface SyncDebouncerState {
  status: SyncStatus
  lastSync: number | null
  lastError: string | null
  pending: boolean
}

type SyncEventType = 'statusChange' | 'syncComplete' | 'syncError'
type SyncEventHandler = (data: unknown) => void

/**
 * Simple debouncer for git sync operations.
 * After a change, waits for debounce period then:
 * 1. Commits local .beads changes
 * 2. Runs `bd sync` to handle pull/merge/push
 *
 * This leverages bd's built-in 3-way merge algorithm instead of
 * reimplementing git conflict resolution.
 */
export class SyncDebouncer {
  private status: SyncStatus = 'idle'
  private lastSync: number | null = null
  private lastError: string | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pending = false
  private processing = false
  private pendingMessage: string | null = null
  private config: { debounceMs: number; cwd: string }
  private eventHandlers: Map<SyncEventType, Set<SyncEventHandler>> = new Map()

  constructor(config: SyncDebouncerConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 2000,
      cwd: config.cwd ?? process.cwd(),
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
   * Get the current state of the sync debouncer
   */
  getState(): SyncDebouncerState {
    return {
      status: this.status,
      lastSync: this.lastSync,
      lastError: this.lastError,
      pending: this.pending,
    }
  }

  /**
   * Stop any pending sync operations
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * Queue a sync after a change.
   * Multiple rapid calls will be debounced into a single sync.
   * @param message - Commit message for the changes
   */
  enqueue(message: string): void {
    this.pending = true
    this.pendingMessage = message

    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Debounce: wait before processing
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.flush()
    }, this.config.debounceMs)
  }

  /**
   * Immediately flush pending changes without waiting for debounce.
   * Useful when you need to ensure changes are synced before continuing.
   */
  async flush(): Promise<void> {
    if (!this.pending || this.processing) {
      return
    }

    this.processing = true
    this.pending = false
    const message = this.pendingMessage || 'Update beads'
    this.pendingMessage = null

    // Clear debounce timer if flush was called manually
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.setStatus('syncing')

    try {
      // Step 1: Stage .beads directory changes
      await this.runGitCommand(['add', '.beads'])

      // Step 2: Check if there are staged changes
      const statusResult = await this.runGitCommand([
        'diff',
        '--cached',
        '--quiet',
      ])

      // Exit code 1 means there are changes, 0 means no changes
      if (statusResult.exitCode !== 0) {
        // Step 3: Commit the changes
        await this.runGitCommand(['commit', '-m', message])
        log.info(`Committed beads changes: ${message}`)
      }

      // Step 4: Run bd sync to handle pull/merge
      // Use --no-push because for remote repos, we need to push with explicit token auth
      await this.runBdCommand(['sync', '--no-push'])
      log.info('bd sync completed successfully')

      this.lastSync = Date.now()
      this.lastError = null
      this.setStatus('idle')
      this.emit('syncComplete', { timestamp: this.lastSync })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.lastError = errorMessage
      this.setStatus('error')
      this.emit('syncError', { error: errorMessage })
      log.error(`Sync failed: ${errorMessage}`)
    } finally {
      this.processing = false
    }
  }

  /**
   * Run a git command and return the result
   */
  private runGitCommand(
    args: string[]
  ): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd: this.config.cwd })

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

  /**
   * Run a bd command
   */
  private runBdCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('bd', args, {
        cwd: this.config.cwd,
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
        if (code === 0 && !stderr.startsWith('Error')) {
          resolve(stdout)
        } else {
          reject(
            new Error(stderr || stdout || `bd command failed with code ${code}`)
          )
        }
      })

      proc.on('error', err => {
        reject(err)
      })
    })
  }
}

// Map of sync debouncers keyed by working directory
// Each repo (cwd) gets its own debouncer to avoid conflicts between users/repos
const syncDebouncers: Map<string, SyncDebouncer> = new Map()

/**
 * Get or create a sync debouncer for the given working directory.
 * Each cwd gets its own debouncer to avoid conflicts between users/repos.
 */
export function getSyncDebouncer(config?: SyncDebouncerConfig): SyncDebouncer {
  const cwd = config?.cwd ?? process.cwd()

  let debouncer = syncDebouncers.get(cwd)
  if (!debouncer) {
    debouncer = new SyncDebouncer(config)
    syncDebouncers.set(cwd, debouncer)
  }
  return debouncer
}

/**
 * Reset all sync debouncers (for testing)
 */
export function resetSyncDebouncer(): void {
  for (const debouncer of syncDebouncers.values()) {
    debouncer.stop()
  }
  syncDebouncers.clear()
}
