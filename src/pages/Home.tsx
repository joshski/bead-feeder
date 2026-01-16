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
import { Input } from '../components/ui/input'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Repository {
  owner: string
  repo: string
  branch?: string
}

interface LocalRepository {
  name: string
  path: string
}

export default function Home() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  // Modal state
  const [showGitHubModal, setShowGitHubModal] = useState(false)
  const [showLocalModal, setShowLocalModal] = useState(false)

  // GitHub repos state
  const [repos, setRepos] = useState<Repository[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)

  // Local repos state
  const [localRepos, setLocalRepos] = useState<LocalRepository[]>([])
  const [localReposLoading, setLocalReposLoading] = useState(false)
  const [localReposError, setLocalReposError] = useState<string | null>(null)
  const [customPath, setCustomPath] = useState('')

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

  const fetchLocalRepos = useCallback(async () => {
    setLocalReposLoading(true)
    setLocalReposError(null)

    try {
      const response = await fetch(`${API_URL}/api/local-repos`)

      if (!response.ok) {
        throw new Error('Failed to fetch local repositories')
      }

      const data = (await response.json()) as { repos: LocalRepository[] }
      setLocalRepos(data.repos)
    } catch (err) {
      setLocalReposError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLocalReposLoading(false)
    }
  }, [])

  // Fetch repos when modals open
  useEffect(() => {
    if (showGitHubModal && user) {
      fetchRepos()
    }
  }, [showGitHubModal, user, fetchRepos])

  useEffect(() => {
    if (showLocalModal) {
      fetchLocalRepos()
    }
  }, [showLocalModal, fetchLocalRepos])

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

  const handleSelectLocalRepo = (repo: LocalRepository) => {
    setShowLocalModal(false)
    const encodedPath = encodeURIComponent(repo.path)
    navigate(`/local?path=${encodedPath}`)
  }

  const handleCustomPathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customPath.trim()) {
      setShowLocalModal(false)
      const encodedPath = encodeURIComponent(customPath.trim())
      navigate(`/local?path=${encodedPath}`)
    }
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

          <button
            type="button"
            onClick={() => setShowLocalModal(true)}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer text-left"
          >
            <div className="flex-shrink-0 text-2xl">
              <FolderIcon />
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                Local Repository
              </div>
              <div className="text-sm text-gray-600">
                Open a beads project on this machine
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

      {/* Local Repository Modal */}
      <Dialog open={showLocalModal} onOpenChange={setShowLocalModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Open Local Repository</DialogTitle>
            <DialogDescription>
              Select a discovered beads project or enter a custom path.
            </DialogDescription>
          </DialogHeader>

          {/* Custom path form */}
          <form onSubmit={handleCustomPathSubmit} className="mb-4">
            <label
              htmlFor="custom-path"
              className="block text-sm font-medium mb-2"
            >
              Repository path
            </label>
            <div className="flex gap-2">
              <Input
                id="custom-path"
                type="text"
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="flex-1"
              />
              <Button type="submit" disabled={!customPath.trim()}>
                Open
              </Button>
            </div>
          </form>

          {localRepos.length > 0 && (
            <>
              <div className="text-sm font-medium text-gray-500 mb-2">
                Discovered repositories ({localRepos.length})
              </div>
              <ul className="space-y-2">
                {localRepos.map(repo => (
                  <li key={repo.path}>
                    <button
                      type="button"
                      onClick={() => handleSelectLocalRepo(repo)}
                      className="w-full flex justify-between items-center p-3 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-sm">{repo.name}</span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded truncate max-w-[200px]">
                        {repo.path}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {localReposLoading && (
            <div className="py-4 text-center text-gray-500">
              Scanning for repositories...
            </div>
          )}

          {localReposError && (
            <div className="py-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-3">
                {localReposError}
              </div>
              <Button
                onClick={fetchLocalRepos}
                variant="outline"
                className="w-full"
              >
                Retry
              </Button>
            </div>
          )}

          {!localReposLoading &&
            !localReposError &&
            localRepos.length === 0 && (
              <div className="py-4 text-center text-gray-500 text-sm">
                No beads repositories found. Enter a path above to open a
                project manually.
              </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FolderIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-700"
      aria-hidden="true"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}
