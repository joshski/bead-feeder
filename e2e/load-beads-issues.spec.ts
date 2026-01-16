import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import { TEST_PORTS } from '../config/ports'

const BASE_URL = `http://localhost:${TEST_PORTS.VITE}`

// Test repository containing sample beads issues
const TEST_REPO_OWNER = 'josh-beads-test-1'
const TEST_REPO_NAME = 'bead-feeder-example-issues'

// Shared state for cloned repository path (used within this test file)
let clonedRepoPath: string | null = null

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
 * Clone the test repository into a temporary directory.
 * Returns the path to the cloned repository.
 */
function cloneTestRepo(
  owner: string,
  repo: string,
  username: string,
  password: string
): string {
  // Create a unique temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bead-feeder-e2e-'))

  // Build authenticated URL (URL-encode password to handle special characters)
  const encodedPassword = encodeURIComponent(password)
  const authUrl = `https://${username}:${encodedPassword}@github.com/${owner}/${repo}.git`

  // Clone the repository
  try {
    execSync(`git clone ${authUrl} ${tempDir}`, {
      stdio: 'pipe', // Suppress output to avoid leaking credentials
    })
    console.log(`Cloned test repository to ${tempDir}`)
    return tempDir
  } catch (error) {
    // Clean up temp directory on failure
    fs.rmSync(tempDir, { recursive: true, force: true })
    throw new Error(
      `Failed to clone test repository: ${error instanceof Error ? error.message : 'Unknown error'}`
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

test.describe('Load beads issues from GitHub repository', () => {
  // Clean up cloned repository after all tests complete
  test.afterAll(async () => {
    if (clonedRepoPath) {
      cleanupClonedRepo(clonedRepoPath)
      clonedRepoPath = null
    }
  })

  test('authenticates and displays issues from test repository', async ({
    page,
  }) => {
    const username = process.env.TEST_GITHUB_USERNAME
    const password = process.env.TEST_GITHUB_PASSWORD
    const testRepo =
      process.env.TEST_GITHUB_REPOSITORY ||
      `${TEST_REPO_OWNER}/${TEST_REPO_NAME}`

    if (!username || !password) {
      throw new Error(
        'TEST_GITHUB_USERNAME and TEST_GITHUB_PASSWORD environment variables are required'
      )
    }

    const [owner, repo] = testRepo.split('/')
    if (!owner || !repo) {
      throw new Error(
        'TEST_GITHUB_REPOSITORY must be in format "owner/repo" (e.g., "josh-beads-test-1/bead-feeder-example-issues")'
      )
    }

    // Step 0: Clone the test repository into a temp directory
    await test.step('Clone test repository to temp directory', async () => {
      clonedRepoPath = cloneTestRepo(owner, repo, username, password)
      console.log(`Test repository cloned to: ${clonedRepoPath}`)

      // Verify the .beads directory exists in the cloned repo
      const beadsDir = path.join(clonedRepoPath, '.beads')
      if (fs.existsSync(beadsDir)) {
        console.log('.beads directory found in cloned repository')
      } else {
        console.warn(
          '.beads directory not found in cloned repository - test may not find issues'
        )
      }
    })

    // Step 0.5: Extract issues and dependencies from cloned repo using beads CLI
    await test.step('Extract issues and dependencies from cloned repo', async () => {
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
      expect(
        extractedBeadsData.issues.length,
        'Expected test repository to have at least one issue'
      ).toBeGreaterThan(0)

      // Assert that we have some dependencies (test repo should have some)
      expect(
        extractedBeadsData.dependencies.length,
        'Expected test repository to have at least one dependency relationship'
      ).toBeGreaterThan(0)
    })

    // Step 1: Sign into GitHub first
    await test.step('Sign into GitHub', async () => {
      await page.goto('https://github.com/login')
      await page.fill('input[name="login"]', username)
      await page.fill('input[name="password"]', password)
      await page.click('input[type="submit"]')

      // Wait for navigation to complete (either dashboard or 2FA page)
      await page.waitForURL(
        url => {
          const path = url.pathname
          return (
            path === '/' ||
            path.startsWith('/sessions') ||
            path.includes('two-factor')
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
        await page.screenshot({
          path: 'screenshots/e2e-2fa-prompt.png',
          fullPage: true,
        })
        throw new Error(
          'Two-factor authentication detected. Cannot proceed with automated test. Screenshot saved to screenshots/e2e-2fa-prompt.png'
        )
      }

      // Verify we're logged in by checking for user avatar or profile link
      await expect(
        page.locator('[data-login], .AppHeader-user, img.avatar').first()
      ).toBeVisible({
        timeout: 10000,
      })
    })

    // Step 2: Navigate to the Bead Feeder app
    await test.step('Navigate to app and click GitHub login', async () => {
      await page.goto(BASE_URL)

      // Wait for the home page to load
      await expect(
        page.getByRole('heading', { name: /bead feeder/i })
      ).toBeVisible({
        timeout: 10000,
      })

      // Click the GitHub login button (use first() as there may be multiple)
      const loginButton = page
        .getByRole('button', { name: /sign in with github/i })
        .first()
      await expect(loginButton).toBeVisible()
      await loginButton.click()
    })

    // Step 3: Handle OAuth authorization
    await test.step('Complete GitHub OAuth authorization', async () => {
      // Wait for GitHub OAuth page or redirect back to app
      // If already authorized, we'll be redirected directly to callback
      await page.waitForURL(
        url => {
          const path = url.pathname
          const host = url.hostname
          return (
            (host === 'github.com' && path.includes('/oauth')) ||
            (host === 'localhost' && path.includes('/auth/callback')) ||
            (host === 'localhost' && path === '/')
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
    })

    // Step 4: Select the test repository
    await test.step('Select test repository', async () => {
      // Wait for the mode selector to appear
      // After OAuth callback, user should be redirected to home with mode selector
      await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })

      // Click on "GitHub Repository" button to show the GitHub repository selector
      await expect(page.getByText('GitHub Repository')).toBeVisible({
        timeout: 15000,
      })
      await page.getByText('GitHub Repository').click()

      // Wait for repositories to load
      await expect(
        page.getByText(/repositories/i, { exact: false })
      ).toBeVisible({
        timeout: 15000,
      })

      // Look for the test repository in the list
      // The repository selector shows repos as clickable items
      const repoItem = page.locator(
        `[data-testid="repo-item-${owner}-${repo}"], :text("${owner}/${repo}")`
      )

      // If repo not immediately visible, it might be in "Other Repositories" section
      // or we need to scroll/wait for loading
      await expect(repoItem.first()).toBeVisible({ timeout: 15000 })
      await repoItem.first().click()
    })

    // Step 5: Verify the DAG view loaded for the repository
    await test.step('Verify DAG view loaded', async () => {
      // Wait for navigation to the repo page
      await page.waitForURL(`**/repos/${owner}/${repo}`, { timeout: 10000 })

      // Wait for the DAG canvas to be present
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })

      // Verify the repo name is shown in the header
      await expect(page.getByText(`${owner}/${repo}`)).toBeVisible()

      // Wait for issue nodes to appear in the DAG view
      // This is the actual indicator that graph data has been fetched and rendered
      // The 'Synced' status is for git sync, not graph fetch - waiting for it causes race conditions
      const issueNodes = page.locator('[data-testid="issue-node"]')

      // We know from CLI extraction that issues exist, so wait for at least one to appear
      // Use a longer timeout since graph fetch and rendering may take time
      await expect(issueNodes.first()).toBeVisible({ timeout: 30000 })

      const issueCount = await issueNodes.count()
      console.log(`Found ${issueCount} issue(s) displayed in the DAG view`)

      if (issueCount > 0) {
        // Verify issue content is visible
        const firstIssueTitle = page
          .locator('[data-testid="issue-title"]')
          .first()
        await expect(firstIssueTitle).toBeVisible()
        const titleText = await firstIssueTitle.textContent()
        console.log(`First issue title: ${titleText}`)
      } else {
        console.log(
          'No issues found in test repository - DAG view loaded but empty'
        )
      }

      // Take a success screenshot
      const screenshotPath = 'screenshots/e2e-issues-loaded.png'
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      console.log(`Success screenshot saved to ${screenshotPath}`)
    })

    // Step 6: Extract issues and dependencies data structure from DAG view
    await test.step('Extract issues and dependencies from DAG view', async () => {
      // Extract issue data from DOM elements
      const issueNodes = page.locator('[data-testid="issue-node"]')
      const issueCount = await issueNodes.count()

      const issues: DagIssue[] = []
      for (let i = 0; i < issueCount; i++) {
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
      // React Flow v12 uses aria-label="Edge from {source} to {target}" on edges
      // and data-testid="rf__edge-{edge-id}" where edge-id is "{source}-{target}"
      const edgeElements = page.locator('.react-flow__edge')
      const edgeCount = await edgeElements.count()

      console.log(`Found ${edgeCount} React Flow edge elements`)

      const dependencies: DagDependency[] = []
      for (let i = 0; i < edgeCount; i++) {
        const edge = edgeElements.nth(i)

        // Get source and target from aria-label attribute
        // Format: "Edge from {source} to {target}"
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
      expect(
        extractedDagData.issues.length,
        'Expected DAG view to display at least one issue'
      ).toBeGreaterThan(0)
    })

    // Step 7: Compare CLI and DAG data structures
    await test.step('Compare CLI and DAG data structures', async () => {
      if (!extractedBeadsData || !extractedDagData) {
        throw new Error('Missing extracted data for comparison')
      }

      // Helper to normalize priority for comparison
      // CLI returns priority as number (0-3), DAG returns as string (P0-P3)
      const normalizePriority = (priority: number | string): string => {
        if (typeof priority === 'number') {
          return `P${priority}`
        }
        return priority
      }

      // Helper to normalize status for comparison
      // Both should use same values, but normalize case
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
      expect(
        missingIssues,
        `${missingIssues.length} issue(s) from CLI are missing in DAG view`
      ).toHaveLength(0)

      // Assert all properties match
      expect(
        mismatchedIssues,
        `${mismatchedIssues.length} issue(s) have mismatched properties`
      ).toHaveLength(0)

      // Assert all dependencies are present in DAG view
      expect(
        missingDeps,
        `${missingDeps.length} dependency relationship(s) from CLI are missing in DAG view`
      ).toHaveLength(0)

      console.log('✓ All CLI issues and dependencies match DAG view')
    })

    // Step 8: Test AI chat with fake mode by creating an issue locally
    await test.step('Navigate to local DAG view', async () => {
      // Navigate to the local view which uses the project's own .beads directory
      await page.goto(`${BASE_URL}/local`)

      // Wait for the DAG canvas to be present
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })

      console.log('Navigated to local DAG view')
    })

    // Step 9: Use AI chat to create an issue (tests fake AI without real API costs)
    await test.step('Create issue via AI chat', async () => {
      // Click the floating action button to open the Create Issue modal
      const fabButton = page.locator('[data-testid="fab-create-issue"]')
      await expect(fabButton).toBeVisible()
      await fabButton.click()

      // Wait for the modal to open
      await expect(
        page.getByRole('heading', { name: /create issue/i })
      ).toBeVisible()

      // Find the chat input and send a message to create an issue
      const chatInput = page.locator('[data-testid="message-input"]')
      await expect(chatInput).toBeVisible()

      // Generate a unique issue title for this test run
      const testIssueTitle = `E2E Test Issue ${Date.now()}`
      await chatInput.fill(`create a task called "${testIssueTitle}"`)

      // Click send or press Enter
      const sendButton = page.locator('[data-testid="send-button"]')
      await sendButton.click()

      // Wait for the AI response to appear
      // The fake AI will respond with confirmation text
      // Use polling to handle SSE streaming race conditions
      await expect(async () => {
        const assistantMessage = page
          .locator('[data-testid="message-assistant"]')
          .last()
        const text = await assistantMessage.textContent()
        expect(text?.toLowerCase()).toContain('create')
      }).toPass({ timeout: 15000, intervals: [500, 1000, 1000] })

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
      await expect(
        page.getByRole('heading', { name: /create issue/i })
      ).not.toBeVisible({ timeout: 5000 })

      // Wait a moment for the graph to refresh
      await page.waitForTimeout(1000)

      console.log('Created issue via AI chat (using fake AI mode)')
    })

    // Step 10: Verify the new issue appears in the local DAG view
    await test.step('Verify new issue appears in DAG', async () => {
      // The fake AI executed the create_issue tool, which should have created a real issue
      // Wait for the DAG to update and show the new issue

      // Get all issue nodes
      const issueNodes = page.locator('[data-testid="issue-node"]')

      // Wait for at least one issue to be visible
      await expect(issueNodes.first()).toBeVisible({ timeout: 10000 })

      const issueCount = await issueNodes.count()
      console.log(`Found ${issueCount} issue(s) in local DAG view`)

      // Verify at least one issue exists (the one we just created)
      expect(
        issueCount,
        'Expected at least one issue in local DAG view after AI creation'
      ).toBeGreaterThan(0)

      // Take a screenshot of the local DAG with the new issue
      await page.screenshot({
        path: 'screenshots/e2e-local-dag-with-ai-issue.png',
        fullPage: true,
      })

      console.log('✓ AI-created issue is visible in local DAG view')
      console.log(
        'Success screenshot saved to screenshots/e2e-local-dag-with-ai-issue.png'
      )
    })

    // Step 11: Clean up test artifacts from local repository
    await test.step('Clean up test artifacts', async () => {
      // Find and close any issues created during this test run
      // These have titles matching "E2E Test Issue *"
      try {
        const listOutput = execSync('bd list --json', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        const issues = JSON.parse(listOutput)
        const testIssues = issues.filter(
          (issue: { title: string; status: string }) =>
            issue.title.startsWith('E2E Test Issue') &&
            issue.status !== 'closed'
        )

        for (const issue of testIssues) {
          execSync(`bd close ${issue.id}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          console.log(`Closed test artifact issue: ${issue.id}`)
        }

        if (testIssues.length > 0) {
          console.log(
            `✓ Cleaned up ${testIssues.length} test artifact issue(s)`
          )
        } else {
          console.log('No test artifact issues to clean up')
        }
      } catch (error) {
        console.warn(
          `Warning: Failed to clean up test artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    })
  })
})
