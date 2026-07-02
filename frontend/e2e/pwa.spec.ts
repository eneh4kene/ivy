import { test, expect } from '@playwright/test'

/**
 * PWA fundamentals on live prod: a valid linked manifest, a registered service
 * worker, and a working offline fallback. These are easy to silently break on a
 * deploy and invisible until an install fails.
 *
 * Uses the plain runner (not the guards fixture): guards' context.route('**')
 * telemetry-abort interferes with service-worker registration/serving under
 * Playwright, which is irrelevant noise for these checks.
 */

test('manifest is linked and valid', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href, 'no <link rel="manifest"> on the page').toBeTruthy()

  const res = await page.request.get(new URL(href!, page.url()).toString())
  expect(res.status(), 'manifest did not return 200').toBe(200)
  const manifest = await res.json()
  expect(manifest.name || manifest.short_name, 'manifest has no name').toBeTruthy()
  expect(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest has no icons').toBeTruthy()
  expect(manifest.start_url, 'manifest has no start_url').toBeTruthy()
})

test('service worker registers', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle').catch(() => {})
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(() => r(null), 25000)),
      ])
      return !!reg
    } catch {
      return false
    }
  })
  expect(registered, 'service worker never reached ready state').toBeTruthy()
})

test('offline fallback renders', async ({ page, context }) => {
  await page.goto('/')
  // Wait for the SW to activate and cache the offline shell before going dark.
  await page.evaluate(() =>
    'serviceWorker' in navigator
      ? Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 25000))])
      : null,
  )
  await page.waitForTimeout(2000)
  await context.setOffline(true)
  try {
    await page.goto('/home', { waitUntil: 'domcontentloaded' }).catch(() => {})
    const body = (await page.locator('body').innerText().catch(() => '')) || ''
    // Either a dedicated offline page or a cached shell — but NOT the browser's
    // native "no internet" error (which leaves an empty body).
    expect(body.length, 'offline navigation produced an empty page (no offline shell)').toBeGreaterThan(0)
  } finally {
    await context.setOffline(false)
  }
})
