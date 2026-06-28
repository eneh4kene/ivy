import { defineConfig, devices } from '@playwright/test'

/**
 * Real end-to-end config — drives the LIVE site against the LIVE backend.
 *
 * There is NO API mocking here. The point of this suite is to catch the class of
 * bugs that mocked-render checks miss: 500s on submit, dead buttons, broken nav,
 * wrong empty states. The guards fixture (e2e/fixtures/guards.ts) fails any test
 * on an uncaught page error, an unexpected console error, or a ≥400 /api response.
 *
 * Default target is production. Override with E2E_BASE_URL to point elsewhere
 * (e.g. a Vercel preview or http://localhost:3000).
 */
export default defineConfig({
  testDir: './e2e',
  // Prod is shared state; run serially so disposable users don't race.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://www.ivykeeps.life',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
