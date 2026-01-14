import { type ChildProcess, spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('API Server', () => {
  let serverProcess: ChildProcess
  const port = 3099

  beforeAll(async () => {
    serverProcess = spawn('bun', ['run', 'api/server.ts'], {
      env: { ...process.env, PORT: String(port) },
      cwd: process.cwd(),
    })

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Server startup timeout')),
        5000
      )
      serverProcess.stdout?.on('data', data => {
        if (data.toString().includes('API server listening')) {
          clearTimeout(timeout)
          resolve()
        }
      })
      serverProcess.stderr?.on('data', data => {
        console.error('Server stderr:', data.toString())
      })
      serverProcess.on('error', err => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  })

  afterAll(() => {
    serverProcess?.kill()
  })

  it('GET /api/issues returns JSON array of issues', async () => {
    const response = await fetch(`http://localhost:${port}/api/issues`)

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toBe('application/json')

    const issues = await response.json()
    expect(Array.isArray(issues)).toBe(true)

    if (issues.length > 0) {
      const issue = issues[0]
      expect(issue).toHaveProperty('id')
      expect(issue).toHaveProperty('title')
      expect(issue).toHaveProperty('status')
    }
  })

  it('GET /api/issues includes CORS headers', async () => {
    const response = await fetch(`http://localhost:${port}/api/issues`)

    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('OPTIONS /api/issues returns CORS preflight response', async () => {
    const response = await fetch(`http://localhost:${port}/api/issues`, {
      method: 'OPTIONS',
    })

    expect(response.ok).toBe(true)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'GET'
    )
  })

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`http://localhost:${port}/unknown`)

    expect(response.status).toBe(404)
  })

  it('GET /api/graph returns JSON array of graph entries', async () => {
    const response = await fetch(`http://localhost:${port}/api/graph`)

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toBe('application/json')

    const graphs = await response.json()
    expect(Array.isArray(graphs)).toBe(true)

    if (graphs.length > 0) {
      const graph = graphs[0]
      expect(graph).toHaveProperty('Root')
      expect(graph).toHaveProperty('Issues')
      expect(graph).toHaveProperty('Dependencies')
      expect(graph).toHaveProperty('IssueMap')
    }
  })

  it('GET /api/graph includes CORS headers', async () => {
    const response = await fetch(`http://localhost:${port}/api/graph`)

    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('GET /api/graph returns dependencies as an array', async () => {
    const response = await fetch(`http://localhost:${port}/api/graph`)
    const graphs = await response.json()

    if (graphs.length > 0) {
      const graph = graphs[0]
      expect(Array.isArray(graph.Dependencies)).toBe(true)

      if (graph.Dependencies.length > 0) {
        const dep = graph.Dependencies[0]
        expect(dep).toHaveProperty('issue_id')
        expect(dep).toHaveProperty('depends_on_id')
        expect(dep).toHaveProperty('type')
      }
    }
  })
})
