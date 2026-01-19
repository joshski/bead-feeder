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
  afterEach(() => {
    cleanup()
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

  it('renders the heading on non-home routes', () => {
    render(
      <MemoryRouter initialEntries={['/local?path=/tmp/test']}>
        <AuthProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Bead Feeder' })).toBeDefined()
  })
})
