import { spawn } from 'node:child_process'
import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'
import { type BdIssue, buildGraphsFromIssues } from './buildGraphsFromIssues'
import { getLocalRepoPath, getRepoPath } from './config'
import { createFakeChatStream, isFakeModeEnabled } from './fake-chat'
import {
  createCommit,
  listUserRepositories,
  runBdSync,
  stageFiles,
} from './git-service'
import * as log from './logger'
import { openaiTools } from './openai-tools'
import { getSyncQueue } from './sync-queue'
import { executeTool } from './tool-executor'

const PORT = process.env.PORT || 3001
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

const openai = new OpenAI()

function getTokenFromCookies(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    })
  )
  return cookies.github_token || null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are an AI assistant that helps users manage their project's dependency graph using the beads issue tracking system.

You have access to tools that let you:
- Create new issues (tasks, bugs, features)
- Add dependencies between issues (to show that one issue blocks another)
- Remove dependencies
- Update issue properties (title, description, type, priority, status)
- Close issues when they are completed

When users ask you to perform these actions, use the appropriate tools. After using a tool, briefly confirm what you did.

Keep your responses concise and helpful. When listing or discussing issues, use their issue IDs so users can reference them.`

async function runBdCommand(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bd', args, {
      cwd: cwd ?? process.cwd(),
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

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)

  // Get origin for CORS - allow localhost for development
  const origin = req.headers.get('origin') || 'http://localhost:5173'

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
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
    const owner = url.searchParams.get('owner')
    const repo = url.searchParams.get('repo')

    // If owner and repo provided, fetch from GitHub
    if (owner && repo) {
      const token = getTokenFromCookies(req)
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        )
      }

      try {
        // Fetch issues.jsonl via GitHub Contents API
        const ghResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/.beads/issues.jsonl`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
            },
          }
        )

        if (!ghResponse.ok) {
          if (ghResponse.status === 404) {
            // No issues file, return empty graph
            return new Response(JSON.stringify([]), {
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
              },
            })
          }
          throw new Error(`GitHub API error: ${ghResponse.status}`)
        }

        const ghData = (await ghResponse.json()) as {
          content?: string
          encoding?: string
        }

        if (!ghData.content) {
          return new Response(JSON.stringify([]), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          })
        }

        // Decode base64 content
        const decoded = atob(ghData.content.replace(/\n/g, ''))
        const lines = decoded.trim().split('\n').filter(Boolean)

        // Parse JSONL and filter out tombstones
        const issues: BdIssue[] = lines
          .map(line => JSON.parse(line) as BdIssue)
          .filter(issue => issue.status !== 'tombstone')

        // Build graph format from issues
        const graphs = buildGraphsFromIssues(issues)

        return new Response(JSON.stringify(graphs), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          },
        })
      }
    }

    // No owner/repo - use local bd command
    // Optionally use 'local' query param to specify repository path
    const localPath = url.searchParams.get('local')
    try {
      const json = await runBdCommand(
        ['graph', '--all', '--json'],
        localPath ?? undefined
      )
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

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await req.json()
      const { messages, owner, repo } = body as {
        messages?: ChatMessage[]
        owner?: string
        repo?: string
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'messages is required and must be a non-empty array',
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

      // Compute working directory for bd commands based on repository context
      const repoWorkDir =
        owner && repo ? getRepoPath(owner, repo) : getLocalRepoPath()

      // Use fake chat handler in fake mode (for e2e testing without AI costs)
      if (isFakeModeEnabled()) {
        const fakeStream = createFakeChatStream(messages, repoWorkDir)
        return new Response(fakeStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }

      // Convert chat messages to OpenAI format
      const openaiMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(
          m =>
            ({
              role: m.role,
              content: m.content,
            }) as ChatCompletionMessageParam
        ),
      ]

      const responseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          const currentMessages = [...openaiMessages]
          const toolsUsed: string[] = []

          // Agentic loop - keep running until no more tool calls
          while (true) {
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o',
              max_tokens: 1024,
              messages: currentMessages,
              tools: openaiTools,
              stream: true,
            })

            // Collect the full response
            let textContent = ''
            const toolCalls: ChatCompletionMessageToolCall[] = []
            // Track partial tool calls as they stream in
            const partialToolCalls: Map<
              number,
              { id: string; name: string; arguments: string }
            > = new Map()

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta

              // Handle text content
              if (delta?.content) {
                textContent += delta.content
                const data = `data: ${JSON.stringify({ text: delta.content })}\n\n`
                controller.enqueue(encoder.encode(data))
              }

              // Handle tool calls (they stream in incrementally)
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index
                  let partial = partialToolCalls.get(index)

                  if (!partial) {
                    partial = { id: '', name: '', arguments: '' }
                    partialToolCalls.set(index, partial)
                  }

                  if (toolCallDelta.id) {
                    partial.id = toolCallDelta.id
                  }
                  if (toolCallDelta.function?.name) {
                    partial.name = toolCallDelta.function.name
                  }
                  if (toolCallDelta.function?.arguments) {
                    partial.arguments += toolCallDelta.function.arguments
                  }
                }
              }
            }

            // Convert partial tool calls to complete tool calls
            for (const [, partial] of partialToolCalls) {
              if (partial.id && partial.name) {
                toolCalls.push({
                  id: partial.id,
                  type: 'function',
                  function: {
                    name: partial.name,
                    arguments: partial.arguments,
                  },
                })
              }
            }

            // If no tool calls, we're done
            if (toolCalls.length === 0) {
              break
            }

            // Execute tools and build tool results
            const toolResults: {
              role: 'tool'
              tool_call_id: string
              content: string
            }[] = []
            const commitMessages: string[] = []
            for (const toolCall of toolCalls) {
              toolsUsed.push(toolCall.function.name)
              const args = JSON.parse(toolCall.function.arguments)
              const result = await executeTool(
                toolCall.function.name,
                args,
                repoWorkDir
              )

              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result.success
                  ? JSON.stringify(result.result)
                  : `Error: ${result.error}`,
              })

              // Collect commit messages from successful tool executions
              if (result.success && result.commitMessage) {
                commitMessages.push(result.commitMessage)
              }
            }

            // If any tools modified beads, commit the changes and sync
            if (commitMessages.length > 0) {
              const commitMessage =
                commitMessages.length === 1
                  ? commitMessages[0]
                  : `feat(beads): Multiple changes\n\n${commitMessages.map(m => `- ${m}`).join('\n')}`

              // Stage .beads directory changes
              const stageResult = await stageFiles(repoWorkDir, '.beads')
              if (stageResult.success) {
                // Create commit
                const commitResult = await createCommit(
                  repoWorkDir,
                  commitMessage
                )
                if (commitResult.success) {
                  log.info(`Committed beads changes: ${commitMessage}`)
                  // Run bd sync to keep beads in sync with git
                  const syncResult = await runBdSync(repoWorkDir)
                  if (syncResult.success) {
                    log.info('bd sync completed successfully')
                  } else {
                    log.warn(`bd sync failed: ${syncResult.error}`)
                  }
                } else {
                  log.warn(
                    `Failed to commit beads changes: ${commitResult.error}`
                  )
                }
              } else {
                log.warn(`Failed to stage .beads: ${stageResult.error}`)
              }
            }

            // Add assistant message with tool calls
            currentMessages.push({
              role: 'assistant',
              content: textContent || null,
              tool_calls: toolCalls,
            })

            // Add tool results
            for (const toolResult of toolResults) {
              currentMessages.push(toolResult)
            }
          }

          // Send graph update notification if tools were used
          if (toolsUsed.length > 0) {
            const graphUpdate = `data: ${JSON.stringify({ graphUpdated: true, toolsUsed })}\n\n`
            controller.enqueue(encoder.encode(graphUpdate))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
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

  // GitHub OAuth callback - exchange code for access token
  if (url.pathname === '/api/auth/github/callback' && req.method === 'POST') {
    try {
      const body = await req.json()
      const { code } = body as { code?: string }

      if (!code || typeof code !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Authorization code is required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        )
      }

      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: 'GitHub OAuth is not configured' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        )
      }

      // Exchange code for access token
      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      })

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string
        error?: string
        error_description?: string
      }

      if (tokenData.error || !tokenData.access_token) {
        return new Response(
          JSON.stringify({
            error: tokenData.error_description || 'Failed to exchange code',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        )
      }

      // Fetch user info to return with the response
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      })

      const userData = (await userResponse.json()) as {
        login?: string
        id?: number
        avatar_url?: string
        name?: string
      }

      // Set httpOnly cookie with the access token
      const cookieOptions = [
        `github_token=${tokenData.access_token}`,
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/',
        'Max-Age=86400', // 24 hours
      ].join('; ')

      return new Response(
        JSON.stringify({
          user: {
            login: userData.login,
            id: userData.id,
            avatar_url: userData.avatar_url,
            name: userData.name,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Set-Cookie': cookieOptions,
          },
        }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }
  }

  // Get current user - check if authenticated via cookie
  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=')
        return [key, val.join('=')]
      })
    )

    const token = cookies.github_token

    if (!token) {
      return new Response(JSON.stringify({ user: null }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }

    try {
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      })

      if (!userResponse.ok) {
        // Token is invalid, clear the cookie
        return new Response(JSON.stringify({ user: null }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Set-Cookie':
              'github_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
          },
        })
      }

      const userData = (await userResponse.json()) as {
        login?: string
        id?: number
        avatar_url?: string
        name?: string
      }

      return new Response(
        JSON.stringify({
          user: {
            login: userData.login,
            id: userData.id,
            avatar_url: userData.avatar_url,
            name: userData.name,
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          },
        }
      )
    } catch {
      return new Response(JSON.stringify({ user: null }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }
  }

  // Logout - clear the auth cookie
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie':
          'github_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      },
    })
  }

  // List user's GitHub repositories
  if (url.pathname === '/api/repos' && req.method === 'GET') {
    const token = getTokenFromCookies(req)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          },
        }
      )
    }

    const result = await listUserRepositories(token)

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }

    return new Response(JSON.stringify({ repos: result.repos }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  }

  // Conflict resolution endpoint
  if (url.pathname === '/api/sync/resolve' && req.method === 'POST') {
    const token = getTokenFromCookies(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }

    try {
      const body = await req.json()
      const resolution = body.resolution as 'theirs' | 'ours' | 'abort'

      if (!resolution || !['theirs', 'ours', 'abort'].includes(resolution)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid resolution. Must be "theirs", "ours", or "abort"',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        )
      }

      const syncQueue = getSyncQueue()
      syncQueue.setToken(token)
      syncQueue.enqueueResolve(resolution)

      return new Response(JSON.stringify({ success: true, resolution }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      })
    }
  }

  // SSE endpoint for sync status updates
  if (url.pathname === '/api/sync/events' && req.method === 'GET') {
    const syncQueue = getSyncQueue()

    const responseStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()

        // Send initial state
        const initialState = syncQueue.getState()
        const initialData = `data: ${JSON.stringify({ type: 'status', ...initialState })}\n\n`
        controller.enqueue(encoder.encode(initialData))

        // Subscribe to status changes
        const unsubscribeStatus = syncQueue.on('statusChange', data => {
          const statusData = data as {
            status: string
            state: {
              pendingJobs: number
              lastSync: number | null
              lastError: string | null
            }
          }
          const eventData = `data: ${JSON.stringify({ type: 'status', ...statusData.state, status: statusData.status })}\n\n`
          controller.enqueue(encoder.encode(eventData))
        })

        // Subscribe to sync complete events
        const unsubscribeComplete = syncQueue.on('syncComplete', data => {
          const completeData = data as { timestamp: number }
          const eventData = `data: ${JSON.stringify({ type: 'syncComplete', timestamp: completeData.timestamp })}\n\n`
          controller.enqueue(encoder.encode(eventData))
        })

        // Subscribe to sync error events
        const unsubscribeError = syncQueue.on('syncError', data => {
          const errorData = data as { job: unknown; error: string }
          const eventData = `data: ${JSON.stringify({ type: 'syncError', error: errorData.error })}\n\n`
          controller.enqueue(encoder.encode(eventData))
        })

        // Subscribe to conflict events
        const unsubscribeConflict = syncQueue.on('conflict', data => {
          const conflictData = data as {
            ahead: number
            behind: number
            message: string
            hasConflicts?: boolean
          }
          const eventData = `data: ${JSON.stringify({ type: 'conflict', ...conflictData })}\n\n`
          controller.enqueue(encoder.encode(eventData))
        })

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            // Connection closed
            clearInterval(heartbeatInterval)
          }
        }, 30000)

        // Cleanup on close - Bun doesn't have a clean way to detect client disconnect
        // so we rely on the heartbeat failing to clean up
        return () => {
          clearInterval(heartbeatInterval)
          unsubscribeStatus()
          unsubscribeComplete()
          unsubscribeError()
          unsubscribeConflict()
        }
      },
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  }

  return new Response('Not found', { status: 404 })
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const start = Date.now()
    const url = new URL(req.url)

    try {
      const response = await handleRequest(req)
      const durationMs = Date.now() - start

      // Don't log OPTIONS preflight or SSE connections
      if (req.method !== 'OPTIONS' && !url.pathname.includes('/events')) {
        log.logRequest(req.method, url.pathname, response.status, durationMs)
      }

      return response
    } catch (err) {
      const durationMs = Date.now() - start
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      log.error('Unhandled error', {
        method: req.method,
        path: url.pathname,
        error: errorMessage,
        durationMs,
      })

      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
})

log.info(`API server started on port ${server.port}`)
