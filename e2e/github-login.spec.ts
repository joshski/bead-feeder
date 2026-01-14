import { expect, test } from '@playwright/test'

test('sign into GitHub and take screenshot', async ({ page }) => {
  const username = process.env.TEST_GITHUB_USERNAME
  const password = process.env.TEST_GITHUB_PASSWORD

  if (!username || !password) {
    throw new Error(
      'TEST_GITHUB_USERNAME and TEST_GITHUB_PASSWORD environment variables are required'
    )
  }

  // Navigate to GitHub login page
  await page.goto('https://github.com/login')

  // Fill in credentials
  await page.fill('input[name="login"]', username)
  await page.fill('input[name="password"]', password)

  // Click sign in button
  await page.click('input[type="submit"]')

  // Wait for navigation to complete (either dashboard or 2FA page)
  await page.waitForURL(url => {
    const path = url.pathname
    // Successful login redirects to dashboard or sessions page (for 2FA)
    return (
      path === '/' ||
      path.startsWith('/sessions') ||
      path.includes('two-factor')
    )
  })

  // Check if we hit 2FA - if so, we can't proceed without manual intervention
  const currentUrl = page.url()
  if (
    currentUrl.includes('two-factor') ||
    currentUrl.includes('sessions/two-factor')
  ) {
    console.log(
      'Two-factor authentication detected. Screenshot taken at 2FA prompt.'
    )
    await page.screenshot({
      path: 'screenshots/github-2fa-prompt.png',
      fullPage: true,
    })
    return
  }

  // Verify we're logged in by checking for user avatar or profile link
  await expect(
    page.locator('[data-login], .AppHeader-user, img.avatar')
  ).toBeVisible({
    timeout: 10000,
  })

  // Take screenshot of authenticated state
  await page.screenshot({
    path: 'screenshots/github-authenticated.png',
    fullPage: true,
  })

  console.log('Screenshot saved to screenshots/github-authenticated.png')
})
