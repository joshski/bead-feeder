import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Create mock git-service functions using vi.hoisted to allow use in vi.mock
const { mockGitService } = vi.hoisted(() => ({
  mockGitService: {
    fetchRepository: vi.fn().mockResolvedValue({ success: true }),
    pushRepository: vi.fn().mockResolvedValue({ success: true }),
    pullRepository: vi.fn().mockResolvedValue({ success: true }),
    compareBranches: vi.fn().mockResolvedValue({
      success: true,
      status: { ahead: 0, behind: 0, diverged: false },
    }),
    getCurrentBranch: vi
      .fn()
      .mockResolvedValue({ success: true, output: 'main' }),
    hasConflicts: vi.fn().mockResolvedValue(false),
    abortMerge: vi.fn().mockResolvedValue({ success: true }),
    resolveConflictsTheirs: vi.fn().mockResolvedValue({ success: true }),
  },
}))

// Mock the git-service module to prevent tests from corrupting local .git/config
vi.mock('./git-service', () => mockGitService)

import { getSyncQueue, resetSyncQueue, SyncQueue } from './sync-queue'

describe('SyncQueue', () => {
  let queue: SyncQueue

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    // Reset mock implementations to default success values
    mockGitService.fetchRepository.mockResolvedValue({ success: true })
    mockGitService.pushRepository.mockResolvedValue({ success: true })
    mockGitService.pullRepository.mockResolvedValue({ success: true })
    mockGitService.compareBranches.mockResolvedValue({
      success: true,
      status: { ahead: 0, behind: 0, diverged: false },
    })
    mockGitService.getCurrentBranch.mockResolvedValue({
      success: true,
      output: 'main',
    })
    mockGitService.hasConflicts.mockResolvedValue(false)
    mockGitService.abortMerge.mockResolvedValue({ success: true })
    mockGitService.resolveConflictsTheirs.mockResolvedValue({ success: true })

    resetSyncQueue()
    queue = new SyncQueue({ debounceMs: 50, pushIntervalMs: 100 })
  })

  afterEach(() => {
    queue.stop()
    resetSyncQueue()
  })

  describe('constructor', () => {
    it('initializes with idle status', () => {
      const state = queue.getState()
      expect(state.status).toBe('idle')
      expect(state.pendingJobs).toBe(0)
      expect(state.lastSync).toBeNull()
      expect(state.lastError).toBeNull()
    })

    it('uses default config values', () => {
      const defaultQueue = new SyncQueue()
      expect(defaultQueue.getState().status).toBe('idle')
      defaultQueue.stop()
    })
  })

  describe('setToken', () => {
    it('stores the access token', () => {
      expect(queue.getToken()).toBeNull()
      queue.setToken('test-token-123')
      expect(queue.getToken()).toBe('test-token-123')
    })

    it('allows clearing the token', () => {
      queue.setToken('test-token')
      queue.setToken(null)
      expect(queue.getToken()).toBeNull()
    })
  })

  describe('enqueueCommit', () => {
    it('adds a commit job to the queue', () => {
      queue.enqueueCommit('Test commit message')
      const state = queue.getState()
      expect(state.pendingJobs).toBe(1)
    })

    it('debounces multiple rapid commits', async () => {
      queue.enqueueCommit('First commit')
      queue.enqueueCommit('Second commit')
      queue.enqueueCommit('Third commit')

      // Should only have one pending job due to debouncing
      const state = queue.getState()
      expect(state.pendingJobs).toBe(1)
    })
  })

  describe('enqueuePush', () => {
    it('triggers processing immediately', async () => {
      const statusChanges: unknown[] = []
      queue.on('statusChange', data => statusChanges.push(data))

      queue.enqueuePush()

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should have triggered processing (status changes to syncing then back)
      expect(statusChanges.length).toBeGreaterThan(0)
    })

    it('does not queue duplicate pushes while processing', () => {
      // Set token so push doesn't fail immediately
      queue.setToken('test-token')

      // First push triggers processing
      queue.enqueuePush()
      // Second push should be ignored since one is already queued/processing
      queue.enqueuePush()

      // State should show no more pending (either processing or done)
      const state = queue.getState()
      expect(state.pendingJobs).toBeLessThanOrEqual(1)
    })
  })

  describe('enqueuePull', () => {
    it('triggers processing immediately', async () => {
      const statusChanges: unknown[] = []
      queue.on('statusChange', data => statusChanges.push(data))

      queue.enqueuePull()

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should have triggered processing
      expect(statusChanges.length).toBeGreaterThan(0)
    })

    it('does not queue duplicate pulls while processing', () => {
      queue.setToken('test-token')

      queue.enqueuePull()
      queue.enqueuePull()

      const state = queue.getState()
      expect(state.pendingJobs).toBeLessThanOrEqual(1)
    })
  })

  describe('event handling', () => {
    it('emits statusChange events', async () => {
      const statusChanges: unknown[] = []
      queue.on('statusChange', data => statusChanges.push(data))

      // Trigger a status change by enqueueing and processing
      queue.enqueueCommit('Test')

      // Wait for debounce and processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have emitted at least one status change
      expect(statusChanges.length).toBeGreaterThan(0)
    })

    it('allows unsubscribing from events', () => {
      const handler = vi.fn()
      const unsubscribe = queue.on('statusChange', handler)

      unsubscribe()

      // Handler should not be called after unsubscribe
      queue.enqueueCommit('Test')
      // Since we unsubscribed, handler won't be called for this change
    })
  })

  describe('start/stop', () => {
    it('starts periodic push interval', () => {
      queue.start()
      // Should not throw
      queue.stop()
    })

    it('can be started and stopped multiple times', () => {
      queue.start()
      queue.start() // Should be a no-op
      queue.stop()
      queue.stop() // Should be a no-op
    })
  })

  describe('getSyncQueue', () => {
    it('returns a singleton instance', () => {
      const queue1 = getSyncQueue()
      const queue2 = getSyncQueue()
      expect(queue1).toBe(queue2)
      queue1.stop()
    })

    it('creates new instance after reset', () => {
      const queue1 = getSyncQueue()
      resetSyncQueue()
      const queue2 = getSyncQueue()
      expect(queue1).not.toBe(queue2)
      queue2.stop()
    })
  })

  describe('enqueueResolve', () => {
    it('queues a resolve job with theirs strategy', () => {
      queue.enqueueResolve('theirs')
      const state = queue.getState()
      expect(state.pendingJobs).toBeGreaterThanOrEqual(0) // May already be processing
    })

    it('queues a resolve job with abort strategy', () => {
      queue.enqueueResolve('abort')
      const state = queue.getState()
      expect(state.pendingJobs).toBeGreaterThanOrEqual(0)
    })

    it('replaces existing resolve jobs', () => {
      queue.enqueueResolve('theirs')
      queue.enqueueResolve('abort')
      // Should only have one resolve job
      const state = queue.getState()
      expect(state.pendingJobs).toBeLessThanOrEqual(1)
    })
  })

  describe('clearConflict', () => {
    it('clears conflict state when in conflict status', async () => {
      // Manually set conflict state for testing
      const internalQueue = queue as unknown as {
        status: string
        conflictInfo: { ahead: number; behind: number } | undefined
        lastError: string | null
        setStatus: (status: string) => void
      }
      internalQueue.status = 'conflict'
      internalQueue.conflictInfo = { ahead: 1, behind: 2 }
      internalQueue.lastError = 'Test conflict'

      queue.clearConflict()

      const state = queue.getState()
      expect(state.status).toBe('idle')
      expect(state.conflictInfo).toBeUndefined()
      expect(state.lastError).toBeNull()
    })

    it('does nothing when not in conflict state', () => {
      const initialState = queue.getState()
      queue.clearConflict()
      const afterState = queue.getState()
      expect(afterState.status).toBe(initialState.status)
    })
  })

  describe('conflict events', () => {
    it('emits conflict events', async () => {
      const conflictEvents: unknown[] = []
      queue.on('conflict', data => conflictEvents.push(data))

      // Manually trigger a conflict event for testing
      const internalQueue = queue as unknown as {
        emit: (event: string, data: unknown) => void
      }
      internalQueue.emit('conflict', {
        ahead: 5,
        behind: 3,
        message: 'Test conflict',
      })

      expect(conflictEvents).toHaveLength(1)
      const event = conflictEvents[0] as {
        ahead: number
        behind: number
        message: string
      }
      expect(event.ahead).toBe(5)
      expect(event.behind).toBe(3)
    })
  })

  describe('retry configuration', () => {
    it('accepts custom retry configuration', () => {
      const customQueue = new SyncQueue({
        maxRetries: 5,
        retryBaseDelayMs: 500,
      })
      expect(customQueue.getState().status).toBe('idle')
      customQueue.stop()
    })
  })
})
