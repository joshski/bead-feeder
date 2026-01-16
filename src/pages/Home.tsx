import { useState } from 'react'
import { useNavigate } from 'react-router'
import GitHubLoginButton from '../components/GitHubLoginButton'
import LocalRepoSelector from '../components/LocalRepoSelector'
import RepositorySelector from '../components/RepositorySelector'
import { useAuth } from '../context/AuthContext'

interface Repository {
  owner: string
  repo: string
  branch?: string
}

interface LocalRepository {
  name: string
  path: string
}

type RepoMode = 'choose' | 'local' | 'github'

export default function Home() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<RepoMode>('choose')

  const handleSelectGitHubRepo = (repo: Repository) => {
    navigate(`/repos/${repo.owner}/${repo.repo}`)
  }

  const handleSelectLocalRepo = (repo: LocalRepository) => {
    // Encode the path for URL safety
    const encodedPath = encodeURIComponent(repo.path)
    navigate(`/local?path=${encodedPath}`)
  }

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  // Show mode chooser
  if (mode === 'choose') {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeCard}>
          <h2 style={styles.welcomeTitle}>Welcome to Bead Feeder</h2>
          <p style={styles.welcomeText}>
            Visualize and manage your project dependencies with an interactive
            DAG view.
          </p>
          <div style={styles.modeButtons}>
            <button
              type="button"
              onClick={() => setMode('local')}
              style={styles.modeButton}
            >
              <span style={styles.modeIcon}>📁</span>
              <span style={styles.modeLabel}>Local Repository</span>
              <span style={styles.modeDescription}>
                Open a beads project on this machine
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('github')}
              style={{ ...styles.modeButton, ...styles.modeButtonGitHub }}
            >
              <span style={styles.modeIcon}>🐙</span>
              <span style={styles.modeLabel}>GitHub Repository</span>
              <span style={styles.modeDescription}>
                {user ? 'Browse your GitHub repos' : 'Sign in with GitHub'}
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show local repo selector
  if (mode === 'local') {
    return (
      <div>
        <div style={styles.backBar}>
          <button
            type="button"
            onClick={() => setMode('choose')}
            style={styles.backButton}
          >
            ← Back
          </button>
        </div>
        <LocalRepoSelector onSelect={handleSelectLocalRepo} />
      </div>
    )
  }

  // Show GitHub repo selector
  if (mode === 'github') {
    if (!user) {
      return (
        <div style={styles.container}>
          <div style={styles.backBar}>
            <button
              type="button"
              onClick={() => setMode('choose')}
              style={styles.backButton}
            >
              ← Back
            </button>
          </div>
          <div style={styles.welcomeCard}>
            <h2 style={styles.welcomeTitle}>GitHub Repositories</h2>
            <p style={styles.welcomeText}>
              Sign in with GitHub to browse and select your repositories.
            </p>
            <GitHubLoginButton />
          </div>
        </div>
      )
    }
    return (
      <div>
        <div style={styles.backBar}>
          <button
            type="button"
            onClick={() => setMode('choose')}
            style={styles.backButton}
          >
            ← Back
          </button>
        </div>
        <RepositorySelector onSelect={handleSelectGitHubRepo} />
      </div>
    )
  }

  return null
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'calc(100vh - 100px)',
    padding: '24px',
  },
  loading: {
    color: '#666',
  },
  welcomeCard: {
    maxWidth: '500px',
    textAlign: 'center',
    padding: '48px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  welcomeTitle: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  welcomeText: {
    color: '#666',
    marginBottom: '24px',
    lineHeight: 1.6,
  },
  modeButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  modeButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '16px 20px',
    backgroundColor: '#f0fdf4',
    border: '2px solid #bbf7d0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  },
  modeButtonGitHub: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bfdbfe',
  },
  modeIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  modeLabel: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  modeDescription: {
    fontSize: '14px',
    color: '#666',
  },
  backBar: {
    padding: '16px 24px',
    borderBottom: '1px solid #e5e5e5',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#525252',
  },
}
