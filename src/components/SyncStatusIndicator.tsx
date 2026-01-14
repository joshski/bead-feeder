export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error'

export interface SyncStatusIndicatorProps {
  status: SyncStatus
  lastSyncTime?: number | null
  errorMessage?: string | null
}

const statusStyles: Record<SyncStatus, { color: string; label: string }> = {
  synced: { color: '#22c55e', label: 'Synced' },
  syncing: { color: '#3b82f6', label: 'Syncing...' },
  pending: { color: '#f59e0b', label: 'Pending changes' },
  error: { color: '#ef4444', label: 'Sync error' },
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
        backgroundColor: '#f3f4f6',
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
