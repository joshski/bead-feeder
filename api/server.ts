import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 3001

async function runBdList(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bd', ['list', '--json'], {
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
        reject(new Error(`bd list failed with code ${code}: ${stderr}`))
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
        const json = await runBdList()
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
