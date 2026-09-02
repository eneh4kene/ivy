/**
 * Renders scripts/og-card.html to the share cards in public/og/.
 *   node scripts/make-og.mjs
 * Re-run whenever the card copy or design changes; commit the PNGs.
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '..', 'public', 'og')
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

for (const v of ['root', 'coach', 'invite']) {
  await page.goto(`file://${path.join(here, 'og-card.html')}?v=${v}`)
  // Webfonts decide the whole look; never shoot before they're resolved.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const file = path.join(out, `${v}.png`)
  await page.screenshot({ path: file })
  console.log(`  ${v}.png  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`)
}
await browser.close()
