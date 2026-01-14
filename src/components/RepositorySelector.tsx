import { useCallback, useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Repository {
  owner: string
  repo: string
  branch?: string
}

interface RepositoryWithBeads extends Repository {
  hasBeads: boolean
}

interface RepositorySelectorProps {
  onSelect: (repo: Repository) => void
}

export default function RepositorySelector({
  onSelect,
}: RepositorySelectorProps) {
  const [repos, setRepos] = useState<RepositoryWithBeads[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingBeads, setCheckingBeads] = useState<Set<string>>(new Set())

  const checkBeadsDirectory = useCallback(
    async (owner: string, repo: string) => {
      const key = `${owner}/${repo}`
      setCheckingBeads(prev => new Set(prev).add(key))

      try {
        const response = await fetch(
          `${API_URL}/api/repos/${owner}/${repo}/has-beads`,
          { credentials: 'include' }
        )

        if (response.ok) {
          const data = (await response.json()) as { hasBeads: boolean }
          setRepos(prev =>
            prev.map(r =>
              r.owner === owner && r.repo === repo
                ? { ...r, hasBeads: data.hasBeads }
                : r
            )
          )
        }
      } catch {
        // Silently ignore errors checking for .beads
      } finally {
        setCheckingBeads(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    },
    []
  )

  const fetchRepos = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/repos`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to view your repositories')
        }
        throw new Error('Failed to fetch repositories')
      }

      const data = (await response.json()) as { repos: Repository[] }
      // Initialize repos without beads info yet
      setRepos(data.repos.map(r => ({ ...r, hasBeads: false })))

      // Check each repo for .beads directory
      for (const repo of data.repos) {
        checkBeadsDirectory(repo.owner, repo.repo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [checkBeadsDirectory])

  useEffect(() => {
    fetchRepos()
  }, [fetchRepos])

  const beadsRepos = repos.filter(r => r.hasBeads)
  const otherRepos = repos.filter(r => !r.hasBeads)
  const isCheckingAny = checkingBeads.size > 0

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading repositories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button type="button" onClick={fetchRepos} style={styles.retryButton}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Select a Repository</h2>

      {beadsRepos.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionHeading}>
            Repositories with Beads
            <span style={styles.badge}>{beadsRepos.length}</span>
          </h3>
          <ul style={styles.repoList}>
            {beadsRepos.map(repo => (
              <li key={`${repo.owner}/${repo.repo}`} style={styles.repoItem}>
                <button
                  type="button"
                  onClick={() => onSelect(repo)}
                  style={styles.repoButton}
                >
                  <span style={styles.repoName}>
                    {repo.owner}/{repo.repo}
                  </span>
                  {repo.branch && (
                    <span style={styles.branch}>{repo.branch}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={styles.section}>
        <h3 style={styles.sectionHeading}>
          Other Repositories
          {isCheckingAny && (
            <span style={styles.checkingIndicator}>checking...</span>
          )}
        </h3>
        {otherRepos.length === 0 && !isCheckingAny ? (
          <p style={styles.emptyMessage}>
            No other repositories found. All your repos have beads!
          </p>
        ) : (
          <ul style={styles.repoList}>
            {otherRepos.map(repo => (
              <li key={`${repo.owner}/${repo.repo}`} style={styles.repoItem}>
                <button
                  type="button"
                  onClick={() => onSelect(repo)}
                  style={styles.repoButtonSecondary}
                >
                  <span style={styles.repoName}>
                    {repo.owner}/{repo.repo}
                  </span>
                  {repo.branch && (
                    <span style={styles.branch}>{repo.branch}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '24px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeading: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#666',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    backgroundColor: '#2563eb',
    color: 'white',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 500,
  },
  checkingIndicator: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#999',
    fontStyle: 'italic',
  },
  repoList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  repoItem: {
    marginBottom: '8px',
  },
  repoButton: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  repoButtonSecondary: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  repoName: {
    fontWeight: 500,
    fontSize: '14px',
  },
  branch: {
    fontSize: '12px',
    color: '#666',
    backgroundColor: '#e5e5e5',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#666',
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyMessage: {
    color: '#666',
    fontStyle: 'italic',
  },
}
