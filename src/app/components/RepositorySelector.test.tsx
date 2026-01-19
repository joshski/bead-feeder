import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import RepositorySelector from './RepositorySelector'

describe('RepositorySelector', () => {
  const mockOnSelect = mock(() => {})
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('shows loading state initially', () => {
    globalThis.fetch = mock(
      () => new Promise(() => {})
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    expect(screen.getByText('Loading repositories...')).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch repositories')
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows authentication error for 401 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
      })
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(
        screen.getByText('Please sign in to view your repositories')
      ).toBeInTheDocument()
    })
  })

  it('displays repositories after successful fetch', async () => {
    const mockRepos = [
      { owner: 'user1', repo: 'repo1', branch: 'main' },
      { owner: 'user2', repo: 'repo2', branch: 'develop' },
    ]

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ repos: mockRepos }),
      })
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('user1/repo1')).toBeInTheDocument()
    })

    expect(screen.getByText('user2/repo2')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('develop')).toBeInTheDocument()
  })

  it('calls onSelect when a repository is clicked', async () => {
    const mockRepos = [{ owner: 'user1', repo: 'repo1', branch: 'main' }]

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ repos: mockRepos }),
      })
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('user1/repo1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('user1/repo1'))

    expect(mockOnSelect).toHaveBeenCalledWith({
      owner: 'user1',
      repo: 'repo1',
      branch: 'main',
    })
  })

  it('displays GitHub icon in the heading', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ repos: [] }),
      })
    ) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('Select a Repository')).toBeInTheDocument()
    })

    // Check that the heading contains an SVG (the GitHub icon)
    const heading = screen.getByText('Select a Repository')
    const svg = heading.parentElement?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('retries fetch when retry button is clicked', async () => {
    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ repos: [] }),
      })
    }) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Select a Repository')).toBeInTheDocument()
    })
  })
})
