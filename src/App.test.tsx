import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './context/AuthContext'

describe('App', () => {
  it('renders the heading', () => {
    // Mock fetch for auth context
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ user: null }),
      })
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Bead Feeder' })).toBeDefined()
  })
})
