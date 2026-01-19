import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const hasProcessedRef = useRef(false)

  const exchangeCodeForToken = useCallback(
    async (code: string) => {
      try {
        const response = await fetch(`${API_URL}/api/auth/github/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
          credentials: 'include', // Important for receiving httpOnly cookies
        })

        if (!response.ok) {
          const data = (await response.json()) as { error?: string }
          throw new Error(data.error || 'Failed to authenticate')
        }

        // Refresh user context to update auth state
        await refreshUser()

        // Successfully authenticated, redirect to home
        navigate('/', { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    },
    [navigate, refreshUser]
  )

  useEffect(() => {
    // Prevent double-processing in React StrictMode
    if (hasProcessedRef.current) {
      return
    }
    hasProcessedRef.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const storedState = sessionStorage.getItem('oauth_state')

    // Clear stored state
    sessionStorage.removeItem('oauth_state')

    // Validate state for CSRF protection
    if (!state || state !== storedState) {
      setError('Invalid state parameter. Please try logging in again.')
      return
    }

    if (!code) {
      setError('No authorization code received from GitHub.')
      return
    }

    // Exchange code for token via our backend
    exchangeCodeForToken(code)
  }, [searchParams, exchangeCodeForToken])

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Authentication Error</h2>
        <p style={{ color: '#dc2626' }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Return to Home
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Authenticating...</h2>
      <p>Please wait while we complete your sign in.</p>
    </div>
  )
}
