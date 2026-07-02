import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { test as guarded, expect } from './guards'

/**
 * auth fixture — completes the REAL magic-link verification on the live site.
 *
 * Magic-link tokens are single-use (auth.service rejects a token once usedAt is
 * set), so a token can never be shared across Playwright projects/workers. Each
 * worker therefore provisions its OWN disposable user by running e2e/bootstrap.sh
 * (creates the user with a pre-set phone so onboarding's verified-phone fast-path
 * skips the SMS OTP, then mints a fresh magic-link token from the DB) and tears
 * it down with e2e/teardown.sh when the worker finishes.
 *
 * `completeVerify` navigates to the minted URL, lets the real verify flow run,
 * and resolves once the auth token is in localStorage — a genuinely logged-in
 * session.
 */

type E2EUser = {
  userId: string
  email: string
  phone: string
  verifyUrl: string
}

function runScript(script: string, args: string[] = []): string {
  return execFileSync('bash', [path.join(__dirname, '..', script), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

function provisionUser(): E2EUser {
  const out = runScript('bootstrap.sh')
  const grab = (key: string) => {
    const m = out.match(new RegExp(`export ${key}='([^']*)'`))
    if (!m) throw new Error(`bootstrap.sh output missing ${key}:\n${out}`)
    return m[1]
  }
  return {
    userId: grab('E2E_USER_ID'),
    email: grab('E2E_USER_EMAIL'),
    phone: grab('E2E_USER_PHONE'),
    verifyUrl: grab('E2E_VERIFY_URL'),
  }
}

export const test = guarded.extend<
  { verifyUrl: string; userEmail: string; userPhone: string },
  { e2eUser: E2EUser }
>({
  // Worker-scoped: one disposable prod user per worker, torn down afterwards.
  e2eUser: [
    async ({}, use) => {
      const user = provisionUser()
      try {
        await use(user)
      } finally {
        try {
          runScript('teardown.sh', [user.userId, user.email])
        } catch (err) {
          console.error(`e2e teardown failed for ${user.email} (${user.userId}):`, err)
        }
      }
    },
    { scope: 'worker' },
  ],
  verifyUrl: async ({ e2eUser }, use) => {
    await use(e2eUser.verifyUrl)
  },
  userEmail: async ({ e2eUser }, use) => {
    await use(e2eUser.email)
  },
  userPhone: async ({ e2eUser }, use) => {
    await use(e2eUser.phone)
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
