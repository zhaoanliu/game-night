import { defineConfig } from 'vitest/config'
import path from 'path'

// Integration tests run against a real server and a real database. They are a
// separate project from the jsdom unit tests: no DOM, no mocks, longer timeouts,
// and no coverage thresholds (they prove behaviour, not line coverage).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/**/*.test.ts'],
    globalSetup: ['./__tests__/integration/server.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
