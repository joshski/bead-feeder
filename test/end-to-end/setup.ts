/**
 * E2E test setup module.
 *
 * Provides server management utilities for e2e tests, allowing them to be
 * self-contained and runnable via `bun test` without external orchestration.
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { type Subprocess, spawn } from 'bun'
import type { Locator, Page } from 'playwright'
import { TEST_PORTS } from '../../config/ports'

// ============================================================================
// Types
// ============================================================================

/**
 * Data structure representing an issue extracted from beads CLI
 */
export interface BeadsIssue {
  id: string
  title: string
  status: string
  priority: number
  issue_type: string
  dependency_count: number
  dependent_count: number
}

/**
 * Data structure representing a dependency extracted from beads CLI
 */
export interface BeadsDependency {
  issue_id: string
  depends_on_id: string
  type: string
}

/**
 * Container for issues and dependencies extracted from beads CLI
 */
export interface BeadsData {
  issues: BeadsIssue[]
  dependencies: BeadsDependency[]
}

/**
 * Data structure representing an issue extracted from DAG view UI
 */
export interface DagIssue {
  id: string
  title: string
  status: string
  priority: string
  issue_type: string
}

/**
 * Data structure representing a dependency extracted from DAG view UI
 */
export interface DagDependency {
  issue_id: string // blocked issue
  depends_on_id: string // blocker issue
}

/**
 * Container for issues and dependencies extracted from DAG view
 */
export interface DagData {
  issues: DagIssue[]
  dependencies: DagDependency[]
}

const VITE_URL = `http://localhost:${TEST_PORTS.VITE}`
const API_URL = `http://localhost:${TEST_PORTS.API}`
const MAX_WAIT_MS = 30000
const POLL_INTERVAL_MS = 500

// Bun's native fetch is not replaced by happy-dom - access it directly
// This avoids CORS restrictions imposed by happy-dom's fetch implementation
const nativeFetch: typeof fetch = Bun.fetch || globalThis.fetch

interface ServerState {
  viteProc: Subprocess
  apiProc: Subprocess
  tempDataDir: string
  localBeadsDir: string
}

let serverState: ServerState | null = null

/**
 * Wait for a server to be ready by polling the given URL.
 */
async function waitForServer(url: string, name: string): Promise<boolean> {
  const startTime = Date.now()
  console.log(`[e2e] Waiting for ${name} at ${url}...`)

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      // Use nativeFetch to avoid CORS restrictions from happy-dom
      const response = await nativeFetch(url)
      if (response.ok || response.status < 500) {
        console.log(`[e2e] ${name} is ready (${Date.now() - startTime}ms)`)
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  console.error(`[e2e] Timeout waiting for ${name}`)
  return false
}

/**
 * Start the Vite and API servers for e2e tests.
 * Uses a temporary data directory for test isolation.
 *
 * Call this in beforeAll() of your e2e tests.
 */
export async function startServers(): Promise<void> {
  if (serverState) {
    console.log('[e2e] Servers already running')
    return
  }

  console.log('[e2e] Starting dev servers...')

  // Create a temporary data directory for test isolation
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-feeder-e2e-'))
  console.log(`[e2e] Using temp data directory: ${tempDataDir}`)

  // Initialize a local beads repo in the temp directory
  const localBeadsDir = path.join(tempDataDir, 'local')
  fs.mkdirSync(localBeadsDir, { recursive: true })

  // Initialize git and beads in the local directory
  const initGit = Bun.spawn(['git', 'init'], { cwd: localBeadsDir })
  await initGit.exited
  const initBeads = Bun.spawn(['bd', 'init'], { cwd: localBeadsDir })
  await initBeads.exited
  console.log(`[e2e] Initialized local beads repo at ${localBeadsDir}`)

  // Start Vite dev server on test port
  const viteProc = spawn({
    cmd: ['bun', 'run', 'vite', '--host', '--port', String(TEST_PORTS.VITE)],
    stdout: 'ignore',
    stderr: 'ignore',
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${TEST_PORTS.API}`,
    },
  })

  // Start API server on test port with temp data directory
  const apiProc = spawn({
    cmd: ['bun', 'run', 'src/api/server.ts'],
    stdout: 'ignore',
    stderr: 'ignore',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORTS.API),
      BEAD_FEEDER_GITHUB_REPOS_DIR: localBeadsDir,
    },
  })

  serverState = { viteProc, apiProc, tempDataDir, localBeadsDir }

  // Wait for both servers to be ready
  const [viteReady, apiReady] = await Promise.all([
    waitForServer(VITE_URL, 'Vite'),
    waitForServer(`${API_URL}/api/issues`, 'API'),
  ])

  if (!viteReady || !apiReady) {
    await stopServers()
    throw new Error('[e2e] Failed to start servers')
  }

  console.log('[e2e] Servers ready')
}

/**
 * Stop the dev servers and clean up resources.
 * Call this in afterAll() of your e2e tests.
 */
export async function stopServers(): Promise<void> {
  if (!serverState) {
    return
  }

  console.log('[e2e] Shutting down servers...')

  const { viteProc, apiProc, tempDataDir } = serverState

  viteProc.kill()
  apiProc.kill()

  // Wait for processes to exit
  await Promise.all([viteProc.exited, apiProc.exited]).catch(() => {
    // Ignore errors from process exit
  })

  // Clean up temp directory
  try {
    fs.rmSync(tempDataDir, { recursive: true, force: true })
    console.log(`[e2e] Cleaned up temp directory: ${tempDataDir}`)
  } catch (err) {
    console.warn('[e2e] Failed to clean up temp directory:', err)
  }

  serverState = null
}

// ============================================================================
// GitHub Fork Management
// ============================================================================

/**
 * Create a fork of the source repository with a unique name.
 * Uses gh CLI with PAT from TEST_GITHUB_PERSONAL_ACCESS_TOKEN env var.
 */
export function createTestFork(
  username: string,
  pat: string,
  sourceOwner: string,
  sourceRepo: string
): string {
  // Generate unique fork name with timestamp
  const timestamp = Date.now()
  const forkName = `bead-feeder-e2e-${timestamp}`

  console.log(`Creating fork: ${username}/${forkName}`)

  // Use GH_TOKEN env var instead of gh auth login to avoid modifying global gh config
  const ghEnv = { ...process.env, GH_TOKEN: pat }

  // Create the fork with a custom name
  try {
    execSync(
      `gh repo fork ${sourceOwner}/${sourceRepo} --fork-name ${forkName} --clone=false`,
      {
        stdio: 'pipe',
        env: ghEnv,
      }
    )
    console.log(`Created fork: ${username}/${forkName}`)
  } catch (error) {
    throw new Error(
      `Failed to create fork: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Wait a moment for GitHub to process the fork
  execSync('sleep 5')

  return forkName
}

/**
 * Clone the forked repository into a temporary directory.
 * Uses PAT for authentication with git.
 * Returns the path to the cloned repository.
 */
export function cloneFork(owner: string, repo: string, pat: string): string {
  // Create a unique temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-feeder-e2e-'))

  // Build authenticated URL using PAT (URL-encode to handle special characters)
  const encodedPat = encodeURIComponent(pat)
  const authUrl = `https://${encodedPat}@github.com/${owner}/${repo}.git`

  // Clone the repository
  try {
    execSync(`git clone ${authUrl} ${tempDir}`, {
      stdio: 'pipe', // Suppress output to avoid leaking credentials
    })
    console.log(`Cloned fork to ${tempDir}`)
    return tempDir
  } catch (error) {
    // Clean up temp directory on failure
    fs.rmSync(tempDir, { recursive: true, force: true })
    throw new Error(
      `Failed to clone fork: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Delete the test fork using gh CLI
 * Uses GH_TOKEN env var for authentication to avoid modifying global gh config
 */
export function deleteFork(owner: string, repo: string, pat: string): void {
  try {
    execSync(`gh repo delete ${owner}/${repo} --yes`, {
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: pat },
    })
    console.log(`Deleted fork: ${owner}/${repo}`)
  } catch (error) {
    console.warn(
      `Failed to delete fork ${owner}/${repo}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Clean up the cloned repository directory
 */
export function cleanupClonedRepo(repoPath: string): void {
  try {
    fs.rmSync(repoPath, { recursive: true, force: true })
    console.log(`Cleaned up cloned repository at ${repoPath}`)
  } catch (error) {
    console.warn(
      `Failed to clean up ${repoPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// ============================================================================
// Data Extraction
// ============================================================================

/**
 * Extract issues and dependencies from a beads repository using the CLI.
 * Runs `bd list --json` and `bd graph --all --json` in the specified directory.
 */
export function extractBeadsData(repoPath: string): BeadsData {
  // Run bd sync first to ensure bd is up to date with any file changes
  try {
    execSync('bd sync', {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Ignore sync errors - it might fail if there are no changes
  }

  // Run bd list --json to get all issues
  const listOutput = execSync('bd list --json', {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const issues: BeadsIssue[] = JSON.parse(listOutput)

  // Run bd graph --all --json to get dependencies
  const graphOutput = execSync('bd graph --all --json', {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const graphData = JSON.parse(graphOutput)

  // Collect all unique dependencies from all graph entries
  const dependencyMap = new Map<string, BeadsDependency>()
  for (const entry of graphData) {
    if (entry.Dependencies) {
      for (const dep of entry.Dependencies) {
        // Use a unique key to avoid duplicates
        const key = `${dep.issue_id}-${dep.depends_on_id}`
        if (!dependencyMap.has(key)) {
          dependencyMap.set(key, {
            issue_id: dep.issue_id,
            depends_on_id: dep.depends_on_id,
            type: dep.type,
          })
        }
      }
    }
  }

  return {
    issues,
    dependencies: Array.from(dependencyMap.values()),
  }
}

/**
 * Pull latest changes from remote and extract beads data.
 * Uses PAT for authentication with git.
 */
export function pullAndExtractBeadsData(
  repoPath: string,
  owner: string,
  forkRepoName: string,
  pat: string
): BeadsData {
  // Pull latest changes using PAT for auth
  const encodedPat = encodeURIComponent(pat)
  const authUrl = `https://${encodedPat}@github.com/${owner}/${forkRepoName}.git`

  execSync(`git remote set-url origin ${authUrl}`, {
    cwd: repoPath,
    stdio: 'pipe',
  })

  // Get the current branch name first
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: repoPath,
    encoding: 'utf-8',
  }).trim()

  console.log(`Current branch: ${currentBranch}`)

  // Pull from the current branch
  const pullOutput = execSync(`git pull origin ${currentBranch}`, {
    cwd: repoPath,
    encoding: 'utf-8',
  })
  console.log(`Pull output: ${pullOutput}`)

  // Restore URL without credentials
  execSync(
    `git remote set-url origin https://github.com/${owner}/${forkRepoName}.git`,
    {
      cwd: repoPath,
      stdio: 'pipe',
    }
  )

  return extractBeadsData(repoPath)
}

// ============================================================================
// Playwright Helpers
// ============================================================================

/**
 * Helper to wait for a locator to be visible.
 * Replaces Playwright's expect(...).toBeVisible() which isn't available in bun:test.
 */
export async function waitForVisible(
  locator: Locator,
  options?: { timeout?: number }
): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: options?.timeout ?? 5000 })
}

/**
 * Helper to wait for a locator to be hidden/detached.
 * Replaces Playwright's expect(...).not.toBeVisible() which isn't available in bun:test.
 */
export async function waitForHidden(
  locator: Locator,
  options?: { timeout?: number }
): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout: options?.timeout ?? 5000 })
}

/**
 * Take a screenshot and save it to the screenshots directory
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: true,
  })
}
