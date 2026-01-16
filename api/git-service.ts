import { spawn } from 'node:child_process'
import {
  fakeFetchRepository,
  fakePullRepository,
  fakePushRepository,
  isFakeModeEnabled,
} from './fake-git-service'

interface GitResult {
  success: boolean
  output?: string
  error?: string
}

interface RepoInfo {
  owner: string
  repo: string
  branch?: string
}

/**
 * Parse a GitHub repository URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): RepoInfo | null {
  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/
  )
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  // Handle short form: owner/repo
  const shortMatch = url.match(/^([^/]+)\/([^/]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] }
  }

  return null
}

/**
 * Build an authenticated GitHub HTTPS URL using an access token
 */
export function buildAuthenticatedUrl(
  owner: string,
  repo: string,
  token: string
): string {
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
}

/**
 * Execute a git command with optional authentication
 */
async function runGitCommand(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
): Promise<GitResult> {
  return new Promise(resolve => {
    const proc = spawn('git', args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', data => {
      stdout += data.toString()
    })

    proc.stderr.on('data', data => {
      stderr += data.toString()
    })

    proc.on('close', code => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() })
      } else {
        resolve({ success: false, error: stderr.trim() || stdout.trim() })
      }
    })

    proc.on('error', err => {
      resolve({ success: false, error: err.message })
    })
  })
}

/**
 * Clone a GitHub repository using an access token for authentication
 */
export async function cloneRepository(
  repoUrl: string,
  targetDir: string,
  token: string
): Promise<GitResult> {
  const repoInfo = parseGitHubUrl(repoUrl)
  if (!repoInfo) {
    return { success: false, error: 'Invalid GitHub repository URL' }
  }

  const authUrl = buildAuthenticatedUrl(repoInfo.owner, repoInfo.repo, token)
  return runGitCommand(['clone', authUrl, targetDir])
}

/**
 * Sparse clone a GitHub repository - only fetches the .beads directory.
 * This is much faster than a full clone, especially for large repos.
 */
export async function sparseCloneRepository(
  owner: string,
  repo: string,
  targetDir: string,
  token: string
): Promise<GitResult> {
  const authUrl = buildAuthenticatedUrl(owner, repo, token)

  // Step 1: Initialize empty git repo
  const initResult = await runGitCommand(['init', targetDir])
  if (!initResult.success) {
    return initResult
  }

  // Step 2: Add remote origin
  const remoteResult = await runGitCommand(
    ['remote', 'add', 'origin', authUrl],
    { cwd: targetDir }
  )
  if (!remoteResult.success) {
    return remoteResult
  }

  // Step 3: Enable sparse checkout
  const sparseResult = await runGitCommand(
    ['config', 'core.sparseCheckout', 'true'],
    { cwd: targetDir }
  )
  if (!sparseResult.success) {
    return sparseResult
  }

  // Step 4: Configure sparse checkout to only include .beads directory
  const { writeFileSync, mkdirSync, existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const sparseCheckoutDir = join(targetDir, '.git', 'info')
  if (!existsSync(sparseCheckoutDir)) {
    mkdirSync(sparseCheckoutDir, { recursive: true })
  }
  writeFileSync(join(sparseCheckoutDir, 'sparse-checkout'), '.beads/\n')

  // Step 5: Fetch with blob filter (only metadata, blobs fetched on demand)
  const fetchResult = await runGitCommand(
    ['fetch', '--filter=blob:none', '--depth=1', 'origin'],
    { cwd: targetDir }
  )
  if (!fetchResult.success) {
    return fetchResult
  }

  // Step 6: Get the default branch name
  const refResult = await runGitCommand(['remote', 'show', 'origin'], {
    cwd: targetDir,
  })
  let defaultBranch = 'main'
  if (refResult.success && refResult.output) {
    const match = refResult.output.match(/HEAD branch: (\S+)/)
    if (match) {
      defaultBranch = match[1]
    }
  }

  // Step 7: Checkout the default branch
  const checkoutResult = await runGitCommand(
    ['checkout', `origin/${defaultBranch}`, '-b', defaultBranch],
    { cwd: targetDir }
  )
  if (!checkoutResult.success) {
    // Try alternate approach if checkout fails
    const resetResult = await runGitCommand(
      ['reset', '--hard', `origin/${defaultBranch}`],
      { cwd: targetDir }
    )
    if (!resetResult.success) {
      return resetResult
    }
  }

  // Step 8: Restore original remote URL (without token)
  const originalUrl = `https://github.com/${owner}/${repo}.git`
  await runGitCommand(['remote', 'set-url', 'origin', originalUrl], {
    cwd: targetDir,
  })

  return {
    success: true,
    output: `Sparse cloned ${owner}/${repo} to ${targetDir}`,
  }
}

/**
 * Ensure a GitHub repository is cloned locally (sparse clone).
 * If already cloned, pulls latest changes (unless skipPull is true).
 * If not cloned, performs sparse clone.
 *
 * @param skipPull - If true and repo is already cloned, skip the pull operation.
 *                   Use this for read-only operations to avoid slow network I/O.
 */
export async function ensureRepoCloned(
  owner: string,
  repo: string,
  targetDir: string,
  token: string,
  options: { skipPull?: boolean } = {}
): Promise<GitResult> {
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  // Check if already cloned (has .git directory)
  if (existsSync(join(targetDir, '.git'))) {
    // If skipPull is true, just return success without pulling
    if (options.skipPull) {
      return { success: true, output: 'Repository exists (pull skipped)' }
    }

    // Already cloned, pull latest changes
    const pullResult = await pullRepository(targetDir, token, 'origin')
    if (!pullResult.success) {
      // If pull fails (e.g., conflicts), still return success since repo exists
      // The caller can decide how to handle stale data
      return {
        success: true,
        output: 'Repository exists (pull skipped due to conflicts)',
      }
    }
    return { success: true, output: 'Repository updated' }
  }

  // Not cloned yet, create parent directory and clone
  const { mkdirSync } = await import('node:fs')
  const { dirname } = await import('node:path')
  mkdirSync(dirname(targetDir), { recursive: true })

  return sparseCloneRepository(owner, repo, targetDir, token)
}

/**
 * Fetch updates from a remote using an access token for authentication
 */
export async function fetchRepository(
  cwd: string,
  token: string,
  remote = 'origin'
): Promise<GitResult> {
  // Use fake implementation in test mode
  if (isFakeModeEnabled()) {
    return fakeFetchRepository(cwd, token, remote)
  }

  // Get the remote URL to parse it
  const urlResult = await runGitCommand(['remote', 'get-url', remote], { cwd })
  if (!urlResult.success || !urlResult.output) {
    return {
      success: false,
      error: `Failed to get remote URL: ${urlResult.error}`,
    }
  }

  const repoInfo = parseGitHubUrl(urlResult.output)
  if (!repoInfo) {
    return { success: false, error: 'Remote is not a GitHub repository' }
  }

  const authUrl = buildAuthenticatedUrl(repoInfo.owner, repoInfo.repo, token)

  // Temporarily set the remote URL with auth, fetch, then restore
  const setResult = await runGitCommand(
    ['remote', 'set-url', remote, authUrl],
    { cwd }
  )
  if (!setResult.success) {
    return setResult
  }

  try {
    const fetchResult = await runGitCommand(['fetch', remote], { cwd })
    return fetchResult
  } finally {
    // Restore the original URL (without token)
    const originalUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`
    await runGitCommand(['remote', 'set-url', remote, originalUrl], { cwd })
  }
}

/**
 * Push to a remote using an access token for authentication
 */
export async function pushRepository(
  cwd: string,
  token: string,
  remote = 'origin',
  branch?: string
): Promise<GitResult> {
  // Use fake implementation in test mode
  if (isFakeModeEnabled()) {
    return fakePushRepository(cwd, token, remote, branch)
  }

  // Get the remote URL to parse it
  const urlResult = await runGitCommand(['remote', 'get-url', remote], { cwd })
  if (!urlResult.success || !urlResult.output) {
    return {
      success: false,
      error: `Failed to get remote URL: ${urlResult.error}`,
    }
  }

  const repoInfo = parseGitHubUrl(urlResult.output)
  if (!repoInfo) {
    return { success: false, error: 'Remote is not a GitHub repository' }
  }

  const authUrl = buildAuthenticatedUrl(repoInfo.owner, repoInfo.repo, token)

  // Temporarily set the remote URL with auth, push, then restore
  const setResult = await runGitCommand(
    ['remote', 'set-url', remote, authUrl],
    { cwd }
  )
  if (!setResult.success) {
    return setResult
  }

  try {
    const pushArgs = ['push', remote]
    if (branch) {
      pushArgs.push(branch)
    }
    const pushResult = await runGitCommand(pushArgs, { cwd })
    return pushResult
  } finally {
    // Restore the original URL (without token)
    const originalUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`
    await runGitCommand(['remote', 'set-url', remote, originalUrl], { cwd })
  }
}

/**
 * Pull from a remote using an access token for authentication
 */
export async function pullRepository(
  cwd: string,
  token: string,
  remote = 'origin',
  branch?: string
): Promise<GitResult> {
  // Use fake implementation in test mode
  if (isFakeModeEnabled()) {
    return fakePullRepository(cwd, token, remote, branch)
  }

  // Get the remote URL to parse it
  const urlResult = await runGitCommand(['remote', 'get-url', remote], { cwd })
  if (!urlResult.success || !urlResult.output) {
    return {
      success: false,
      error: `Failed to get remote URL: ${urlResult.error}`,
    }
  }

  const repoInfo = parseGitHubUrl(urlResult.output)
  if (!repoInfo) {
    return { success: false, error: 'Remote is not a GitHub repository' }
  }

  const authUrl = buildAuthenticatedUrl(repoInfo.owner, repoInfo.repo, token)

  // Temporarily set the remote URL with auth, pull, then restore
  const setResult = await runGitCommand(
    ['remote', 'set-url', remote, authUrl],
    { cwd }
  )
  if (!setResult.success) {
    return setResult
  }

  try {
    const pullArgs = ['pull', remote]
    if (branch) {
      pullArgs.push(branch)
    }
    const pullResult = await runGitCommand(pullArgs, { cwd })
    return pullResult
  } finally {
    // Restore the original URL (without token)
    const originalUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`
    await runGitCommand(['remote', 'set-url', remote, originalUrl], { cwd })
  }
}

/**
 * List user's repositories from GitHub API
 */
export async function listUserRepositories(
  token: string
): Promise<{ success: boolean; repos?: RepoInfo[]; error?: string }> {
  try {
    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      }
    )

    if (!response.ok) {
      return { success: false, error: `GitHub API error: ${response.status}` }
    }

    const repos = (await response.json()) as Array<{
      owner: { login: string }
      name: string
      default_branch: string
    }>

    return {
      success: true,
      repos: repos.map(r => ({
        owner: r.owner.login,
        repo: r.name,
        branch: r.default_branch,
      })),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(cwd: string): Promise<GitResult> {
  return runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
}

/**
 * Get the current git status
 */
export async function getStatus(cwd: string): Promise<GitResult> {
  return runGitCommand(['status', '--porcelain'], { cwd })
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepository(cwd: string): Promise<boolean> {
  const result = await runGitCommand(['rev-parse', '--git-dir'], { cwd })
  return result.success
}

export interface BranchStatus {
  ahead: number
  behind: number
  diverged: boolean
}

/**
 * Check if the local branch is behind the remote (needs pull) or ahead (needs push).
 * Returns the number of commits ahead/behind and whether branches have diverged.
 */
export async function compareBranches(
  cwd: string,
  remote = 'origin'
): Promise<{ success: boolean; status?: BranchStatus; error?: string }> {
  // Get current branch
  const branchResult = await getCurrentBranch(cwd)
  if (!branchResult.success || !branchResult.output) {
    return {
      success: false,
      error: branchResult.error || 'Failed to get current branch',
    }
  }
  const branch = branchResult.output

  // Get rev-list count for ahead/behind
  const result = await runGitCommand(
    ['rev-list', '--left-right', '--count', `${remote}/${branch}...HEAD`],
    { cwd }
  )

  if (!result.success) {
    // This can fail if remote branch doesn't exist yet
    if (result.error?.includes('unknown revision')) {
      return { success: true, status: { ahead: 0, behind: 0, diverged: false } }
    }
    return { success: false, error: result.error }
  }

  // Output format: "behind\tahead"
  const parts = result.output?.split(/\s+/) || []
  const behind = Number.parseInt(parts[0] || '0', 10)
  const ahead = Number.parseInt(parts[1] || '0', 10)

  return {
    success: true,
    status: {
      ahead,
      behind,
      diverged: ahead > 0 && behind > 0,
    },
  }
}

/**
 * Check if there are merge conflicts in the working directory
 */
export async function hasConflicts(cwd: string): Promise<boolean> {
  const result = await runGitCommand(
    ['diff', '--name-only', '--diff-filter=U'],
    { cwd }
  )
  return result.success && !!result.output?.trim()
}

/**
 * Abort an in-progress merge
 */
export async function abortMerge(cwd: string): Promise<GitResult> {
  return runGitCommand(['merge', '--abort'], { cwd })
}

/**
 * Accept all remote changes during a conflict (theirs strategy)
 */
export async function resolveConflictsTheirs(cwd: string): Promise<GitResult> {
  // Get list of conflicted files
  const conflictedResult = await runGitCommand(
    ['diff', '--name-only', '--diff-filter=U'],
    { cwd }
  )
  if (!conflictedResult.success || !conflictedResult.output) {
    return { success: true } // No conflicts
  }

  const files = conflictedResult.output.trim().split('\n').filter(Boolean)
  for (const file of files) {
    const checkoutResult = await runGitCommand(['checkout', '--theirs', file], {
      cwd,
    })
    if (!checkoutResult.success) {
      return checkoutResult
    }
    const addResult = await runGitCommand(['add', file], { cwd })
    if (!addResult.success) {
      return addResult
    }
  }

  return { success: true }
}

/**
 * Accept all local changes during a conflict (ours strategy)
 */
export async function resolveConflictsOurs(cwd: string): Promise<GitResult> {
  // Get list of conflicted files
  const conflictedResult = await runGitCommand(
    ['diff', '--name-only', '--diff-filter=U'],
    { cwd }
  )
  if (!conflictedResult.success || !conflictedResult.output) {
    return { success: true } // No conflicts
  }

  const files = conflictedResult.output.trim().split('\n').filter(Boolean)
  for (const file of files) {
    const checkoutResult = await runGitCommand(['checkout', '--ours', file], {
      cwd,
    })
    if (!checkoutResult.success) {
      return checkoutResult
    }
    const addResult = await runGitCommand(['add', file], { cwd })
    if (!addResult.success) {
      return addResult
    }
  }

  return { success: true }
}

/**
 * Stage files matching a pattern
 */
export async function stageFiles(
  cwd: string,
  pattern: string
): Promise<GitResult> {
  return runGitCommand(['add', pattern], { cwd })
}

/**
 * Create a commit with the given message
 */
export async function createCommit(
  cwd: string,
  message: string
): Promise<GitResult> {
  return runGitCommand(['commit', '-m', message], { cwd })
}

/**
 * Run bd sync to synchronize beads with git
 */
export async function runBdSync(cwd: string): Promise<GitResult> {
  return new Promise(resolve => {
    const { spawn } = require('node:child_process')
    const proc = spawn('bd', ['sync'], { cwd, env: process.env })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() })
      } else {
        resolve({ success: false, error: stderr.trim() || stdout.trim() })
      }
    })

    proc.on('error', (err: Error) => {
      resolve({ success: false, error: err.message })
    })
  })
}
