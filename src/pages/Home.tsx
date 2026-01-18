import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { GitHubIcon, triggerGitHubLogin } from '../components/GitHubLoginButton'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Repository {
  owner: string
  repo: string
  branch?: string
}

export default function Home() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  // Modal state - auto-open when authenticated
  const [showGitHubModal, setShowGitHubModal] = useState(false)

  // Auto-open repository modal when user is authenticated
  useEffect(() => {
    if (user && !isLoading) {
      setShowGitHubModal(true)
    }
  }, [user, isLoading])

  // GitHub repos state
  const [repos, setRepos] = useState<Repository[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)

  const fetchRepos = useCallback(async () => {
    setReposLoading(true)
    setReposError(null)

    try {
      const response = await fetch(`${API_URL}/api/repos`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to view your repositories')
        }
        throw new Error('Failed to fetch repositories')
      }

      const data = (await response.json()) as { repos: Repository[] }
      setRepos(data.repos)
    } catch (err) {
      setReposError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setReposLoading(false)
    }
  }, [])

  // Fetch repos when modal opens
  useEffect(() => {
    if (showGitHubModal && user) {
      fetchRepos()
    }
  }, [showGitHubModal, user, fetchRepos])

  const handleSelectGitHubRepo = (repo: Repository) => {
    setShowGitHubModal(false)
    navigate(`/repos/${repo.owner}/${repo.repo}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Unauthenticated landing page
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-5xl font-bold mb-4">Bead Feeder</h1>
          <p className="text-xl text-gray-600 mb-8">Keep your agent busy!</p>
          <Button onClick={triggerGitHubLogin} size="lg" className="gap-2">
            <GitHubIcon size={20} />
            Sign in with GitHub
          </Button>
        </div>
      </div>
    )
  }

  // Authenticated user - repository selection modal opens automatically
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-5xl font-bold mb-4">Bead Feeder</h1>
        <p className="text-xl text-gray-600 mb-8">Keep your agent busy!</p>
        {!showGitHubModal && (
          <Button
            onClick={() => setShowGitHubModal(true)}
            size="lg"
            className="gap-2"
          >
            <GitHubIcon size={20} />
            Select Repository
          </Button>
        )}
      </div>

      {/* GitHub Repository Modal */}
      <Dialog open={showGitHubModal} onOpenChange={setShowGitHubModal}>
        <DialogContent className="max-w-md h-[400px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Repository</DialogTitle>
          </DialogHeader>

          {reposLoading && (
            <div className="py-8 text-center text-gray-500">
              Loading repositories...
            </div>
          )}

          {reposError && (
            <div className="py-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-3">
                {reposError}
              </div>
              <Button onClick={fetchRepos} variant="outline" className="w-full">
                Retry
              </Button>
            </div>
          )}

          {!reposLoading && !reposError && repos.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              No repositories found.
            </div>
          )}

          {!reposLoading && !reposError && repos.length > 0 && (
            <ul className="space-y-2">
              {repos.map(repo => (
                <li key={`${repo.owner}/${repo.repo}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectGitHubRepo(repo)}
                    className="w-full p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer text-left"
                  >
                    <span className="font-medium text-sm">
                      {repo.owner}/{repo.repo}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
