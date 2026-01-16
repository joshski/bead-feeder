import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { GitHubIcon, triggerGitHubLogin } from '../components/GitHubLoginButton'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

  // Modal state
  const [showGitHubModal, setShowGitHubModal] = useState(false)

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

  const handleGitHubClick = () => {
    if (user) {
      setShowGitHubModal(true)
    } else {
      triggerGitHubLogin()
    }
  }

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

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Bead Feeder</h1>
        <p className="text-gray-600 mb-8">
          Visualize and manage your project dependencies with an interactive DAG
          view.
        </p>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleGitHubClick}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex-shrink-0 text-gray-800">
              <GitHubIcon size={32} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {user ? 'GitHub Repository' : 'Sign in with GitHub'}
              </div>
              <div className="text-sm text-gray-600">
                {user
                  ? 'Browse your GitHub repos'
                  : 'Access your GitHub repositories'}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* GitHub Repository Modal */}
      <Dialog open={showGitHubModal} onOpenChange={setShowGitHubModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Repository</DialogTitle>
            <DialogDescription>
              Choose a GitHub repository to view its dependency graph.
            </DialogDescription>
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
                    className="w-full flex justify-between items-center p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-sm">
                      {repo.owner}/{repo.repo}
                    </span>
                    {repo.branch && (
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        {repo.branch}
                      </span>
                    )}
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
