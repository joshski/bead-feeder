import { useCallback, useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface LocalRepository {
  name: string
  path: string
}

interface LocalRepoSelectorProps {
  onSelect: (repo: LocalRepository) => void
}

export default function LocalRepoSelector({
  onSelect,
}: LocalRepoSelectorProps) {
  const [repos, setRepos] = useState<LocalRepository[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRepos = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/local-repos`)

      if (!response.ok) {
        throw new Error('Failed to fetch local repositories')
      }

      const data = (await response.json()) as { repos: LocalRepository[] }
      setRepos(data.repos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRepos()
  }, [fetchRepos])

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Scanning for local repositories...</div>
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
      <h2 style={styles.heading}>Select a Local Repository</h2>

      <section style={styles.section}>
        <h3 style={styles.sectionHeading}>
          Local Repositories
          <span style={styles.badge}>{repos.length}</span>
        </h3>
        {repos.length === 0 ? (
          <p style={styles.emptyMessage}>
            No local beads repositories found. Make sure you have a .beads
            directory in your project.
          </p>
        ) : (
          <ul style={styles.repoList}>
            {repos.map(repo => (
              <li key={repo.path} style={styles.repoItem}>
                <button
                  type="button"
                  onClick={() => onSelect(repo)}
                  style={styles.repoButton}
                >
                  <span style={styles.repoName}>{repo.name}</span>
                  <span style={styles.path}>{repo.path}</span>
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
    backgroundColor: '#16a34a',
    color: 'white',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 500,
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
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  repoName: {
    fontWeight: 500,
    fontSize: '14px',
  },
  path: {
    fontSize: '12px',
    color: '#666',
    backgroundColor: '#e5e5e5',
    padding: '2px 8px',
    borderRadius: '4px',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    backgroundColor: '#16a34a',
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
