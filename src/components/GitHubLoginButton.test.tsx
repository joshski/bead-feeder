import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GitHubLoginButton from './GitHubLoginButton'

// Mock crypto.getRandomValues
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
  },
})

describe('GitHubLoginButton', () => {
  const mockSessionStorage = {
    setItem: mock(() => {}),
    getItem: mock(() => null),
    removeItem: mock(() => {}),
  }

  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the login button', () => {
    render(<GitHubLoginButton />)
    expect(
      screen.getByRole('button', { name: /sign in with github/i })
    ).toBeInTheDocument()
  })

  it('contains GitHub icon', () => {
    render(<GitHubLoginButton />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('stores OAuth state in sessionStorage when clicked', () => {
    render(<GitHubLoginButton />)
    const button = screen.getByRole('button', { name: /sign in with github/i })
    fireEvent.click(button)

    // Should store the OAuth state for CSRF protection
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'oauth_state',
      expect.any(String)
    )
  })

  it('applies custom className', () => {
    render(<GitHubLoginButton className="custom-class" />)
    const button = screen.getByRole('button', { name: /sign in with github/i })
    expect(button).toHaveClass('custom-class')
  })

  it('has inline styles', () => {
    render(<GitHubLoginButton />)
    const button = screen.getByRole('button', { name: /sign in with github/i })
    // Check that button has style attribute (inline styles)
    expect(button).toHaveAttribute('style')
  })
})
