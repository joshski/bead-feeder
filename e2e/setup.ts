/**
 * E2E test setup module.
 *
 * Provides server management utilities for e2e tests, allowing them to be
 * self-contained and runnable via `bun test` without external orchestration.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { type Subprocess, spawn } from 'bun'
import { TEST_PORTS } from '../config/ports'

const VITE_URL = `http://localhost:${TEST_PORTS.VITE}`
const API_URL = `http://localhost:${TEST_PORTS.API}`
const MAX_WAIT_MS = 30000
const POLL_INTERVAL_MS = 500

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
      const response = await fetch(url)
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
    cmd: ['bun', 'run', 'api/server.ts'],
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
