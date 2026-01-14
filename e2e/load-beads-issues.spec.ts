import { expect, test } from '@playwright/test'
import { verifyScreenshotShowsIssues } from './verify-screenshot'

// Test repository containing sample beads issues
const TEST_REPO_OWNER = 'josh-beads-test-1'
const TEST_REPO_NAME = 'bead-feeder-example-issues'

test.describe('Load beads issues from GitHub repository', () => {
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
        page.locator('[data-login], .AppHeader-user, img.avatar')
      ).toBeVisible({
        timeout: 10000,
      })
    })

    // Step 2: Navigate to the Bead Feeder app
    await test.step('Navigate to app and click GitHub login', async () => {
      await page.goto('http://localhost:5173')

      // Wait for the welcome page to load
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible(
        {
          timeout: 10000,
        }
      )

      // Click the GitHub login button
      const loginButton = page.getByRole('button', {
        name: /sign in with github/i,
      })
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
        const authorizeButton = page.locator('button[name="authorize"]')
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
      // Wait for the repository selector to appear
      // After OAuth callback, user should be redirected to home with repo selector
      await page.waitForURL('http://localhost:5173/', { timeout: 15000 })

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

    // Step 5: Verify issues are displayed in the DAG view
    await test.step('Verify issues are displayed', async () => {
      // Wait for navigation to the repo page
      await page.waitForURL(`**/repos/${owner}/${repo}`, { timeout: 10000 })

      // Wait for the DAG canvas to be present
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })

      // Verify that issue nodes are rendered
      // The IssueNode component has data-testid="issue-node"
      const issueNodes = page.locator('[data-testid="issue-node"]')

      // Wait for at least one issue to be displayed
      await expect(issueNodes.first()).toBeVisible({ timeout: 15000 })

      // Get count of displayed issues
      const issueCount = await issueNodes.count()
      console.log(`Found ${issueCount} issue(s) displayed in the DAG view`)

      // Verify we have at least one issue (the test repo should have sample issues)
      expect(issueCount).toBeGreaterThan(0)

      // Optionally verify issue content is visible
      // Each issue node should show a title
      const firstIssueTitle = page
        .locator('[data-testid="issue-title"]')
        .first()
      await expect(firstIssueTitle).toBeVisible()
      const titleText = await firstIssueTitle.textContent()
      console.log(`First issue title: ${titleText}`)

      // Take a success screenshot
      const screenshotPath = 'screenshots/e2e-issues-loaded.png'
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      console.log(`Success screenshot saved to ${screenshotPath}`)

      // Verify screenshot shows issues using Claude Code CLI
      console.log('Verifying screenshot with Claude Code...')
      const verification = await verifyScreenshotShowsIssues(screenshotPath)
      console.log('Claude verification result:')
      console.log(`  - Verified: ${verification.verified}`)
      console.log(`  - Issue count: ${verification.issueCount}`)
      console.log(`  - Description: ${verification.description}`)

      expect(
        verification.verified,
        `Claude vision verification failed: ${verification.description}`
      ).toBe(true)
      expect(
        verification.issueCount,
        'Claude detected no issues in screenshot'
      ).toBeGreaterThan(0)
    })
  })
})
