#!/usr/bin/env bun
/**
 * Development script that runs both the Vite dev server and API server
 * with combined output in a single stream.
 */

import { spawn } from 'bun'
import { DEV_PORTS } from '../config/ports'

const COLORS = {
  vite: '\x1b[36m', // cyan
  api: '\x1b[35m', // magenta
  reset: '\x1b[0m',
}

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

async function main() {
  console.log(`${COLORS.vite}[vite]${COLORS.reset} Starting Vite dev server...`)
  console.log(`${COLORS.api}[api]${COLORS.reset} Starting API server...`)
  console.log('')

  const viteProc = spawn({
    cmd: ['bun', 'run', 'vite', '--host', '--port', String(DEV_PORTS.VITE)],
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
    env: process.env,
  })

  const apiProc = spawn({
    cmd: ['bun', 'run', 'src/api/server.ts'],
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(DEV_PORTS.API),
    },
  })

  // Handle process termination
  const cleanup = () => {
    viteProc.kill()
    apiProc.kill()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Stream output from both processes (fire and forget - they run until process exits)
  streamOutput(viteProc.stdout, 'vite', COLORS.vite)
  streamOutput(viteProc.stderr, 'vite', COLORS.vite)
  streamOutput(apiProc.stdout, 'api', COLORS.api)
  streamOutput(apiProc.stderr, 'api', COLORS.api)

  // Wait for any process to exit
  const viteExit = viteProc.exited
  const apiExit = apiProc.exited

  await Promise.race([viteExit, apiExit])

  // If one exits, kill the other
  cleanup()
}

main().catch(err => {
  console.error('Error starting dev servers:', err)
  process.exit(1)
})
