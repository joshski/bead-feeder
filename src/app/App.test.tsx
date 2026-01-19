import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'

// Mock EventSource for SyncContext
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close() {}
}

describe('App', () => {
  // Store original globals to restore after tests
  const originalFetch = globalThis.fetch
  const originalEventSource = globalThis.EventSource

  afterEach(() => {
    cleanup()
    // Restore original globals to avoid polluting other tests
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  })

  beforeEach(() => {
    // Mock EventSource and fetch for contexts
    Object.defineProperty(globalThis, 'EventSource', {
      value: MockEventSource,
      writable: true,
    })
    // @ts-expect-error - mock fetch doesn't need all properties
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ issues: [], dependencies: [] }),
      } as Response)
    )
  })

  it('renders the logo on non-home routes', () => {
    render(
      <MemoryRouter initialEntries={['/local?path=/tmp/test']}>
        <AuthProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByRole('img', { name: 'Bead Feeder' })).toBeDefined()
  })
})
