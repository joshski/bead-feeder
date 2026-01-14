import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface VerificationResult {
  verified: boolean
  issueCount: number
  description: string
}

/**
 * Uses Claude Code CLI to verify that a screenshot shows issue nodes.
 * Returns verification result with issue count and description.
 */
export async function verifyScreenshotShowsIssues(
  screenshotPath: string
): Promise<VerificationResult> {
  const absolutePath = path.resolve(screenshotPath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Screenshot not found: ${absolutePath}`)
  }

  const prompt =
    `Read the image at ${absolutePath} and analyze it. ` +
    'This is a screenshot of a DAG visualization app. ' +
    'Count how many issue nodes (cards/boxes with titles) are visible. ' +
    'Respond with ONLY a JSON object: ' +
    '{"verified": true or false, "issueCount": NUMBER, "description": "DESCRIPTION"}. ' +
    'Set verified to true if you can see at least one issue node displayed in the graph.'

  console.log(`Running claude CLI to verify screenshot...`)

  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn('claude', ['--dangerously-skip-permissions', '-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let output = ''
    let errorOutput = ''

    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString()
    })

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${errorOutput}`))
      }
    })

    proc.on('error', (err: Error) => {
      reject(err)
    })

    // Timeout after 2 minutes
    setTimeout(() => {
      proc.kill()
      reject(new Error('Claude CLI timed out after 120 seconds'))
    }, 120000)
  })

  console.log(`Claude response: ${stdout.substring(0, 200)}...`)

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = stdout.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr
      .replace(/```json?\n?/g, '')
      .replace(/```/g, '')
      .trim()
  }

  try {
    const result = JSON.parse(jsonStr) as VerificationResult
    return result
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${stdout}`)
  }
}
