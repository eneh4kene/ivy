export type Currency = 'GBP' | 'USD'
export type Region = 'GB' | 'US'

// ---------------------------------------------------------------------------
// Stake config — all money figures wired here, never hard-coded inline.
// ⚑ PLACEHOLDER: minimum and default pending founder confirmation of real COGS.
// Per §9 decision 2: £7/week (£1/day) floor; £14/week (£2/day) suggested default.
// ---------------------------------------------------------------------------
export const STAKE_CONFIG = {
  /** Absolute floor — arming is rejected below this (§9 decision 2) */
  minWeeklyStake: { GBP: 7, USD: 10 } as Record<Currency, number>,
  /** Pre-filled suggestion at onboarding (user can raise it) */
  defaultWeeklyStake: { GBP: 14, USD: 20 } as Record<Currency, number>,
  /** Grace skips per cycle (§2 "grace valve") — configurable here, never in service code */
  graceSkipsPerCycle: 1,
  /** Default forfeit mode (§9 decision 5) */
  forfeitModeDefault: 'MIDDLE' as const,
  /** Stripe auth window in days; weekly cycle fits the ~7-day hold (§2) */
  cycleDays: 7,
} as const

// ---------------------------------------------------------------------------
// Grace skips per cycle — exported as a convenience alias used by stake.service.ts
// ---------------------------------------------------------------------------
export const GRACE_SKIPS_PER_CYCLE = STAKE_CONFIG.graceSkipsPerCycle

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: '£',
  USD: '$',
}

// ---------------------------------------------------------------------------
// One paid B2C tier — "Ivy" (enum: PRO).
// ⚑ PLACEHOLDER pending founder COGS confirmation (§9 decision 1).
// ELITE and CONCIERGE are RETIRED; kept here as comments only.
// Data migration: prisma/migrations/20260616000001_phase5_tier_collapse/migration.sql
// ---------------------------------------------------------------------------
export const TIER_PRICES: Record<string, Record<Currency, number>> = {
  PRO: { GBP: 35, USD: 44 }, // confirmed price (live Stripe: prod_UiXyiBcwF2SNRI; GBP price_1Tj6tAFupLFcPbOvSEjO4Yd2 / USD price_1Tj6tAFupLFcPbOvWSiZJOOZ)
  // ELITE:     retired — collapsed to PRO (Phase 5)
  // CONCIERGE: retired — collapsed to PRO (Phase 5)
}

export const B2B_PRICES: Record<string, Record<Currency, number>> = {
  TEAM:     { GBP: 45, USD: 55 },
  CHAMPION: { GBP: 65, USD: 79 },
}

// Coach tier: flat monthly rate, unlimited clients
// STRIPE_PRICE_COACH_GBP, STRIPE_PRICE_COACH_USD
export const COACH_PRICE: Record<Currency, number> = {
  GBP: 79, USD: 99,
}

// ---------------------------------------------------------------------------
// IMPACT_WALLET_MONTHLY — DEPRECATED (Phase 5, §8 of product-pricing-rework.md).
//
// Under v1.1 a fixed slice of the subscription (£30/£45/£60) was pre-allocated
// as charity budget and donated only on workout completion. Under the rework
// (§1a/§1b/§8) the subscription is DECOUPLED from charity funding:
//   - Follow-through RELEASES the user's stake (Phase 2/4 already wired).
//   - Charity funding comes from stake forfeits + Phase 6 corporate CSR pool.
//   - Per-completion wallet donations are RETIRED (see workout.service.ts).
//
// The ImpactWallet model is RETAINED for lifetime-donated tracking only
// (lifetimeDonated field); the monthlyLimit / dailyCap allocation logic is
// no longer set or enforced. Any code still reading this constant is calling
// deprecated behaviour and should be migrated.
// ---------------------------------------------------------------------------
/** @deprecated Phase 5 — bundled wallet allocation retired. See docs/product-pricing-rework.md §8 */
export const IMPACT_WALLET_MONTHLY: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 30, USD: 37 },
  ELITE:     { GBP: 45, USD: 55 },
  CONCIERGE: { GBP: 60, USD: 75 },
}

// Maps internal tier enum → env var name fragment.
// One B2C tier: PRO ("Ivy"). ELITE/CONCIERGE price IDs are routed to PRO in
// payment.service.ts getTierFromPriceId so any legacy Stripe price still works.
// Env vars: STRIPE_PRICE_IVY_{GBP|USD}, STRIPE_PRICE_B2B_TEAM_{GBP|USD}
// Coach plans use createCoachCheckoutSession (STRIPE_PRICE_COACH_{GBP|USD}).
const TIER_ENV_NAME: Record<string, string> = {
  PRO:       'IVY',
  // ELITE / CONCIERGE removed — legacy price IDs handled in getTierFromPriceId
  B2B:       'B2B_TEAM',
  COACH:     'COACH',
}

export function getStripePriceId(tier: string, currency: Currency): string | undefined {
  const envName = TIER_ENV_NAME[tier] ?? tier
  const key = `STRIPE_PRICE_${envName}_${currency}`
  return process.env[key]
}

export function formatPrice(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOL[currency]
  return `${symbol}${amount}`
}

export function getRegionFromCurrency(currency: Currency): Region {
  return currency === 'USD' ? 'US' : 'GB'
}

export const GBP_TO_USD = 1.27
