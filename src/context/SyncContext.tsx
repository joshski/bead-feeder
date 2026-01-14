import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type {
  ConflictInfo,
  SyncStatus,
} from '../components/SyncStatusIndicator'
import type { ToastMessage, ToastType } from '../components/Toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface SyncState {
  status: SyncStatus
  lastSyncTime: number | null
  errorMessage: string | null
  pendingChanges: boolean
  conflictInfo: ConflictInfo | null
}

interface SyncContextValue extends SyncState {
  toasts: ToastMessage[]
  addToast: (type: ToastType, message: string) => void
  dismissToast: (id: string) => void
  resolveConflict: (resolution: 'theirs' | 'ours' | 'abort') => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncStatus() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSyncStatus must be used within a SyncProvider')
  }
  return context
}

interface SyncProviderProps {
  children: ReactNode
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'synced',
    lastSyncTime: null,
    errorMessage: null,
    pendingChanges: false,
    conflictInfo: null,
  })
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, type, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const resolveConflict = useCallback(
    async (resolution: 'theirs' | 'ours' | 'abort') => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sync/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ resolution }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to resolve conflict')
        }

        setSyncState(prev => ({
          ...prev,
          status: 'syncing',
          conflictInfo: null,
          errorMessage: null,
        }))

        addToast('info', `Resolving conflict with "${resolution}" strategy...`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        addToast('error', `Failed to resolve: ${message}`)
      }
    },
    [addToast]
  )

  // Subscribe to sync status updates via SSE
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE_URL}/api/sync/events`, {
      withCredentials: true,
    })

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'status') {
          // Map backend status to frontend status
          let frontendStatus: SyncStatus = 'synced'
          if (data.status === 'conflict') {
            frontendStatus = 'conflict'
          } else if (data.status === 'syncing') {
            frontendStatus = 'syncing'
          } else if (data.status === 'error') {
            frontendStatus = 'error'
          } else if (data.pendingJobs > 0) {
            frontendStatus = 'pending'
          }

          setSyncState(prev => ({
            ...prev,
            status: frontendStatus,
            lastSyncTime: data.lastSync,
            errorMessage: data.lastError,
            pendingChanges: data.pendingJobs > 0,
            conflictInfo: data.conflictInfo || null,
          }))
        } else if (data.type === 'syncComplete') {
          setSyncState(prev => ({
            ...prev,
            status: 'synced',
            lastSyncTime: data.timestamp,
            errorMessage: null,
            pendingChanges: false,
          }))
          addToast('success', 'Changes synced successfully')
        } else if (data.type === 'syncError') {
          setSyncState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: data.error,
          }))
          addToast('error', `Sync failed: ${data.error}`)
        } else if (data.type === 'conflict') {
          setSyncState(prev => ({
            ...prev,
            status: 'conflict',
            errorMessage: data.message,
            conflictInfo: { ahead: data.ahead, behind: data.behind },
          }))
          addToast(
            'error',
            `Sync conflict: ${data.ahead} commits ahead, ${data.behind} behind`
          )
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // Connection error - will auto-reconnect
      console.warn('Sync event connection lost, reconnecting...')
    }

    return () => {
      eventSource.close()
    }
  }, [addToast])

  const value: SyncContextValue = {
    ...syncState,
    toasts,
    addToast,
    dismissToast,
    resolveConflict,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
