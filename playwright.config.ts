import { defineConfig } from '@playwright/test'
import { TEST_PORTS } from './config/ports'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    baseURL: `http://localhost:${TEST_PORTS.VITE}`,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  outputDir: 'test-results',
})
