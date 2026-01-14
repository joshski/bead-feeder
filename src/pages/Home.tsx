import { useNavigate } from 'react-router'
import GitHubLoginButton from '../components/GitHubLoginButton'
import RepositorySelector from '../components/RepositorySelector'
import { useAuth } from '../context/AuthContext'

interface Repository {
  owner: string
  repo: string
  branch?: string
}

export default function Home() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  const handleSelectRepo = (repo: Repository) => {
    navigate(`/repos/${repo.owner}/${repo.repo}`)
  }

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.welcomeCard}>
          <h2 style={styles.welcomeTitle}>Welcome to Bead Feeder</h2>
          <p style={styles.welcomeText}>
            Visualize and manage your project dependencies with an interactive
            DAG view. Connect with GitHub to get started.
          </p>
          <GitHubLoginButton />
        </div>
      </div>
    )
  }

  return <RepositorySelector onSelect={handleSelectRepo} />
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
    maxWidth: '400px',
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
}
