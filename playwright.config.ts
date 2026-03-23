import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
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
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
