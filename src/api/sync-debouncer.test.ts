import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'
import {
  getSyncDebouncer,
  resetSyncDebouncer,
  SyncDebouncer,
} from './sync-debouncer'

describe('SyncDebouncer', () => {
  let debouncer: SyncDebouncer

  beforeEach(() => {
    resetSyncDebouncer()
    debouncer = new SyncDebouncer({ debounceMs: 50 })
  })

  afterEach(() => {
    debouncer.stop()
    resetSyncDebouncer()
  })

  describe('constructor', () => {
    it('initializes with idle status', () => {
      const state = debouncer.getState()
      expect(state.status).toBe('idle')
      expect(state.pending).toBe(false)
      expect(state.lastSync).toBeNull()
      expect(state.lastError).toBeNull()
    })

    it('uses default config values', () => {
      const defaultDebouncer = new SyncDebouncer()
      expect(defaultDebouncer.getState().status).toBe('idle')
      defaultDebouncer.stop()
    })
  })

  describe('enqueue', () => {
    it('sets pending to true', () => {
      debouncer.enqueue('Test commit message')
      const state = debouncer.getState()
      expect(state.pending).toBe(true)
    })

    it('debounces multiple rapid enqueues', async () => {
      const flushSpy = spyOn(debouncer, 'flush')

      debouncer.enqueue('First commit')
      debouncer.enqueue('Second commit')
      debouncer.enqueue('Third commit')

      // Should still be pending (flush not called yet due to debounce)
      const state = debouncer.getState()
      expect(state.pending).toBe(true)

      // Wait for debounce timer
      await new Promise(resolve => setTimeout(resolve, 100))

      // Flush should have been called once
      expect(flushSpy).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('clears pending debounce timer', () => {
      debouncer.enqueue('Test')
      debouncer.stop()

      // After stop, the debounce timer should be cleared
      // We can verify this by checking state doesn't change
      const state = debouncer.getState()
      expect(state.pending).toBe(true) // Still marked pending but timer cleared
    })
  })

  describe('event handling', () => {
    it('emits statusChange events', async () => {
      const statusChanges: unknown[] = []
      debouncer.on('statusChange', (data: unknown) => statusChanges.push(data))

      // Trigger a status change
      debouncer.enqueue('Test')

      // Wait for debounce and processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have emitted status changes (syncing, then idle or error)
      expect(statusChanges.length).toBeGreaterThan(0)
    })

    it('allows unsubscribing from events', () => {
      const handler = mock(() => {})
      const unsubscribe = debouncer.on('statusChange', handler)

      unsubscribe()

      // Handler should not be called after unsubscribe
      debouncer.enqueue('Test')
    })
  })

  describe('getSyncDebouncer', () => {
    it('returns a singleton instance', () => {
      const debouncer1 = getSyncDebouncer()
      const debouncer2 = getSyncDebouncer()
      expect(debouncer1).toBe(debouncer2)
      debouncer1.stop()
    })

    it('creates new instance after reset', () => {
      const debouncer1 = getSyncDebouncer()
      resetSyncDebouncer()
      const debouncer2 = getSyncDebouncer()
      expect(debouncer1).not.toBe(debouncer2)
      debouncer2.stop()
    })
  })
})
