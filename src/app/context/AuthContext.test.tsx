import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

// Test component that uses the auth context
function TestComponent() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div data-testid="user">{user ? user.login : 'Not logged in'}</div>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('provides initial loading state', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ user: null }),
      })
    ) as unknown as typeof fetch

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Initially loading
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  it('fetches user on mount', async () => {
    const mockFetch = mock(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            user: { login: 'testuser', id: 123, avatar_url: '', name: 'Test' },
          }),
      })
    ) as unknown as typeof fetch
    globalThis.fetch = mockFetch

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('handles no user', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        json: () => Promise.resolve({ user: null }),
      })
    ) as unknown as typeof fetch

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Not logged in')
    })
  })

  it('handles fetch error gracefully', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Not logged in')
    })
  })

  it('throws error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    )

    consoleSpy.mockRestore()
  })
})
