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
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default SyncStatusIndicator
