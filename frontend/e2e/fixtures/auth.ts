import { test as guarded, expect } from './guards'

/**
 * auth fixture — completes the REAL magic-link verification on the live site.
 *
 * The agent-run bootstrap (e2e/bootstrap.sh) creates a disposable user, pre-sets
 * their phone (so onboarding's verified-phone fast-path skips the SMS OTP), and
 * mints a real magic-link token straight from the DB. It exports:
 *   E2E_VERIFY_URL   – https://www.ivykeeps.life/auth/verify?token=...
 *   E2E_USER_EMAIL   – the disposable user's email
 *   E2E_USER_PHONE   – the pre-set, already-verified phone
 *
 * `authedPage` navigates to that URL, lets the real verify flow run, and resolves
 * once the auth token is in localStorage — i.e. a genuinely logged-in session.
 */

export const test = guarded.extend<{
  verifyUrl: string
  userEmail: string
  userPhone: string
}>({
  verifyUrl: async ({}, use) => {
    const url = process.env.E2E_VERIFY_URL
    if (!url) {
      throw new Error(
        'E2E_VERIFY_URL is not set. Run `bash e2e/bootstrap.sh` and export its output first.',
      )
    }
    await use(url)
  },
  userEmail: async ({}, use) => {
    await use(process.env.E2E_USER_EMAIL ?? '')
  },
  userPhone: async ({}, use) => {
    await use(process.env.E2E_USER_PHONE ?? '')
  },
})

/** Drive the real verify page and wait for an authenticated session. */
export async function completeVerify(page: import('@playwright/test').Page, verifyUrl: string) {
  await page.goto(verifyUrl)
  // The real verify page stores the token then redirects away from /auth/verify.
  await expect
    .poll(
      async () => page.evaluate(() => window.localStorage.getItem('ivy_token')),
      { timeout: 30_000, message: 'magic-link verification never stored ivy_token' },
    )
    .not.toBeNull()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/verify'), { timeout: 30_000 })
}

export { expect }
