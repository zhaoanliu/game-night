import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['node_modules', 'e2e/**', '__tests__/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'app/api/**/*.{ts,tsx}'],
      // Route handlers and the data-access modules are covered by
      // `npm run test:integration`, which drives the real HTTP API against a
      // real database. Mocking the query builder here would assert only that
      // we called it in a particular order — it would not catch a wrong query,
      // a missing lock, or a broken privilege. Pure logic stays in this report
      // and is held to the thresholds below.
      exclude: [
        'lib/supabase/**',
        'lib/auth.ts',
        'lib/events.ts',
        'lib/rsvp.ts',
        'app/api/**',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 65,
        branches: 80,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
