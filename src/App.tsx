import { Link, Outlet, useParams } from 'react-router'
import GitHubLoginButton from './components/GitHubLoginButton'
import SyncStatusIndicator from './components/SyncStatusIndicator'
import ToastContainer from './components/Toast'
import { useAuth } from './context/AuthContext'
import { useSyncStatus } from './context/SyncContext'

function App() {
  const { user, isLoading, logout } = useAuth()
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>()
  const {
    status,
    lastSyncTime,
    errorMessage,
    conflictInfo,
    toasts,
    dismissToast,
    resolveConflict,
  } = useSyncStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          flexShrink: 0,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Bead Feeder</h1>
          </Link>
          {owner && repo && (
            <>
              <nav
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ color: '#9ca3af' }}>/</span>
                <span style={{ fontWeight: 500, color: '#374151' }}>
                  {owner}/{repo}
                </span>
              </nav>
              <SyncStatusIndicator
                status={status}
                lastSyncTime={lastSyncTime}
                errorMessage={errorMessage}
                conflictInfo={conflictInfo}
                onResolve={resolveConflict}
              />
            </>
          )}
        </div>
        <div>
          {isLoading ? null : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user.avatar_url}
                alt={user.login}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
              <span style={{ color: '#374151' }}>
                {user.name || user.login}
              </span>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
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
      <main style={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
