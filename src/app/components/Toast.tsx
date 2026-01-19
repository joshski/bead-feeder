import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

export interface ToastProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
  duration?: number
}

const typeStyles: Record<
  ToastType,
  { backgroundColor: string; borderColor: string }
> = {
  success: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  error: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
  info: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
}

export function Toast({ toast, onDismiss, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setIsVisible(true), 10)

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, duration)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
    }
  }, [toast.id, duration, onDismiss])

  const { backgroundColor, borderColor } = typeStyles[toast.type]

  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor,
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '400px',
      }}
    >
      <span style={{ flex: 1, color: '#1f2937', fontSize: '14px' }}>
        {toast.message}
      </span>
      <button
        type="button"
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onDismiss(toast.id), 300)
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6b7280',
          fontSize: '18px',
          padding: '0 4px',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export interface ToastContainerProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 1000,
      }}
    >
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default ToastContainer
