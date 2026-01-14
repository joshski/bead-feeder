import { spawn } from 'node:child_process'
import Anthropic from '@anthropic-ai/sdk'
import type {
  ContentBlock,
  MessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'
import { llmTools } from './llm-tools'
import { executeTool } from './tool-executor'

const PORT = process.env.PORT || 3001
const anthropic = new Anthropic()

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

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      try {
        const body = await req.json()
        const { messages } = body as { messages?: ChatMessage[] }

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

        // Convert chat messages to Anthropic format
        const anthropicMessages: MessageParam[] = messages.map(m => ({
          role: m.role,
          content: m.content,
        }))

        const responseStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()
            const currentMessages = [...anthropicMessages]
            const toolsUsed: string[] = []

            // Agentic loop - keep running until no more tool calls
            while (true) {
              const stream = anthropic.messages.stream({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: currentMessages,
                tools: llmTools,
              })

              // Collect the full response
              let textContent = ''
              const toolUseBlocks: ToolUseBlock[] = []
              let stopReason: string | null = null

              for await (const event of stream) {
                if (
                  event.type === 'content_block_delta' &&
                  event.delta.type === 'text_delta'
                ) {
                  textContent += event.delta.text
                  const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
                  controller.enqueue(encoder.encode(data))
                }

                if (event.type === 'message_delta') {
                  stopReason = event.delta.stop_reason
                }
              }

              // Get the final message to extract tool use blocks
              const finalMessage = await stream.finalMessage()
              for (const block of finalMessage.content) {
                if (block.type === 'tool_use') {
                  toolUseBlocks.push(block)
                }
              }

              // If no tool use, we're done
              if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
                break
              }

              // Execute tools and build tool results
              const toolResults: ToolResultBlockParam[] = []
              for (const toolUse of toolUseBlocks) {
                toolsUsed.push(toolUse.name)
                const result = await executeTool(toolUse.name, toolUse.input)

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: result.success
                    ? JSON.stringify(result.result)
                    : `Error: ${result.error}`,
                  is_error: !result.success,
                })
              }

              // Add assistant message with content blocks
              const assistantContent: ContentBlock[] = []
              if (textContent) {
                assistantContent.push({ type: 'text', text: textContent })
              }
              for (const toolUse of toolUseBlocks) {
                assistantContent.push(toolUse)
              }

              currentMessages.push({
                role: 'assistant',
                content: assistantContent,
              })

              // Add tool results as user message
              currentMessages.push({
                role: 'user',
                content: toolResults,
              })
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

    return new Response('Not found', { status: 404 })
  },
})

console.log(`API server listening on http://localhost:${server.port}`)
