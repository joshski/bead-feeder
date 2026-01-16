/**
 * Fake AI chat handler for testing.
 * Responds to messages with predictable tool calls without calling the real Anthropic API.
 * Tool calls are actually executed so the UI responds as if real AI was used.
 */

import { executeTool } from './tool-executor'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface FakeToolCall {
  name: string
  input: Record<string, unknown>
}

interface FakeResponse {
  text: string
  toolCalls?: FakeToolCall[]
}

/**
 * Parse a user message to determine what tool calls to make.
 * This is a simple pattern-matching approach for testing.
 */
function parseUserIntent(message: string): FakeResponse {
  const lowerMessage = message.toLowerCase()

  // Pattern: "create issue <title>" or "create a task/bug/feature called <title>"
  const createMatch = message.match(
    /create\s+(?:an?\s+)?(?:issue|task|bug|feature)\s+(?:called\s+)?["']?([^"']+)["']?/i
  )
  if (createMatch) {
    const title = createMatch[1].trim()
    const type = lowerMessage.includes('bug')
      ? 'bug'
      : lowerMessage.includes('feature')
        ? 'feature'
        : 'task'
    return {
      text: `I'll create a ${type} called "${title}".`,
      toolCalls: [
        {
          name: 'create_issue',
          input: { title, type },
        },
      ],
    }
  }

  // Pattern: "close issue <id>" or "close <id>"
  const closeMatch = message.match(/close\s+(?:issue\s+)?([a-z0-9-]+)/i)
  if (closeMatch) {
    const issueId = closeMatch[1]
    return {
      text: `I'll close issue ${issueId}.`,
      toolCalls: [
        {
          name: 'close_issue',
          input: { issue_id: issueId },
        },
      ],
    }
  }

  // Pattern: "update issue <id> status to <status>"
  const updateStatusMatch = message.match(
    /update\s+(?:issue\s+)?([a-z0-9-]+)\s+(?:status\s+)?to\s+(open|in_progress|closed)/i
  )
  if (updateStatusMatch) {
    const issueId = updateStatusMatch[1]
    const status = updateStatusMatch[2].toLowerCase()
    return {
      text: `I'll update issue ${issueId} status to ${status}.`,
      toolCalls: [
        {
          name: 'update_issue',
          input: { issue_id: issueId, status },
        },
      ],
    }
  }

  // Pattern: "add dependency <blocked> depends on <blocker>"
  const addDepMatch = message.match(
    /(?:add\s+dependency\s+)?([a-z0-9-]+)\s+depends\s+on\s+([a-z0-9-]+)/i
  )
  if (addDepMatch) {
    const blockedId = addDepMatch[1]
    const blockerId = addDepMatch[2]
    return {
      text: `I'll add a dependency: ${blockedId} depends on ${blockerId}.`,
      toolCalls: [
        {
          name: 'add_dependency',
          input: { blocked_issue_id: blockedId, blocker_issue_id: blockerId },
        },
      ],
    }
  }

  // Pattern: "remove dependency <blocked> depends on <blocker>"
  const removeDepMatch = message.match(
    /remove\s+dependency\s+([a-z0-9-]+)\s+(?:depends\s+on\s+)?([a-z0-9-]+)/i
  )
  if (removeDepMatch) {
    const blockedId = removeDepMatch[1]
    const blockerId = removeDepMatch[2]
    return {
      text: `I'll remove the dependency between ${blockedId} and ${blockerId}.`,
      toolCalls: [
        {
          name: 'remove_dependency',
          input: { blocked_issue_id: blockedId, blocker_issue_id: blockerId },
        },
      ],
    }
  }

  // Default: just respond with a helpful message
  return {
    text: "I can help you manage issues. Try saying things like:\n- Create a task called 'Fix login bug'\n- Close issue abc-123\n- Update issue xyz-456 status to in_progress\n- abc-123 depends on xyz-456",
  }
}

/**
 * Create a fake chat response stream.
 * Returns an SSE stream that mimics the real Anthropic streaming response.
 * Tool calls are actually executed so the UI behaves as if real AI was used.
 * @param messages - Chat messages
 * @param cwd - Working directory for bd commands (defaults to process.cwd())
 */
export function createFakeChatStream(
  messages: ChatMessage[],
  cwd?: string
): ReadableStream {
  const encoder = new TextEncoder()
  console.log(
    '[FAKE_CHAT] Creating fake chat stream for',
    messages.length,
    'messages'
  )
  if (cwd) {
    console.log('[FAKE_CHAT] Using working directory:', cwd)
  }

  return new ReadableStream({
    async start(controller) {
      // Get the last user message
      const lastMessage = messages.findLast(m => m.role === 'user')
      console.log('[FAKE_CHAT] Last user message:', lastMessage?.content)
      if (!lastMessage) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: 'No message provided' })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        return
      }

      // Parse the user's intent and generate a response
      const response = parseUserIntent(lastMessage.content)
      console.log('[FAKE_CHAT] Generated response:', response.text)
      if (response.toolCalls) {
        console.log(
          '[FAKE_CHAT] Will execute',
          response.toolCalls.length,
          'tool calls'
        )
      }

      // Actually execute the tool calls so changes are reflected in the graph
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults: string[] = []
        for (const toolCall of response.toolCalls) {
          const result = await executeTool(toolCall.name, toolCall.input, cwd)
          if (result.success) {
            toolResults.push(
              `✓ Executed ${toolCall.name}: ${JSON.stringify(result.result)}`
            )
          } else {
            toolResults.push(`✗ ${toolCall.name} failed: ${result.error}`)
          }
        }

        // Append tool results to the response text
        response.text += `\n\n${toolResults.join('\n')}`
      }

      // Stream the text response in chunks (simulating streaming)
      // Use word-based chunks for more reliable delivery
      const words = response.text.split(/(\s+)/)
      for (const word of words) {
        if (word) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: word })}\n\n`)
          )
        }
      }

      // If there were tool calls, send a graph update notification
      if (response.toolCalls && response.toolCalls.length > 0) {
        const graphUpdate = `data: ${JSON.stringify({
          graphUpdated: true,
          toolsUsed: response.toolCalls.map(tc => tc.name),
        })}\n\n`
        controller.enqueue(encoder.encode(graphUpdate))
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/**
 * Check if fake mode is enabled
 */
export function isFakeModeEnabled(): boolean {
  const enabled = process.env.FAKE_MODE === 'true'
  if (enabled) {
    console.log('[FAKE_MODE] Fake mode is ENABLED')
  }
  return enabled
}
