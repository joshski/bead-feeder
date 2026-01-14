import { useState } from 'react'
import type { IssueType } from './IssueNode'

interface CreateIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issue: CreateIssueData) => Promise<void>
}

export interface CreateIssueData {
  title: string
  description?: string
  type: IssueType
  priority: number
}

const typeOptions: { value: IssueType; label: string; icon: string }[] = [
  { value: 'task', label: 'Task', icon: '☐' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'feature', label: 'Feature', icon: '✨' },
]

const priorityOptions = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
]

function CreateIssueModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>('task')
  const [priority, setPriority] = useState(2)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
      })
      setTitle('')
      setDescription('')
      setType('task')
      setPriority(2)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
    } finally {
      setIsSubmitting(false)
    }
  }

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
      aria-labelledby="modal-title"
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
      data-testid="modal-backdrop"
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
        data-testid="create-issue-modal"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            id="modal-title"
            style={{ margin: 0, fontSize: '20px', color: '#1f2937' }}
          >
            Create Issue
          </h2>
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
            }}
            aria-label="Close modal"
            data-testid="close-modal-button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="title"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter issue title"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
              data-testid="title-input"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="description"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter issue description (optional)"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              data-testid="description-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="type"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                }}
              >
                Type
              </label>
              <select
                id="type"
                value={type}
                onChange={e => setType(e.target.value as IssueType)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
                data-testid="type-select"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label
                htmlFor="priority"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                }}
              >
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
                data-testid="priority-select"
              >
                {priorityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '16px',
              }}
              data-testid="error-message"
            >
              {error}
            </div>
          )}

          <div
            style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
          >
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
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: isSubmitting ? '#9ca3af' : '#3b82f6',
                color: '#ffffff',
                fontSize: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
              data-testid="submit-button"
            >
              {isSubmitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateIssueModal
