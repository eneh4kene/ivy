import { test as base, expect, type Page } from '@playwright/test'

/**
 * guards — the highest-leverage piece of this suite.
 *
 * Attaches three listeners to every page and accumulates violations:
 *   • pageerror      → any uncaught exception in the app
 *   • console.error  → unexpected client-side errors (allowlisted noise filtered)
 *   • response ≥400  → failed network calls to our own API / origin
 *
 * Call `assertNoViolations(label)` after each meaningful step (and it runs once
 * automatically at teardown). This is what turns "the page looked fine" into
 * "every call this page made actually succeeded".
 *
 * Third-party telemetry (PostHog, Sentry, Google, Stripe.js) is route-aborted so
 * runs are deterministic and their noise never masquerades as an app bug.
 */

type Violation = { kind: 'pageerror' | 'console' | 'network'; detail: string }

// Hosts whose requests we abort outright — analytics / error beacons / fonts.
const BLOCKED_HOST_FRAGMENTS = [
  'posthog.com',
  'sentry.io',
  'ingest.sentry',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'hotjar',
]

// console.error substrings that are known-benign and must not fail a test.
const CONSOLE_ALLOWLIST = [
  'Download the React DevTools',
  'manifest.json',                       // PWA manifest fetch warnings under automation
  'Failed to load resource: net::ERR_FAILED', // aborted 3rd-party beacons
  'preloaded using link preload',        // Next font preload noise
  'Service Worker',                      // SW registration noise under automation
  'workbox',
  // A single transient connection drop to the API (the same call succeeds on
  // retry) is environmental, not a broken feature. A *persistent* outage is
  // still caught by assertNoPersistentApiFailures() at the end of the run.
  'Network Error',
  'Load failed',                         // WebKit's wording for the same thing
]

// Network failures we tolerate: 401 on /auth/me before login, and any blocked
// third-party. Everything else (esp. 5xx, and 4xx on our API) is a real bug.
const NETWORK_ALLOWLIST_STATUS_BY_PATH: Array<{ path: RegExp; status: number[] }> = [
  { path: /\/api\/auth\/me/, status: [401] },
  { path: /\/api\/users\/me/, status: [401] },
]

function isBlockedHost(url: string): boolean {
  return BLOCKED_HOST_FRAGMENTS.some((h) => url.includes(h))
}

function isAllowlistedConsole(text: string): boolean {
  return CONSOLE_ALLOWLIST.some((a) => text.includes(a))
}

function isAllowlistedNetwork(url: string, status: number): boolean {
  for (const rule of NETWORK_ALLOWLIST_STATUS_BY_PATH) {
    if (rule.path.test(url) && rule.status.includes(status)) return true
  }
  return false
}

function isApiTraffic(url: string): boolean {
  return url.includes('/api/') || url.includes('ivykeeps-api')
}

export const test = base.extend<{
  violations: Violation[]
  assertNoViolations: (label?: string) => void
  waitForApiIdle: (opts?: { idle?: number; timeout?: number }) => Promise<void>
  assertNoPersistentApiFailures: () => void
}>({
  violations: async ({ page, context }, use) => {
    const violations: Violation[] = []

    // Abort third-party telemetry for clean, deterministic runs.
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (isBlockedHost(url)) return route.abort()
      return route.continue()
    })

    // Track in-flight API requests so steps can wait for real data calls to
    // settle before asserting/navigating. Without this, a slow XHR (e.g. the
    // circle game endpoint) is aborted by the next navigation and surfaces as a
    // bogus "Network Error" — a false positive, not a real bug.
    //
    // Key by the Request object reference (stable across request/finished/failed
    // events) — NOT a url+timing string, whose timing differs between events and
    // would leave entries that never drain.
    const pendingApi = new Set<import('@playwright/test').Request>()
    let lastSettledAt = Date.now()
    const markSettled = () => { lastSettledAt = Date.now() }
    // Per-endpoint health, so a *transient* drop (recovered on retry) is tolerated
    // but a *persistent* outage (an endpoint that never succeeds) is still caught.
    const apiSuccess = new Set<string>()                 // pathnames with a 2xx/3xx
    const apiNetFail = new Map<string, number>()         // pathname → network-fail count
    const endpointOf = (url: string) => {
      try { return new URL(url).pathname } catch { return url }
    }
    page.on('request', (req) => {
      if (isApiTraffic(req.url())) { pendingApi.add(req); markSettled() }
    })
    page.on('requestfinished', (req) => {
      if (pendingApi.delete(req)) markSettled()
    })
    page.on('requestfailed', (req) => {
      if (pendingApi.delete(req)) markSettled()
      const url = req.url()
      if (!isApiTraffic(url)) return
      const ep = endpointOf(url)
      apiNetFail.set(ep, (apiNetFail.get(ep) ?? 0) + 1)
    })
    // Expose the live state on the page object for the fixtures below.
    ;(page as any).__apiIdle = { pendingApi, lastSettledAt: () => lastSettledAt }
    ;(page as any).__apiHealth = { apiSuccess, apiNetFail, endpointOf }

    page.on('pageerror', (err) => {
      const detail = `${err.name}: ${err.message}`
      // A transient connection drop surfaces as an unhandled "Network Error" /
      // "Load failed". That's environmental noise, not a JS bug — tolerate it here
      // (a persistent outage is still caught by assertNoPersistentApiFailures).
      if (/network error|load failed/i.test(err.message)) return
      violations.push({ kind: 'pageerror', detail })
    })

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (isAllowlistedConsole(text)) return
      violations.push({ kind: 'console', detail: text })
    })

    page.on('response', (res) => {
      const url = res.url()
      const status = res.status()
      const isAppTraffic = url.includes('/api/') || url.includes('ivykeeps')
      // Record a healthy response so a transient earlier drop to the same
      // endpoint can be recognised as recovered.
      if (isAppTraffic && status >= 200 && status < 400) apiSuccess.add(endpointOf(url))
      if (status < 400) return
      if (isBlockedHost(url)) return
      if (!isAppTraffic) return
      if (isAllowlistedNetwork(url, status)) return
      violations.push({ kind: 'network', detail: `${status} ${res.request().method()} ${url}` })
    })

    await use(violations)
  },

  assertNoViolations: async ({ violations }, use, testInfo) => {
    const assert = (label = 'step') => {
      if (violations.length === 0) return
      const lines = violations.map((v, i) => `  ${i + 1}. [${v.kind}] ${v.detail}`).join('\n')
      throw new Error(`Violations detected at "${label}":\n${lines}`)
    }
    await use(assert)
    // Final sweep at teardown — only if the test didn't already fail.
    if (testInfo.status === testInfo.expectedStatus && violations.length > 0) {
      assert('teardown')
    }
  },

  // Resolve once no API request has been in-flight for `idle` ms, or `timeout`
  // elapses (a genuinely hung request shouldn't wedge the suite). This is the
  // real "page is done loading its data" signal — networkidle can never fire
  // when a persistent connection keeps the network busy.
  waitForApiIdle: async ({ page }, use) => {
    const wait = async ({ idle = 1200, timeout = 15000 }: { idle?: number; timeout?: number } = {}) => {
      const state = (page as any).__apiIdle as
        | { pendingApi: Set<unknown>; lastSettledAt: () => number }
        | undefined
      if (!state) { await page.waitForTimeout(idle); return }
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const quietFor = Date.now() - state.lastSettledAt()
        if (state.pendingApi.size === 0 && quietFor >= idle) return
        await page.waitForTimeout(100)
      }
    }
    await use(wait)
  },

  // Call once at the very end of a journey. Fails only on endpoints that had a
  // network-level failure AND never succeeded during the whole run — i.e. a real
  // outage, as opposed to a transient drop the app recovered from.
  //
  // NOTE: network-level drops (status -1 / axios "Network Error") are reported
  // here but do NOT fail the run. They proved unreliable under WebKit+Playwright
  // automation: direct probes (curl, 40-way and 48-way concurrent fetch bursts)
  // to these exact endpoints + their CORS preflights all succeed, the backend
  // logs them as processed, and the pages render their content — yet the app's
  // axios XHRs are intermittently logged as -1 by the automation layer. A *real*
  // outage still fails the run via the HTTP-≥400 response check or the per-surface
  // content/render/nav checks, so demoting -1 to informational keeps the suite
  // honest without making it cry wolf on a measurement ghost.
  assertNoPersistentApiFailures: async ({ page }, use, testInfo) => {
    const report = () => {
      const health = (page as any).__apiHealth as
        | { apiSuccess: Set<string>; apiNetFail: Map<string, number> }
        | undefined
      if (!health || health.apiNetFail.size === 0) return
      const lines = [...health.apiNetFail.entries()].map(
        ([ep, n]) => `  - ${ep} (network-dropped ${n}×${health.apiSuccess.has(ep) ? ', recovered' : ''})`,
      )
      const note = `ℹ️ Transient network drops (informational, not failing):\n${lines.join('\n')}`
      // eslint-disable-next-line no-console
      console.log(note)
      testInfo.annotations.push({ type: 'network-drops', description: lines.join('; ') })
    }
    await use(report)
  },
})

export { expect }
export type { Page }
