import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

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

  const prompt = `Look at this screenshot of a DAG visualization app.
Verify that it shows issue nodes in the UI.

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{"verified": true/false, "issueCount": <number>, "description": "<brief description>"}

Set "verified" to true if you can see at least one issue node displayed.
Set "issueCount" to the number of visible issue nodes.`

  const { stdout } = await execAsync(
    `claude -p "${prompt}" "${absolutePath}"`,
    { maxBuffer: 1024 * 1024 }
  )

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
