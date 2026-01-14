import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
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
  it('renders the heading', () => {
    // Mock EventSource and fetch for contexts
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ user: null }),
      })
    )

    render(
      <MemoryRouter>
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
