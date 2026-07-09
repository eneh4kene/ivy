import { execFileSync } from 'node:child_process'
import * as path from 'node:path'
import { test, expect } from './fixtures/guards'
import { completeVerify } from './fixtures/auth'

/**
 * The coach self-serve funnel, against LIVE prod, with guards active.
 *
 * Walks a brand-new coach-intent signup through the exact path a real coach
 * takes: magic-link verify → /coach/join activation → (webhook-simulated) tier
 * flip → first-run setup → console with a working invite link — then proves the
 * invite resolves for an anonymous visitor, which is the client side of the
 * coach↔client link.
 *
 * Stripe checkout is not driven (same policy as the consumer journey);
 * promote-coach.sh stands in for the subscription webhook, guarded to
 * enatec.grp+e2e-* users. The coach is provisioned WITHOUT a phone so the
 * server-side welcome call can never dial from a test run.
 *
 * This spec exists because the funnel shipped with three stacked breaks nobody
 * could see (verify routed coaches into consumer onboarding; the console layout
 * gated the activation page behind the tier that activation grants; the welcome
 * call was unreachable) — it pins the whole path so it can't silently rot again.
 */
test.use({ serviceWorkers: 'block' })

function run(script: string, args: string[] = []): string {
  return execFileSync('bash', [path.join(__dirname, script), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

test('coach journey — signup → activation → setup → console → invite resolves (live prod)', async ({
  page,
  browser,
  assertNoViolations,
  waitForApiIdle,
  assertNoPersistentApiFailures,
}) => {
  // Real verify + tier poll (2.5s interval) + console settle: 90s is too tight.
  test.setTimeout(180_000)

  const out = run('bootstrap-coach.sh')
  const grab = (key: string) => {
    const m = out.match(new RegExp(`export ${key}='([^']*)'`))
    if (!m) throw new Error(`bootstrap-coach.sh output missing ${key}:\n${out}`)
    return m[1]
  }
  const coachId = grab('E2E_COACH_ID')
  const coachEmail = grab('E2E_COACH_EMAIL')
  const verifyUrl = grab('E2E_COACH_VERIFY_URL')

  try {
    // ── 1. Magic-link verify routes coach-intent → /coach/join ──────────────
    // THE regression this spec pins: this used to land in consumer onboarding.
    await completeVerify(page, verifyUrl)
    await page.waitForURL(/\/coach\/join/, { timeout: 20_000 })
    await expect(page.getByText('Activate your coach plan')).toBeVisible()
    await expect(page.getByRole('button', { name: /Activate/ })).toBeVisible()

    // ── 2. "Webhook" flips the tier → post-checkout path advances to setup ──
    run('promote-coach.sh', [coachId])
    await page.goto('/coach/join?from=checkout')
    await page.waitForURL(/\/coach\/settings/, { timeout: 45_000 })

    // ── 3. First-run setup completes and becomes the console ────────────────
    await expect(page.getByText('Set up your programme')).toBeVisible()
    await page.getByPlaceholder(/12-Week Fat Loss/).fill('E2E Strength Foundation')
    await page.getByRole('button', { name: /Finish setup/i }).click()
    await page.waitForURL((u) => u.pathname === '/coach', { timeout: 30_000 })

    // ── 4. Console renders with the real invite link ─────────────────────────
    await waitForApiIdle()
    await expect(page.getByRole('heading', { name: 'E2E Strength Foundation' })).toBeVisible()
    await expect(page.getByText('Your invite link', { exact: true })).toBeVisible()
    const inviteUrl = (await page.locator('.font-mono', { hasText: '/invite/' }).first().textContent())?.trim()
    expect(inviteUrl, 'console should surface a full invite URL').toMatch(/https?:\/\/.+\/invite\/.+/)

    // ── 5. The invite resolves for an anonymous visitor ──────────────────────
    const anon = await browser.newContext()
    try {
      const anonPage = await anon.newPage()
      await anonPage.goto(inviteUrl!)
      await expect(anonPage.getByText("You've been invited")).toBeVisible({ timeout: 20_000 })
      await expect(anonPage.getByText('E2E Strength Foundation')).toBeVisible()
    } finally {
      await anon.close()
    }

    assertNoPersistentApiFailures()
    assertNoViolations('coach journey')
  } finally {
    run('teardown.sh', [coachId, coachEmail])
  }
})

test('coach intent survives an existing half-signup account (email path)', async ({
  page,
  assertNoViolations,
}) => {
  test.setTimeout(120_000)

  // A PLAIN consumer half-signup (role='user', FREE, not onboarded) — the state
  // an account is in when someone signed up once, wandered off, and later came
  // back through /for-coaches. Signup then 409s and can never send role, so the
  // intent rides localStorage into the verify page and is applied server-side.
  const out = run('bootstrap.sh')
  const grab = (key: string) => {
    const m = out.match(new RegExp(`export ${key}='([^']*)'`))
    if (!m) throw new Error(`bootstrap.sh output missing ${key}:\n${out}`)
    return m[1]
  }
  const userId = grab('E2E_USER_ID')
  const email = grab('E2E_USER_EMAIL')
  const verifyUrl = grab('E2E_VERIFY_URL')

  try {
    // What the signup page does when isCoach — before the browser ever
    // navigates, so the verify page sees it on load.
    await page.addInitScript(() => window.localStorage.setItem('ivy_coach_intent', '1'))

    await completeVerify(page, verifyUrl)

    // The regression: this used to fall through to /onboard-consumer because
    // the existing account's role was still 'user'.
    await page.waitForURL(/\/coach\/join/, { timeout: 20_000 })
    await expect(page.getByText('Activate your coach plan')).toBeVisible()

    assertNoViolations('coach intent on existing account')
  } finally {
    run('teardown.sh', [userId, email])
  }
})
