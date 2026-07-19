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
      exclude: ['lib/supabase/**', '**/*.d.ts'],
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
