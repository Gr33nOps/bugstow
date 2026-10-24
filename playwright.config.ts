import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  use: { baseURL: 'http://localhost:8443', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8443',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
