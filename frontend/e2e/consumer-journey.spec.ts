import { test } from './fixtures/auth'
import { completeVerify } from './fixtures/auth'
import { expect, type Page } from './fixtures/guards'

/**
 * The faithful new-user run, against LIVE prod, with guards active throughout.
 *
 * It walks a brand-new user from the marketing page through real magic-link
 * verification, real onboarding (phone fast-path skips Twilio), the stake gate,
 * and then every authenticated consumer surface — recording any uncaught error,
 * console error, or ≥400 API call per page. At the end it asserts the full report
 * is empty, so a single run surfaces *every* broken surface, not just the first.
 *
 * Token is single-use and the steps are inherently sequential, so this is one
 * ordered test rather than many.
 */

type PageReport = { label: string; items: string[] }

test('consumer journey — signup → onboard → in-app tour (live prod)', async ({
  page,
  context,
  violations,
  waitForApiIdle,
  assertNoPersistentApiFailures,
  verifyUrl,
  userPhone,
}) => {
  // The journey is long by design: real verify + ~8 surface settles + a 45s
  // chat round-trip poll. The 90s default is far too short.
  test.setTimeout(240_000)

  const report: PageReport[] = []

  // Snapshot + clear violations under a label, so each surface is independent
  // and the final report lists everything that broke.
  const record = (label: string) => {
    if (violations.length > 0) {
      report.push({ label, items: violations.map((v) => `[${v.kind}] ${v.detail}`) })
      violations.length = 0
    }
  }

  const settle = async () => {
    await page.waitForLoadState('domcontentloaded')
    // Grace for React effects to fire their data XHRs before we measure idle.
    await page.waitForTimeout(600)
    // Wait for the page's real API calls to finish (or fail) — not a fixed
    // sleep. This is what prevents a slow XHR being aborted by the next
    // navigation and reported as a bogus "Network Error".
    await waitForApiIdle({ idle: 1200, timeout: 15000 })
    await page.waitForTimeout(200)
  }

  // ── 1. Marketing landing (unauthenticated) ─────────────────────────────────
  await test.step('landing', async () => {
    await page.goto('/')
    await settle()
    record('/ (landing)')
  })

  // ── 2. Signup page renders ─────────────────────────────────────────────────
  await test.step('signup page', async () => {
    await page.goto('/signup')
    await settle()
    record('/signup')
  })

  // ── 3. Real magic-link verification ────────────────────────────────────────
  await test.step('verify magic link', async () => {
    await completeVerify(page, verifyUrl)
    await expect(page).toHaveURL(/\/onboard-consumer/, { timeout: 30_000 })
    await settle()
    record('verify → onboard-consumer')
  })

  // ── 4. Onboarding (welcome → track → channel; phone fast-path) ─────────────
  await test.step('onboarding', async () => {
    // Welcome
    await page.getByRole('button', { name: /get started/i }).click()
    // Track — pick Fitness
    await page.getByRole('button', { name: /Fitness/i }).first().click()
    await page.getByRole('button', { name: /continue/i }).click()
    // Channel — pick "Ivy calls you" (CALLS)
    await page.getByText(/Ivy calls you/i).click()
    // Phone is pre-filled from the verified account; set it explicitly to be safe.
    const phoneInput = page.getByPlaceholder('+44 7700 900000')
    await phoneInput.fill(userPhone)
    // Verified-phone fast-path: same number → skips OTP and completes onboarding.
    await page.getByRole('button', { name: /send verification code/i }).click()
    await expect(page).toHaveURL(/\/stake-setup/, { timeout: 30_000 })
    await settle()
    record('onboarding → stake-setup')
  })

  // ── 5. Stake gate (express landing; do NOT drive Stripe checkout) ──────────
  await test.step('stake setup', async () => {
    await expect(page.getByText(/Put real skin in the game/i)).toBeVisible()
    // Open the full wizard, confirm it renders, then leave without paying.
    await page.getByRole('button', { name: /customise every dial/i }).click()
    await page.waitForTimeout(500)
    record('stake-setup (express + wizard)')
  })

  // ── 6. Authenticated in-app tour ───────────────────────────────────────────
  // hasNav: true → a ConsumerShell surface that must render the bottom nav.
  const surfaces: Array<{ path: string; label: string; hasNav: boolean }> = [
    { path: '/home', label: '/home', hasNav: true },
    { path: '/ivy', label: '/ivy', hasNav: true },
    { path: '/circles', label: '/circles', hasNav: true },
    { path: '/donations', label: '/donations (Impact)', hasNav: true },
    { path: '/daily', label: '/daily', hasNav: false },
    { path: '/settings', label: '/settings', hasNav: false },
  ]

  // Record an assertion failure as a violation (instead of throwing), so one
  // broken surface doesn't hide the rest — the final report lists them all.
  const softCheck = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e: any) {
      violations.push({ kind: 'console', detail: `assertion@${label}: ${e.message}` } as any)
    }
  }

  for (const s of surfaces) {
    await test.step(`visit ${s.label}`, async () => {
      await page.goto(s.path)
      await settle()
      // 1. Did NOT silently bounce to login/onboarding (the "dead app" symptom).
      await softCheck(s.label, async () => {
        const path = new URL(page.url()).pathname
        expect(path, `expected to stay on ${s.path}, landed on ${path}`).toContain(s.path)
      })
      // 2. Real content rendered — not a blank/error shell.
      await softCheck(s.label, async () => {
        const text = (await page.locator('main, body').first().innerText()).trim()
        expect(text.length, 'page rendered with no visible text').toBeGreaterThan(40)
      })
      // 3. Consumer-shell surfaces must show the primary nav.
      if (s.hasNav) {
        await softCheck(s.label, async () => {
          await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible()
        })
      }
      record(s.label)
    })
  }

  // ── 7. Ivy chat — real round-trip (one accepted Anthropic call) ────────────
  await test.step('ivy chat round-trip', async () => {
    await page.goto('/ivy')
    await settle()
    const composer = page.getByPlaceholder('Message Ivy…')
    await expect(composer).toBeVisible()
    const before = await page.locator('.surface.rounded-2xl').count()
    await composer.fill('Hey Ivy — this is an automated end-to-end check. Reply with one short line.')
    await page.getByRole('button', { name: 'Send' }).click()
    // Wait for an Ivy reply bubble to appear (real backend → Anthropic).
    await expect
      .poll(async () => page.locator('.surface.rounded-2xl').count(), {
        timeout: 45_000,
        message: 'Ivy never replied to the chat message',
      })
      .toBeGreaterThan(before)
    await settle()
    record('/ivy (send + reply)')
  })

  // ── Final report ───────────────────────────────────────────────────────────
  // Logs any network-level drops for visibility (informational — see the fixture
  // note). Real breakage is caught by the per-surface checks and HTTP-≥400 guard.
  assertNoPersistentApiFailures()

  if (report.length > 0) {
    const summary = report
      .map((r) => `\n● ${r.label}\n${r.items.map((i) => `    - ${i}`).join('\n')}`)
      .join('\n')
    throw new Error(`E2E found ${report.length} broken surface(s):\n${summary}`)
  }
})
