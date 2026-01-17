#!/usr/bin/env bun
/**
 * E2E test runner that starts dev servers, waits for them to be ready,
 * runs all Playwright e2e tests, and cleans up.
 *
 * Uses a temporary data directory for test isolation so e2e tests don't
 * pollute the project's .beads directory.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawn } from 'bun'
import { TEST_PORTS } from '../config/ports'

const COLORS = {
  e2e: '\x1b[32m', // green
  server: '\x1b[90m', // gray
  reset: '\x1b[0m',
}

const VITE_URL = `http://localhost:${TEST_PORTS.VITE}`
const API_URL = `http://localhost:${TEST_PORTS.API}`
const MAX_WAIT_MS = 30000
const POLL_INTERVAL_MS = 500

function prefixLines(prefix: string, color: string, text: string): string {
  return text
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => `${color}[${prefix}]${COLORS.reset} ${line}`)
    .join('\n')
}

async function streamOutput(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
  color: string
) {
  const decoder = new TextDecoder()
  const reader = stream.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const prefixed = prefixLines(prefix, color, text)
    if (prefixed) {
      console.log(prefixed)
    }
  }
}

async function waitForServer(url: string, name: string): Promise<boolean> {
  const startTime = Date.now()
  console.log(
    `${COLORS.e2e}[e2e]${COLORS.reset} Waiting for ${name} at ${url}...`
  )

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) {
        console.log(
          `${COLORS.e2e}[e2e]${COLORS.reset} ${name} is ready (${Date.now() - startTime}ms)`
        )
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  console.error(`${COLORS.e2e}[e2e]${COLORS.reset} Timeout waiting for ${name}`)
  return false
}

async function main() {
  console.log(`${COLORS.e2e}[e2e]${COLORS.reset} Starting dev servers...`)

  // Create a temporary data directory for test isolation
  // This ensures e2e tests don't pollute the project's .beads directory
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-feeder-e2e-'))
  console.log(
    `${COLORS.e2e}[e2e]${COLORS.reset} Using temp data directory: ${tempDataDir}`
  )

  // Initialize a local beads repo in the temp directory
  // This is needed for the /local route in e2e tests
  const localBeadsDir = path.join(tempDataDir, 'local')
  fs.mkdirSync(localBeadsDir, { recursive: true })
  // Initialize git and beads in the local directory
  const initGit = Bun.spawn(['git', 'init'], { cwd: localBeadsDir })
  await initGit.exited
  const initBeads = Bun.spawn(['bd', 'init'], { cwd: localBeadsDir })
  await initBeads.exited
  console.log(
    `${COLORS.e2e}[e2e]${COLORS.reset} Initialized local beads repo at ${localBeadsDir}`
  )

  // Start Vite dev server on test port
  const viteProc = spawn({
    cmd: ['bun', 'run', 'vite', '--host', '--port', String(TEST_PORTS.VITE)],
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${TEST_PORTS.API}`,
    },
  })

  // Start API server on test port with temp data directory
  const apiProc = spawn({
    cmd: ['bun', 'run', 'api/server.ts'],
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORTS.API),
      BEAD_FEEDER_GITHUB_REPOS_DIR: localBeadsDir,
    },
  })

  const cleanup = () => {
    viteProc.kill()
    apiProc.kill()
    // Clean up temp directory
    try {
      fs.rmSync(tempDataDir, { recursive: true, force: true })
      console.log(
        `${COLORS.e2e}[e2e]${COLORS.reset} Cleaned up temp directory: ${tempDataDir}`
      )
    } catch (err) {
      console.warn(
        `${COLORS.e2e}[e2e]${COLORS.reset} Failed to clean up temp directory:`,
        err
      )
    }
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Stream server output with muted colors
  streamOutput(viteProc.stdout, 'vite', COLORS.server)
  streamOutput(viteProc.stderr, 'vite', COLORS.server)
  streamOutput(apiProc.stdout, 'api', COLORS.server)
  streamOutput(apiProc.stderr, 'api', COLORS.server)

  // Wait for both servers to be ready
  const [viteReady, apiReady] = await Promise.all([
    waitForServer(VITE_URL, 'Vite'),
    waitForServer(`${API_URL}/api/issues`, 'API'),
  ])

  if (!viteReady || !apiReady) {
    console.error(
      `${COLORS.e2e}[e2e]${COLORS.reset} Failed to start servers, aborting tests`
    )
    cleanup()
    process.exit(1)
  }

  console.log(`${COLORS.e2e}[e2e]${COLORS.reset} Running Playwright tests...`)
  console.log('')

  // Run Playwright tests
  const testProc = spawn({
    cmd: ['bunx', 'playwright', 'test'],
    stdout: 'inherit',
    stderr: 'inherit',
    cwd: process.cwd(),
  })

  const testExitCode = await testProc.exited

  // Clean up dev servers
  console.log('')
  console.log(`${COLORS.e2e}[e2e]${COLORS.reset} Shutting down servers...`)
  cleanup()

  process.exit(testExitCode)
}

main().catch(err => {
  console.error('Error running e2e tests:', err)
  process.exit(1)
})
