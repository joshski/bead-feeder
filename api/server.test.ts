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
        if (data.toString().includes('API server started')) {
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
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(response.ok).toBe(true)
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173'
    )
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'GET'
    )
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true'
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

  it('GET /api/graph returns dependencies as an array or null', async () => {
    const response = await fetch(`http://localhost:${port}/api/graph`)
    const graphs = await response.json()

    if (graphs.length > 0) {
      const graph = graphs[0]
      // Dependencies can be null when there are no dependencies, or an array
      expect(
        graph.Dependencies === null || Array.isArray(graph.Dependencies)
      ).toBe(true)

      if (Array.isArray(graph.Dependencies) && graph.Dependencies.length > 0) {
        const dep = graph.Dependencies[0]
        expect(dep).toHaveProperty('issue_id')
        expect(dep).toHaveProperty('depends_on_id')
        expect(dep).toHaveProperty('type')
      }
    }
  })

  describe('POST /api/issues - validation', () => {
    // Note: We only test validation here, not successful issue creation,
    // to avoid creating test artifacts in the local beads repository.
    // Successful issue creation is tested via mocked unit tests in tool-executor.test.ts

    it('returns 400 for missing title', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No title' }),
      })

      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('title')
    })

    it('returns 400 for empty title', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
      })

      expect(response.status).toBe(400)
    })

    it('includes CORS headers on validation error response', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No title' }),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })

  describe('POST /api/dependencies - validation', () => {
    // Note: We only test validation here, not successful dependency creation,
    // to avoid creating test artifacts in the local beads repository.

    it('returns 400 for missing blocked', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocker: 'some-id' }),
        }
      )

      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('blocked')
    })

    it('returns 400 for missing blocker', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked: 'some-id' }),
        }
      )

      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('blocker')
    })

    it('returns 400 for empty blocked', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked: '   ', blocker: 'some-id' }),
        }
      )

      expect(response.status).toBe(400)
    })

    it('includes CORS headers on validation error response', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocker: 'some-id' }),
        }
      )

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })

  describe('Auth endpoints', () => {
    it('POST /api/auth/github/callback returns 400 for missing code', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/auth/github/callback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )

      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('code')
    })

    it('POST /api/auth/github/callback returns 400 for invalid code', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/auth/github/callback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'invalid-test-code' }),
        }
      )

      // Invalid code should return 400 with error message
      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
    })

    it('POST /api/auth/github/callback includes CORS headers', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/auth/github/callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://localhost:5173',
          },
          body: JSON.stringify({}),
        }
      )

      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      )
    })

    it('GET /api/auth/me returns null user when not authenticated', async () => {
      const response = await fetch(`http://localhost:${port}/api/auth/me`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toHaveProperty('user', null)
    })

    it('GET /api/auth/me includes CORS headers', async () => {
      const response = await fetch(`http://localhost:${port}/api/auth/me`, {
        headers: { Origin: 'http://localhost:5173' },
      })

      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      )
    })

    it('POST /api/auth/logout clears the cookie', async () => {
      const response = await fetch(`http://localhost:${port}/api/auth/logout`, {
        method: 'POST',
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toHaveProperty('success', true)

      // Check that cookie is being cleared
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('github_token=')
      expect(setCookie).toContain('Max-Age=0')
    })
  })

  describe('POST /api/chat - validation', () => {
    it('returns 400 for missing messages', async () => {
      const response = await fetch(`http://localhost:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('messages')
    })

    it('returns 400 for empty messages array', async () => {
      const response = await fetch(`http://localhost:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      })

      expect(response.status).toBe(400)
    })

    it('returns 400 for non-array messages', async () => {
      const response = await fetch(`http://localhost:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: 'not an array' }),
      })

      expect(response.status).toBe(400)
    })

    it('includes CORS headers on error response', async () => {
      const response = await fetch(`http://localhost:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })

  describe('GET /api/graph with owner/repo', () => {
    it('returns 401 when owner/repo provided without authentication', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/graph?owner=test-owner&repo=test-repo`
      )

      expect(response.status).toBe(401)
      const error = await response.json()
      expect(error).toHaveProperty('error', 'Authentication required')
    })

    it('includes CORS headers when owner/repo provided', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/graph?owner=test-owner&repo=test-repo`,
        {
          headers: { Origin: 'http://localhost:5173' },
        }
      )

      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      )
    })

    it('falls back to local bd command when no owner/repo', async () => {
      const response = await fetch(`http://localhost:${port}/api/graph`)

      expect(response.ok).toBe(true)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
    })
  })

  describe('POST /api/repos/:owner/:repo/pull', () => {
    it('returns 401 without authentication', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/repos/test-owner/test-repo/pull`,
        {
          method: 'POST',
        }
      )

      expect(response.status).toBe(401)
      const error = await response.json()
      expect(error).toHaveProperty('error', 'Authentication required')
    })

    it('includes CORS headers on response', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/repos/test-owner/test-repo/pull`,
        {
          method: 'POST',
          headers: { Origin: 'http://localhost:5173' },
        }
      )

      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      )
    })
  })

  describe('POST /api/sync/resolve', () => {
    it('returns 401 without authentication', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/sync/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution: 'theirs' }),
        }
      )

      expect(response.status).toBe(401)
      const error = await response.json()
      expect(error).toHaveProperty('error', 'Unauthorized')
    })

    it('returns 400 for invalid resolution', async () => {
      // This will fail auth first, but tests the validation path
      const response = await fetch(
        `http://localhost:${port}/api/sync/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'github_token=test-token',
          },
          body: JSON.stringify({ resolution: 'invalid' }),
        }
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 for missing resolution', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/sync/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'github_token=test-token',
          },
          body: JSON.stringify({}),
        }
      )

      expect(response.status).toBe(400)
    })

    it('includes CORS headers on response', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/sync/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution: 'theirs' }),
        }
      )

      expect(response.headers.get('access-control-allow-origin')).toBeDefined()
      expect(response.headers.get('access-control-allow-credentials')).toBe(
        'true'
      )
    })
  })
})
