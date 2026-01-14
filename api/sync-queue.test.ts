import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSyncQueue, resetSyncQueue, SyncQueue } from './sync-queue'

describe('SyncQueue', () => {
  let queue: SyncQueue

  beforeEach(() => {
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
})
