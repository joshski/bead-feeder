import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 3001

async function runBdCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: process.cwd(),
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
        resolve(stdout)
      } else {
        reject(
          new Error(`bd ${args.join(' ')} failed with code ${code}: ${stderr}`)
        )
      }
    })

    proc.on('error', err => {
      reject(err)
    })
  })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (url.pathname === '/api/issues' && req.method === 'GET') {
      try {
        const json = await runBdCommand(['list', '--json'])
        return new Response(json, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    if (url.pathname === '/api/issues' && req.method === 'POST') {
      try {
        const body = await req.json()
        const { title, description, type, priority } = body as {
          title?: string
          description?: string
          type?: string
          priority?: number
        }

        if (!title || typeof title !== 'string' || title.trim() === '') {
          return new Response(
            JSON.stringify({
              error: 'title is required and must be a non-empty string',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          )
        }

        const args = ['create', title.trim(), '--json']

        if (description && typeof description === 'string') {
          args.push('--description', description)
        }

        if (type && typeof type === 'string') {
          args.push('--type', type)
        }

        if (priority !== undefined && typeof priority === 'number') {
          args.push('--priority', String(priority))
        }

        const json = await runBdCommand(args)
        return new Response(json, {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    if (url.pathname === '/api/dependencies' && req.method === 'POST') {
      try {
        const body = await req.json()
        const { blocked, blocker } = body as {
          blocked?: string
          blocker?: string
        }

        if (!blocked || typeof blocked !== 'string' || blocked.trim() === '') {
          return new Response(
            JSON.stringify({
              error: 'blocked is required and must be a non-empty string',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          )
        }

        if (!blocker || typeof blocker !== 'string' || blocker.trim() === '') {
          return new Response(
            JSON.stringify({
              error: 'blocker is required and must be a non-empty string',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          )
        }

        // Run bd dep add <blocked> <blocker> --json
        const json = await runBdCommand([
          'dep',
          'add',
          blocked.trim(),
          blocker.trim(),
          '--json',
        ])
        return new Response(json, {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        // Check for cycle detection errors from bd
        if (message.includes('cycle') || message.includes('circular')) {
          return new Response(
            JSON.stringify({
              error: 'Adding this dependency would create a cycle',
              details: message,
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          )
        }

        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    if (url.pathname === '/api/graph' && req.method === 'GET') {
      try {
        const json = await runBdCommand(['graph', '--all', '--json'])
        return new Response(json, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`API server listening on http://localhost:${server.port}`)
