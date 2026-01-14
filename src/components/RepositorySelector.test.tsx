import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RepositorySelector from './RepositorySelector'

describe('RepositorySelector', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    expect(screen.getByText('Loading repositories...')).toBeInTheDocument()
  })

  it('shows error message when fetch fails', async () => {
    global.fetch = vi.fn(() =>
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
    global.fetch = vi.fn(() =>
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

    global.fetch = vi.fn(url => {
      if (
        (url as string).includes('/api/repos') &&
        !(url as string).includes('has-beads')
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ repos: mockRepos }),
        })
      }
      // has-beads endpoints
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hasBeads: false }),
      })
    }) as unknown as typeof fetch

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

    global.fetch = vi.fn(url => {
      if (
        (url as string).includes('/api/repos') &&
        !(url as string).includes('has-beads')
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ repos: mockRepos }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hasBeads: false }),
      })
    }) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('user1/repo1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('user1/repo1'))

    expect(mockOnSelect).toHaveBeenCalledWith({
      owner: 'user1',
      repo: 'repo1',
      branch: 'main',
      hasBeads: false,
    })
  })

  it('separates repos with beads from repos without', async () => {
    const mockRepos = [
      { owner: 'user1', repo: 'with-beads', branch: 'main' },
      { owner: 'user2', repo: 'without-beads', branch: 'main' },
    ]

    global.fetch = vi.fn(url => {
      if (
        (url as string).includes('/api/repos') &&
        !(url as string).includes('has-beads')
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ repos: mockRepos }),
        })
      }
      // has-beads check
      if ((url as string).includes('with-beads')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasBeads: true }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hasBeads: false }),
      })
    }) as unknown as typeof fetch

    render(<RepositorySelector onSelect={mockOnSelect} />)

    await waitFor(() => {
      expect(screen.getByText('Repositories with Beads')).toBeInTheDocument()
    })

    expect(screen.getByText('user1/with-beads')).toBeInTheDocument()
    expect(screen.getByText('user2/without-beads')).toBeInTheDocument()
  })

  it('retries fetch when retry button is clicked', async () => {
    let callCount = 0
    global.fetch = vi.fn(() => {
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
