import type { IssueNodeData } from './IssueNode'

interface IssueDetailModalProps {
  issue: IssueNodeData | null
  onClose: () => void
}

const statusColors: Record<string, string> = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  closed: '#22c55e',
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
}

const typeIcons: Record<string, string> = {
  task: '☐',
  bug: '🐛',
  feature: '✨',
}

const typeLabels: Record<string, string> = {
  task: 'Task',
  bug: 'Bug',
  feature: 'Feature',
}

const priorityColors: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#6b7280',
}

const priorityLabels: Record<string, string> = {
  P0: 'P0 - Critical',
  P1: 'P1 - High',
  P2: 'P2 - Medium',
  P3: 'P3 - Low',
}

function IssueDetailModal({ issue, onClose }: IssueDetailModalProps) {
  if (!issue) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-detail-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="issue-detail-backdrop"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        data-testid="issue-detail-modal"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <div style={{ flex: 1 }}>
            <h2
              id="issue-detail-title"
              style={{ margin: 0, fontSize: '20px', color: '#1f2937' }}
              data-testid="issue-detail-title"
            >
              {issue.title}
            </h2>
            <div
              style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#6b7280',
                fontFamily: 'monospace',
              }}
              data-testid="issue-detail-id"
            >
              {issue.issueId}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              marginLeft: '16px',
            }}
            aria-label="Close modal"
            data-testid="close-issue-detail-button"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Status
            </div>
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '12px',
                backgroundColor: statusColors[issue.status] || '#6b7280',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
              }}
              data-testid="issue-detail-status"
            >
              {statusLabels[issue.status] || issue.status}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Type
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#374151',
              }}
              data-testid="issue-detail-type"
            >
              {typeIcons[issue.type] || '?'}{' '}
              {typeLabels[issue.type] || issue.type}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Priority
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: priorityColors[issue.priority] || '#6b7280',
              }}
              data-testid="issue-detail-priority"
            >
              {priorityLabels[issue.priority] || issue.priority}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
              color: '#374151',
            }}
            data-testid="close-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default IssueDetailModal
