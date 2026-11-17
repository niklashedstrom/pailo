import { defineConfig } from 'vitest/config'

// Integration tests need the local Supabase stack and run on their own.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', ...(process.env.INTEGRATION ? [] : ['src/integration/**'])],
    include: process.env.INTEGRATION ? ['src/integration/**/*.test.ts'] : ['src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
