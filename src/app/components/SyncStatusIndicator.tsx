export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'conflict'

export interface ConflictInfo {
  ahead: number
  behind: number
}

export interface SyncStatusIndicatorProps {
  status: SyncStatus
  lastSyncTime?: number | null
  errorMessage?: string | null
  conflictInfo?: ConflictInfo | null
  onResolve?: (resolution: 'theirs' | 'ours' | 'abort') => void
  onRefresh?: () => void
}

const statusStyles: Record<SyncStatus, { color: string; label: string }> = {
  synced: { color: '#22c55e', label: 'Synced' },
  syncing: { color: '#3b82f6', label: 'Syncing...' },
  pending: { color: '#f59e0b', label: 'Pending changes' },
  error: { color: '#ef4444', label: 'Sync error' },
  conflict: { color: '#ef4444', label: 'Conflict' },
}

function formatLastSync(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  if (hours < 24) {
    return `${hours}h ago`
  }
  return new Date(timestamp).toLocaleDateString()
}

function SyncStatusIndicator({
  status,
  lastSyncTime,
  errorMessage,
  conflictInfo,
  onResolve,
  onRefresh,
}: SyncStatusIndicatorProps) {
  const { color, label } = statusStyles[status]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px',
        borderRadius: '16px',
        backgroundColor: status === 'conflict' ? '#fef2f2' : '#f3f4f6',
        fontSize: '13px',
      }}
      title={
        errorMessage ||
        (lastSyncTime
          ? `Last synced: ${formatLastSync(lastSyncTime)}`
          : undefined)
      }
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          animation: status === 'syncing' ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ color: '#374151' }}>{label}</span>
      {status === 'conflict' && conflictInfo && (
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
          ({conflictInfo.ahead} ahead, {conflictInfo.behind} behind)
        </span>
      )}
      {status === 'conflict' && onResolve && (
        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
          <button
            type="button"
            onClick={() => onResolve('theirs')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            title="Accept remote changes and discard local conflicts"
          >
            Pull
          </button>
          <button
            type="button"
            onClick={() => onResolve('abort')}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            title="Abort the merge and revert to previous state"
          >
            Abort
          </button>
        </div>
      )}
      {lastSyncTime && status === 'synced' && (
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
          {formatLastSync(lastSyncTime)}
        </span>
      )}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={status === 'syncing'}
          data-testid="refresh-button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            cursor: status === 'syncing' ? 'not-allowed' : 'pointer',
            opacity: status === 'syncing' ? 0.5 : 1,
            color: '#6b7280',
          }}
          title="Refresh"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation:
                status === 'syncing' ? 'spin 1s linear infinite' : undefined,
            }}
          >
            <title>Refresh</title>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default SyncStatusIndicator
