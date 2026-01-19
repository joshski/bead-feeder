import { Link, Outlet, useLocation, useParams } from 'react-router'
import GitHubLoginButton, { GitHubIcon } from './components/GitHubLoginButton'
import SyncStatusIndicator from './components/SyncStatusIndicator'
import ToastContainer from './components/Toast'
import { Button } from './components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover'
import { useAuth } from './context/AuthContext'
import { useSyncStatus } from './context/SyncContext'
import iconImage from './public/icon-128.png'

function App() {
  const { user, isLoading, logout } = useAuth()
  const { owner, repo } = useParams<{ owner?: string; repo?: string }>()
  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const {
    status,
    lastSyncTime,
    errorMessage,
    conflictInfo,
    toasts,
    dismissToast,
    resolveConflict,
    onRefresh,
  } = useSyncStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {!isHomePage && (
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
              <img
                src={iconImage}
                alt="Bead Feeder"
                style={{ height: '32px', width: 'auto' }}
              />
            </Link>
            {owner && repo && (
              <>
                <nav
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span style={{ color: '#9ca3af' }}>
                    <GitHubIcon size={16} />
                  </span>
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
                  onRefresh={onRefresh ?? undefined}
                />
              </>
            )}
          </div>
          <div>
            {isLoading ? null : user ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="cursor-pointer bg-transparent border-none p-0"
                    data-testid="user-menu-trigger"
                  >
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-8 h-8 rounded-full"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">
                      {user.name || user.login}
                    </div>
                    <div className="text-xs text-gray-500">@{user.login}</div>
                    <hr className="my-2" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="w-full"
                      data-testid="logout-button"
                    >
                      Logout
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <GitHubLoginButton />
            )}
          </div>
        </header>
      )}
      <main style={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
