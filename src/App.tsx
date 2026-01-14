import { Link, Outlet, useParams } from 'react-router'
import GitHubLoginButton from './components/GitHubLoginButton'
import { useAuth } from './context/AuthContext'

function App() {
  const { user, isLoading, logout } = useAuth()
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>()

  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ margin: 0 }}>Bead Feeder</h1>
          </Link>
          {owner && repo && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#666' }}>/</span>
              <span style={{ fontWeight: 500 }}>
                {owner}/{repo}
              </span>
            </nav>
          )}
        </div>
        <div>
          {isLoading ? null : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src={user.avatar_url}
                alt={user.login}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
              <span>{user.name || user.login}</span>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <GitHubLoginButton />
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default App
