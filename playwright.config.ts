import { defineConfig } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      testIgnore: [/notebook.*\.spec/],
    },
    {
      name: 'notebooks',
      use: { browserName: 'chromium' },
      testMatch: [/notebook.*\.spec/],
      fullyParallel: false,
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: 'make docker-up',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
