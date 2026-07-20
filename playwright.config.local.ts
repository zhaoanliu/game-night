import { defineConfig, devices } from '@playwright/test'

// E2E against a production build — dev servers skip tree-shaking, chunk
// isolation, and SSR/hydration in ways that hide entire classes of bugs.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // fullyParallel:false alone still parallelizes across files
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run build && npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
