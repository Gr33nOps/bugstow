import { defineConfig } from 'vitest/config'

// Frontend tests only. The team server has its own node:test suite
// (`cd server && npm test`) and its own dependencies.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
