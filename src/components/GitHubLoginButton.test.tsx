import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })
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

  it('logs error when client ID is not configured', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<GitHubLoginButton />)
    const button = screen.getByRole('button', { name: /sign in with github/i })
    fireEvent.click(button)

    // Without VITE_GITHUB_CLIENT_ID, it should log an error
    expect(consoleSpy).toHaveBeenCalledWith(
      'VITE_GITHUB_CLIENT_ID is not configured'
    )

    consoleSpy.mockRestore()
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
