import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { type Browser, chromium, type Locator, type Page } from 'playwright'
import { TEST_PORTS } from '../config/ports'

/**
 * Helper to wait for a locator to be visible.
 * Replaces Playwright's expect(...).toBeVisible() which isn't available in bun:test.
 */
async function waitForVisible(
  locator: Locator,
  options?: { timeout?: number }
): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: options?.timeout ?? 5000 })
}

/**
 * Helper to wait for a locator to be hidden/detached.
 * Replaces Playwright's expect(...).not.toBeVisible() which isn't available in bun:test.
 */
async function waitForHidden(
  locator: Locator,
  options?: { timeout?: number }
): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout: options?.timeout ?? 5000 })
}

const BASE_URL = `http://localhost:${TEST_PORTS.VITE}`

// Source repository to fork for testing
const SOURCE_REPO_OWNER = 'joshski'
const SOURCE_REPO_NAME = 'bead-feeder-example-issues'

// Shared state for fork management
let forkRepoName: string | null = null
let clonedRepoPath: string | null = null
let testUsername: string | null = null
let testPat: string | null = null

// Browser state
let browser: Browser
let page: Page

// Data structure representing issues and their dependencies extracted from beads CLI
interface BeadsIssue {
  id: string
  title: string
  status: string
  priority: number
  issue_type: string
  dependency_count: number
  dependent_count: number
}

interface BeadsDependency {
  issue_id: string
  depends_on_id: string
  type: string
}

interface BeadsData {
  issues: BeadsIssue[]
  dependencies: BeadsDependency[]
}

// Shared extracted data (available for later comparison with DAG view)
let extractedBeadsData: BeadsData | null = null

// Data structure representing issues and dependencies extracted from DAG view UI
interface DagIssue {
  id: string
  title: string
  status: string
  priority: string
  issue_type: string
}

interface DagDependency {
  issue_id: string // blocked issue
  depends_on_id: string // blocker issue
}

interface DagData {
  issues: DagIssue[]
  dependencies: DagDependency[]
}

// Shared extracted DAG data (available for comparison with beads CLI data)
let extractedDagData: DagData | null = null

/**
 * Create a fork of the source repository with a unique name.
 * Uses gh CLI with PAT from TEST_GITHUB_PERSONAL_ACCESS_TOKEN env var.
 */
function createTestFork(username: string, pat: string): string {
  // Generate unique fork name with timestamp
  const timestamp = Date.now()
  const forkName = `bead-feeder-e2e-${timestamp}`

  console.log(`Creating fork: ${username}/${forkName}`)

  // Use GH_TOKEN env var instead of gh auth login to avoid modifying global gh config
  const ghEnv = { ...process.env, GH_TOKEN: pat }

  // Create the fork with a custom name
  try {
    execSync(
      `gh repo fork ${SOURCE_REPO_OWNER}/${SOURCE_REPO_NAME} --fork-name ${forkName} --clone=false`,
      {
        stdio: 'pipe',
        env: ghEnv,
      }
    )
    console.log(`Created fork: ${username}/${forkName}`)
  } catch (error) {
    throw new Error(
      `Failed to create fork: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Wait a moment for GitHub to process the fork
  execSync('sleep 5')

  return forkName
}

/**
 * Clone the forked repository into a temporary directory.
 * Uses PAT for authentication with git.
 * Returns the path to the cloned repository.
 */
function cloneFork(owner: string, repo: string, pat: string): string {
  // Create a unique temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-feeder-e2e-'))

  // Build authenticated URL using PAT (URL-encode to handle special characters)
  const encodedPat = encodeURIComponent(pat)
  const authUrl = `https://${encodedPat}@github.com/${owner}/${repo}.git`

  // Clone the repository
  try {
    execSync(`git clone ${authUrl} ${tempDir}`, {
      stdio: 'pipe', // Suppress output to avoid leaking credentials
    })
    console.log(`Cloned fork to ${tempDir}`)
    return tempDir
  } catch (error) {
    // Clean up temp directory on failure
    fs.rmSync(tempDir, { recursive: true, force: true })
    throw new Error(
      `Failed to clone fork: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Delete the test fork using gh CLI
 * Uses GH_TOKEN env var for authentication to avoid modifying global gh config
 */
function deleteFork(owner: string, repo: string, pat: string): void {
  try {
    execSync(`gh repo delete ${owner}/${repo} --yes`, {
      stdio: 'pipe',
      env: { ...process.env, GH_TOKEN: pat },
    })
    console.log(`Deleted fork: ${owner}/${repo}`)
  } catch (error) {
    console.warn(
      `Failed to delete fork ${owner}/${repo}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Clean up the cloned repository directory
 */
function cleanupClonedRepo(repoPath: string): void {
  try {
    fs.rmSync(repoPath, { recursive: true, force: true })
    console.log(`Cleaned up cloned repository at ${repoPath}`)
  } catch (error) {
    console.warn(
      `Failed to clean up ${repoPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Extract issues and dependencies from a beads repository using the CLI.
 * Runs `bd list --json` and `bd graph --all --json` in the specified directory.
 */
function extractBeadsData(repoPath: string): BeadsData {
  // Run bd sync first to ensure bd is up to date with any file changes
  try {
    execSync('bd sync', {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Ignore sync errors - it might fail if there are no changes
  }

  // Run bd list --json to get all issues
  const listOutput = execSync('bd list --json', {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const issues: BeadsIssue[] = JSON.parse(listOutput)

  // Run bd graph --all --json to get dependencies
  const graphOutput = execSync('bd graph --all --json', {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const graphData = JSON.parse(graphOutput)

  // Collect all unique dependencies from all graph entries
  const dependencyMap = new Map<string, BeadsDependency>()
  for (const entry of graphData) {
    if (entry.Dependencies) {
      for (const dep of entry.Dependencies) {
        // Use a unique key to avoid duplicates
        const key = `${dep.issue_id}-${dep.depends_on_id}`
        if (!dependencyMap.has(key)) {
          dependencyMap.set(key, {
            issue_id: dep.issue_id,
            depends_on_id: dep.depends_on_id,
            type: dep.type,
          })
        }
      }
    }
  }

  return {
    issues,
    dependencies: Array.from(dependencyMap.values()),
  }
}

/**
 * Pull latest changes from remote and extract beads data.
 * Uses PAT for authentication with git.
 */
function pullAndExtractBeadsData(
  repoPath: string,
  owner: string,
  pat: string
): BeadsData {
  // Pull latest changes using PAT for auth
  const encodedPat = encodeURIComponent(pat)
  const authUrl = `https://${encodedPat}@github.com/${owner}/${forkRepoName}.git`

  execSync(`git remote set-url origin ${authUrl}`, {
    cwd: repoPath,
    stdio: 'pipe',
  })

  // Get the current branch name first
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: repoPath,
    encoding: 'utf-8',
  }).trim()

  console.log(`Current branch: ${currentBranch}`)

  // Pull from the current branch
  const pullOutput = execSync(`git pull origin ${currentBranch}`, {
    cwd: repoPath,
    encoding: 'utf-8',
  })
  console.log(`Pull output: ${pullOutput}`)

  // Restore URL without credentials
  execSync(
    `git remote set-url origin https://github.com/${owner}/${forkRepoName}.git`,
    {
      cwd: repoPath,
      stdio: 'pipe',
    }
  )

  return extractBeadsData(repoPath)
}

/**
 * Take a screenshot and save it to the screenshots directory
 */
async function takeScreenshot(name: string): Promise<void> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }
  await page.screenshot({
    path: path.join(screenshotsDir, name),
    fullPage: true,
  })
}

describe('Load beads issues from GitHub repository', () => {
  beforeAll(async () => {
    // Launch browser
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
  })

  afterAll(async () => {
    // Close browser
    await page?.close()
    await browser?.close()

    // Clean up fork and cloned repository
    if (clonedRepoPath) {
      cleanupClonedRepo(clonedRepoPath)
      clonedRepoPath = null
    }
    if (forkRepoName && testUsername && testPat) {
      deleteFork(testUsername, forkRepoName, testPat)
      forkRepoName = null
      testPat = null
    }
  })

  it('authenticates and displays issues from test repository', async () => {
    const username = process.env.TEST_GITHUB_USERNAME
    const password = process.env.TEST_GITHUB_PASSWORD
    const pat = process.env.TEST_GITHUB_PERSONAL_ACCESS_TOKEN

    if (!username || !password) {
      throw new Error(
        'TEST_GITHUB_USERNAME and TEST_GITHUB_PASSWORD environment variables are required for browser login'
      )
    }

    if (!pat) {
      throw new Error(
        'TEST_GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required for gh CLI operations'
      )
    }

    testUsername = username
    testPat = pat

    // Step 0: Create a fresh fork with a unique name
    console.log('Step: Create test fork')
    forkRepoName = createTestFork(username, pat)
    console.log(`Test fork created: ${username}/${forkRepoName}`)

    // Step 1: Clone the fork into a temp directory
    console.log('Step: Clone fork to temp directory')
    if (!forkRepoName) {
      throw new Error('Fork was not created')
    }

    clonedRepoPath = cloneFork(username, forkRepoName, pat)
    console.log(`Fork cloned to: ${clonedRepoPath}`)

    // Verify the .beads directory exists in the cloned repo
    const beadsDir = path.join(clonedRepoPath, '.beads')
    if (fs.existsSync(beadsDir)) {
      console.log('.beads directory found in cloned repository')
    } else {
      console.warn(
        '.beads directory not found in cloned repository - test may not find issues'
      )
    }

    // Step 2: Extract issues and dependencies from cloned fork using beads CLI
    console.log('Step: Extract issues and dependencies from cloned fork')
    if (!clonedRepoPath) {
      throw new Error('Repository was not cloned')
    }

    extractedBeadsData = extractBeadsData(clonedRepoPath)

    console.log(
      `Extracted ${extractedBeadsData.issues.length} issue(s) from beads CLI`
    )
    console.log(
      `Extracted ${extractedBeadsData.dependencies.length} dependency relationship(s) from beads CLI`
    )

    // Log issue titles for debugging
    for (const issue of extractedBeadsData.issues) {
      console.log(`  - [${issue.id}] ${issue.title} (${issue.status})`)
    }

    // Log dependencies for debugging
    for (const dep of extractedBeadsData.dependencies) {
      console.log(`  - ${dep.depends_on_id} blocks ${dep.issue_id}`)
    }

    // Assert that we have some issues
    expect(extractedBeadsData.issues.length).toBeGreaterThan(0)

    // Assert that we have some dependencies (test repo should have some)
    expect(extractedBeadsData.dependencies.length).toBeGreaterThan(0)

    // Step 3: Sign into GitHub first
    console.log('Step: Sign into GitHub')
    await page.goto('https://github.com/login')
    await page.fill('input[name="login"]', username)
    await page.fill('input[name="password"]', password)
    await page.click('input[type="submit"]')

    // Wait for navigation to complete (either dashboard or 2FA page)
    await page.waitForURL(
      url => {
        const urlPath = url.pathname
        return (
          urlPath === '/' ||
          urlPath.startsWith('/sessions') ||
          urlPath.includes('two-factor')
        )
      },
      { timeout: 30000 }
    )

    // Check if we hit 2FA - if so, we can't proceed without manual intervention
    const currentUrl = page.url()
    if (
      currentUrl.includes('two-factor') ||
      currentUrl.includes('sessions/two-factor')
    ) {
      await takeScreenshot('e2e-2fa-prompt.png')
      throw new Error(
        'Two-factor authentication detected. Cannot proceed with automated test. Screenshot saved to screenshots/e2e-2fa-prompt.png'
      )
    }

    // Verify we're logged in by checking for user avatar or profile link
    await waitForVisible(
      page.locator('[data-login], .AppHeader-user, img.avatar').first(),
      { timeout: 10000 }
    )

    // Step 4: Navigate to the Bead Feeder app
    console.log('Step: Navigate to app and click GitHub login')
    await page.goto(BASE_URL)

    // Wait for the home page to load
    await waitForVisible(page.getByRole('heading', { name: /bead feeder/i }), {
      timeout: 10000,
    })

    // Click the GitHub login button (use first() as there may be multiple)
    const loginButton = page
      .getByRole('button', { name: /sign in with github/i })
      .first()
    await waitForVisible(loginButton)
    await loginButton.click()

    // Step 5: Handle OAuth authorization
    console.log('Step: Complete GitHub OAuth authorization')
    // Wait for GitHub OAuth page or redirect back to app
    // If already authorized, we'll be redirected directly to callback
    await page.waitForURL(
      url => {
        const urlPath = url.pathname
        const host = url.hostname
        return (
          (host === 'github.com' && urlPath.includes('/oauth')) ||
          (host === 'localhost' && urlPath.includes('/auth/callback')) ||
          (host === 'localhost' && urlPath === '/')
        )
      },
      { timeout: 15000 }
    )

    // If we're on GitHub's authorize page, click Authorize
    if (page.url().includes('github.com')) {
      // Check if there's an authorize button (first time authorization)
      const authorizeButton = page.getByRole('button', {
        name: /authorize/i,
      })
      if (
        await authorizeButton.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await authorizeButton.click()
      }
    }

    // Wait to be redirected back to the app
    await page.waitForURL(url => url.hostname === 'localhost', {
      timeout: 15000,
    })

    // Step 6: Select the test fork from the repository list
    console.log('Step: Select test fork')
    if (!forkRepoName) {
      throw new Error('Fork name not available')
    }

    // After OAuth callback, user is redirected to home where repository selector opens automatically
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })

    // Wait for repository selection modal to open automatically (no button click needed)
    await waitForVisible(
      page.getByText(/select a repository/i, { exact: false }),
      { timeout: 15000 }
    )

    // Look for the test fork in the list
    const repoItem = page.locator(
      `[data-testid="repo-item-${username}-${forkRepoName}"], :text("${username}/${forkRepoName}")`
    )

    // Wait for repo list to load and find our fork
    await waitForVisible(repoItem.first(), { timeout: 30000 })
    await repoItem.first().click()

    // Step 7: Verify the DAG view loaded for the fork
    console.log('Step: Verify DAG view loaded')
    if (!forkRepoName) {
      throw new Error('Fork name not available')
    }

    // Wait for navigation to the repo page
    await page.waitForURL(`**/repos/${username}/${forkRepoName}`, {
      timeout: 10000,
    })

    // Wait for the DAG canvas to be present
    await waitForVisible(page.locator('.react-flow'), { timeout: 15000 })

    // Verify the repo name is shown in the header
    await waitForVisible(page.getByText(`${username}/${forkRepoName}`))

    // Wait for issue nodes to appear in the DAG view
    const issueNodes = page.locator('[data-testid="issue-node"]')

    // Wait for at least one issue to appear
    await waitForVisible(issueNodes.first(), { timeout: 30000 })

    const issueCount = await issueNodes.count()
    console.log(`Found ${issueCount} issue(s) displayed in the DAG view`)

    if (issueCount > 0) {
      // Verify issue content is visible
      const firstIssueTitle = page
        .locator('[data-testid="issue-title"]')
        .first()
      await waitForVisible(firstIssueTitle)
      const titleText = await firstIssueTitle.textContent()
      console.log(`First issue title: ${titleText}`)
    }

    // Take a success screenshot
    await takeScreenshot('e2e-issues-loaded.png')
    console.log('Success screenshot saved to screenshots/e2e-issues-loaded.png')

    // Step 8: Extract issues and dependencies data structure from DAG view
    console.log('Step: Extract issues and dependencies from DAG view')
    // Extract issue data from DOM elements
    const issueNodeCount = await issueNodes.count()

    const issues: DagIssue[] = []
    for (let i = 0; i < issueNodeCount; i++) {
      const node = issueNodes.nth(i)

      // Get data attributes from the issue node
      const id = await node.getAttribute('data-issue-id')
      const status = await node.getAttribute('data-issue-status')
      const type = await node.getAttribute('data-issue-type')
      const priority = await node.getAttribute('data-issue-priority')

      // Get the title text from the title element
      const titleElement = node.locator('[data-testid="issue-title"]')
      const title = await titleElement.textContent()

      if (id && title) {
        issues.push({
          id,
          title,
          status: status || 'open',
          priority: priority || 'P2',
          issue_type: type || 'task',
        })
      }
    }

    // Extract dependency data from React Flow edges
    const edgeElements = page.locator('[aria-label^="Edge from "]')
    const edgeCount = await edgeElements.count()

    console.log(`Found ${edgeCount} React Flow edge elements`)

    const dependencies: DagDependency[] = []
    for (let i = 0; i < edgeCount; i++) {
      const edge = edgeElements.nth(i)

      // Get source and target from aria-label attribute
      const ariaLabel = await edge.getAttribute('aria-label')

      if (ariaLabel) {
        const match = ariaLabel.match(/Edge from (.+) to (.+)/)
        if (match) {
          const source = match[1] // blocker (depends_on_id)
          const target = match[2] // blocked (issue_id)
          dependencies.push({
            issue_id: target, // blocked issue
            depends_on_id: source, // blocker issue
          })
        }
      }
    }

    extractedDagData = { issues, dependencies }

    console.log(
      `Extracted ${extractedDagData.issues.length} issue(s) from DAG view`
    )
    console.log(
      `Extracted ${extractedDagData.dependencies.length} dependency relationship(s) from DAG view`
    )

    // Log extracted issues for debugging
    for (const issue of extractedDagData.issues) {
      console.log(
        `  - [${issue.id}] ${issue.title} (${issue.status}, ${issue.issue_type}, ${issue.priority})`
      )
    }

    // Log extracted dependencies for debugging
    for (const dep of extractedDagData.dependencies) {
      console.log(`  - ${dep.depends_on_id} blocks ${dep.issue_id}`)
    }

    // Assert we extracted issues from the DAG view
    expect(extractedDagData.issues.length).toBeGreaterThan(0)

    // Step 9: Compare CLI and DAG data structures
    console.log('Step: Compare CLI and DAG data structures')
    if (!extractedBeadsData || !extractedDagData) {
      throw new Error('Missing extracted data for comparison')
    }

    // Helper to normalize priority for comparison
    const normalizePriority = (priority: number | string): string => {
      if (typeof priority === 'number') {
        return `P${priority}`
      }
      return priority
    }

    // Helper to normalize status for comparison
    const normalizeStatus = (status: string): string => {
      return status.toLowerCase()
    }

    // Helper to normalize issue type for comparison
    const normalizeType = (type: string): string => {
      return type.toLowerCase()
    }

    // Create lookup map for DAG issues
    const dagIssueMap = new Map(
      extractedDagData.issues.map(issue => [issue.id, issue])
    )

    // Compare issue counts
    console.log(
      `Comparing ${extractedBeadsData.issues.length} CLI issues with ${extractedDagData.issues.length} DAG issues`
    )

    // Check that all CLI issues appear in DAG view
    const missingIssues: string[] = []
    const mismatchedIssues: string[] = []

    for (const cliIssue of extractedBeadsData.issues) {
      const dagIssue = dagIssueMap.get(cliIssue.id)

      if (!dagIssue) {
        missingIssues.push(
          `[${cliIssue.id}] ${cliIssue.title} - not found in DAG view`
        )
        continue
      }

      // Compare properties
      const cliStatus = normalizeStatus(cliIssue.status)
      const dagStatus = normalizeStatus(dagIssue.status)
      if (cliStatus !== dagStatus) {
        mismatchedIssues.push(
          `[${cliIssue.id}] status: CLI="${cliStatus}" vs DAG="${dagStatus}"`
        )
      }

      const cliType = normalizeType(cliIssue.issue_type)
      const dagType = normalizeType(dagIssue.issue_type)
      if (cliType !== dagType) {
        mismatchedIssues.push(
          `[${cliIssue.id}] type: CLI="${cliType}" vs DAG="${dagType}"`
        )
      }

      const cliPriority = normalizePriority(cliIssue.priority)
      const dagPriority = normalizePriority(dagIssue.priority)
      if (cliPriority !== dagPriority) {
        mismatchedIssues.push(
          `[${cliIssue.id}] priority: CLI="${cliPriority}" vs DAG="${dagPriority}"`
        )
      }
    }

    // Log any missing issues
    if (missingIssues.length > 0) {
      console.log('Missing issues in DAG view:')
      for (const msg of missingIssues) {
        console.log(`  - ${msg}`)
      }
    }

    // Log any mismatched properties
    if (mismatchedIssues.length > 0) {
      console.log('Mismatched issue properties:')
      for (const msg of mismatchedIssues) {
        console.log(`  - ${msg}`)
      }
    }

    // Compare dependencies
    console.log(
      `Comparing ${extractedBeadsData.dependencies.length} CLI dependencies with ${extractedDagData.dependencies.length} DAG dependencies`
    )

    // Create dependency key for comparison
    const makeDepKey = (issueId: string, dependsOnId: string) =>
      `${issueId}->${dependsOnId}`

    const cliDepKeys = new Set(
      extractedBeadsData.dependencies.map(dep =>
        makeDepKey(dep.issue_id, dep.depends_on_id)
      )
    )
    const dagDepKeys = new Set(
      extractedDagData.dependencies.map(dep =>
        makeDepKey(dep.issue_id, dep.depends_on_id)
      )
    )

    // Find missing dependencies in DAG view
    const missingDeps: string[] = []
    for (const key of cliDepKeys) {
      if (!dagDepKeys.has(key)) {
        missingDeps.push(key)
      }
    }

    if (missingDeps.length > 0) {
      console.log('Missing dependencies in DAG view:')
      for (const dep of missingDeps) {
        console.log(`  - ${dep}`)
      }
    }

    // Assert all issues are present in DAG view
    expect(missingIssues).toHaveLength(0)

    // Assert all properties match
    expect(mismatchedIssues).toHaveLength(0)

    // Assert all dependencies are present in DAG view
    expect(missingDeps).toHaveLength(0)

    console.log('✓ All CLI issues and dependencies match DAG view')

    // Step 10: Create a new issue via AI chat (real AI, not fake)
    console.log('Step: Create issue via AI chat')
    // Click the floating action button to open the Create Issue modal
    const fabButton = page.locator('[data-testid="fab-create-issue"]')
    await waitForVisible(fabButton)
    await fabButton.click()

    // Wait for the modal to open (dialog title is "Issue Assistant")
    await waitForVisible(page.getByRole('heading', { name: /assistant/i }))

    // Find the chat input and send a message to create an issue
    const chatInput = page.locator('[data-testid="message-input"]')
    await waitForVisible(chatInput)

    // Generate a unique issue title for this test run
    const testIssueTitle = `E2E Test Issue ${Date.now()}`
    await chatInput.fill(`create a task called "${testIssueTitle}"`)

    // Click send or press Enter
    const sendButton = page.locator('[data-testid="send-button"]')
    await sendButton.click()

    // Wait for the AI response to appear
    // Use polling to handle SSE streaming
    let aiResponseReceived = false
    const startTime = Date.now()
    const timeout = 60000
    while (!aiResponseReceived && Date.now() - startTime < timeout) {
      const assistantMessage = page
        .locator('[data-testid="message-assistant"]')
        .last()
      if (
        await assistantMessage.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        const text = await assistantMessage.textContent()
        if (text?.toLowerCase().includes('create')) {
          aiResponseReceived = true
          break
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (!aiResponseReceived) {
      throw new Error('AI response not received within timeout')
    }

    console.log(`Sent AI chat message to create issue: "${testIssueTitle}"`)

    // Close the modal
    const closeButton = page.locator('button[aria-label="Close"]')
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click()
    } else {
      // Try pressing Escape
      await page.keyboard.press('Escape')
    }

    // Wait for modal to close
    await waitForHidden(page.getByRole('heading', { name: /assistant/i }), {
      timeout: 5000,
    })

    // Wait for the graph to refresh
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('Created issue via AI chat')

    // Step 11: Verify new issue appears in the DAG view
    console.log('Step: Verify new issue appears in DAG')
    // Get initial issue count
    const updatedIssueNodes = page.locator('[data-testid="issue-node"]')

    // Wait for at least one more issue than before
    await waitForVisible(updatedIssueNodes.first(), { timeout: 10000 })

    const updatedIssueCount = await updatedIssueNodes.count()
    console.log(
      `Found ${updatedIssueCount} issue(s) in DAG view after AI creation`
    )

    // Verify the count increased
    expect(updatedIssueCount).toBeGreaterThan(
      extractedBeadsData?.issues.length ?? 0
    )

    // Take a screenshot
    await takeScreenshot('e2e-dag-with-ai-issue.png')

    console.log('✓ AI-created issue is visible in DAG view')
    console.log(
      'Success screenshot saved to screenshots/e2e-dag-with-ai-issue.png'
    )

    // Step 12: Verify remote sync - pull changes from fork and check with bd
    console.log('Step: Verify remote sync with bd')
    if (!clonedRepoPath || !forkRepoName) {
      throw new Error('Missing cloned repo path or fork name')
    }

    // Pull latest changes from the fork using PAT for auth
    const updatedData = pullAndExtractBeadsData(clonedRepoPath, username, pat)

    console.log(
      `After sync: ${updatedData.issues.length} issue(s) in repository`
    )

    // Verify we have more issues than before
    expect(updatedData.issues.length).toBeGreaterThan(
      extractedBeadsData?.issues.length ?? 0
    )

    // Find the new issue (it should have "E2E Test Issue" in the title)
    const newIssues = updatedData.issues.filter(issue =>
      issue.title.includes('E2E Test Issue')
    )

    expect(newIssues.length).toBeGreaterThan(0)

    console.log('New issue found in repository after sync:')
    for (const issue of newIssues) {
      console.log(`  - [${issue.id}] ${issue.title}`)
    }

    console.log('✓ Remote sync verified - AI-created issue is in repository')

    // Step 13: Test refresh button syncs external changes
    console.log('Step: Test refresh button syncs external changes')

    // Clone a fresh copy of the repo into a new directory
    const freshClonePath = cloneFork(username, forkRepoName, pat)
    console.log(`Cloned fresh copy to: ${freshClonePath}`)

    try {
      // Initialize beads database in the fresh clone (it only has JSONL file)
      console.log('Initializing beads database in fresh clone')
      execSync('bd init', {
        cwd: freshClonePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Generate a unique issue title for this external issue
      const externalIssueTitle = `External Issue ${Date.now()}`

      // Run bd create in the fresh clone to create a new issue
      console.log(`Creating external issue: "${externalIssueTitle}"`)
      execSync(`bd create "${externalIssueTitle}" --type task --priority 2`, {
        cwd: freshClonePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Run bd sync in the fresh clone to push the issue to GitHub
      console.log('Running bd sync to push external issue to GitHub')
      execSync('bd sync', {
        cwd: freshClonePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      console.log('External issue created and synced to GitHub')

      // Get the current issue count before refresh
      const beforeRefreshCount = await page
        .locator('[data-testid="issue-node"]')
        .count()
      console.log(`Issue count before refresh: ${beforeRefreshCount}`)

      // Click the refresh button in the UI
      console.log('Clicking refresh button')
      const refreshButton = page.locator('button[title="Refresh"]')
      await waitForVisible(refreshButton, { timeout: 5000 })
      await refreshButton.click()

      // Wait for the sync to complete (refresh icon should stop spinning)
      // Give the pull and sync time to complete
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Poll for the new issue to appear
      let externalIssueFound = false
      const refreshStartTime = Date.now()
      const refreshTimeout = 30000

      while (
        !externalIssueFound &&
        Date.now() - refreshStartTime < refreshTimeout
      ) {
        const issueTitles = page.locator('[data-testid="issue-title"]')
        const titleCount = await issueTitles.count()

        for (let i = 0; i < titleCount; i++) {
          const titleText = await issueTitles.nth(i).textContent()
          if (titleText?.includes('External Issue')) {
            externalIssueFound = true
            console.log(`Found external issue in DAG: "${titleText}"`)
            break
          }
        }

        if (!externalIssueFound) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Assert the external issue is now visible
      expect(externalIssueFound).toBe(true)

      // Take a screenshot showing the external issue
      await takeScreenshot('e2e-dag-with-external-issue.png')
      console.log('✓ External issue is visible in DAG after refresh')
      console.log(
        'Success screenshot saved to screenshots/e2e-dag-with-external-issue.png'
      )
    } finally {
      // Clean up the fresh clone
      cleanupClonedRepo(freshClonePath)
    }

    // Step 14: Cleanup summary
    console.log('Step: Cleanup summary')
    console.log('✓ Test completed successfully')
    console.log(
      `✓ Fork ${testUsername}/${forkRepoName} will be deleted in afterAll hook`
    )
    console.log('✓ Cloned repository will be deleted in afterAll hook')
  }, 240000) // 4 minute timeout for the full test (increased for external issue test)
})
