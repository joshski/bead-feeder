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

  describe('POST /api/issues', () => {
    const createdIssueIds: string[] = []

    afterAll(async () => {
      // Clean up created test issues
      for (const id of createdIssueIds) {
        try {
          await fetch(`http://localhost:${port}/api/issues/${id}`, {
            method: 'DELETE',
          })
        } catch {
          // Ignore cleanup errors - bd close will be used manually if needed
        }
      }
    })

    it('creates an issue with title only', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test API Issue' }),
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('content-type')).toBe('application/json')

      const issue = await response.json()
      expect(issue).toHaveProperty('id')
      expect(issue.title).toBe('Test API Issue')
      expect(issue.status).toBe('open')
      createdIssueIds.push(issue.id)
    })

    it('creates an issue with all fields', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Full Issue',
          description: 'Test description',
          type: 'bug',
          priority: 1,
        }),
      })

      expect(response.status).toBe(201)

      const issue = await response.json()
      expect(issue.title).toBe('Test Full Issue')
      expect(issue.description).toBe('Test description')
      expect(issue.issue_type).toBe('bug')
      expect(issue.priority).toBe(1)
      createdIssueIds.push(issue.id)
    })

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

    it('includes CORS headers on POST response', async () => {
      const response = await fetch(`http://localhost:${port}/api/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'CORS Test Issue' }),
      })

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      if (response.status === 201) {
        const issue = await response.json()
        createdIssueIds.push(issue.id)
      }
    })
  })

  describe('POST /api/dependencies', () => {
    const createdIssueIds: string[] = []
    const createdDependencies: { blocked: string; blocker: string }[] = []

    beforeAll(async () => {
      // Create two test issues to use for dependency tests
      const issue1Response = await fetch(
        `http://localhost:${port}/api/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Dep Test Issue 1' }),
        }
      )
      const issue1 = await issue1Response.json()
      createdIssueIds.push(issue1.id)

      const issue2Response = await fetch(
        `http://localhost:${port}/api/issues`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Dep Test Issue 2' }),
        }
      )
      const issue2 = await issue2Response.json()
      createdIssueIds.push(issue2.id)
    })

    afterAll(async () => {
      // Clean up created dependencies
      for (const dep of createdDependencies) {
        try {
          const { spawn } = await import('node:child_process')
          const proc = spawn(
            'bd',
            ['dep', 'remove', dep.blocked, dep.blocker],
            {
              cwd: process.cwd(),
            }
          )
          await new Promise(resolve => proc.on('close', resolve))
        } catch {
          // Ignore cleanup errors
        }
      }
      // Clean up issues would happen via bd close, but we'll leave them
    })

    it('creates a dependency between two issues', async () => {
      const blocked = createdIssueIds[0]
      const blocker = createdIssueIds[1]

      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked, blocker }),
        }
      )

      expect(response.status).toBe(201)
      expect(response.headers.get('content-type')).toBe('application/json')

      const result = await response.json()
      expect(result).toHaveProperty('issue_id', blocked)
      expect(result).toHaveProperty('depends_on_id', blocker)
      createdDependencies.push({ blocked, blocker })
    })

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

    it('includes CORS headers on POST response', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/dependencies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked: 'a', blocker: 'b' }),
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

    it('POST /api/auth/github/callback returns 500 when OAuth not configured', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/auth/github/callback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'test-code' }),
        }
      )

      // Without GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, should return 500
      expect(response.status).toBe(500)
      const error = await response.json()
      expect(error).toHaveProperty('error')
      expect(error.error).toContain('not configured')
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

  describe('POST /api/chat', () => {
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
