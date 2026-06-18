export type Currency = 'GBP' | 'USD'
export type Region = 'GB' | 'US'

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: '£',
  USD: '$',
}

// Stake-rework model (§9): ONE B2C plan, "Ivy" = the PRO tier at £35/$44.
// ELITE/CONCIERGE are retired but kept here so legacy permission/settings
// helpers still resolve; they are no longer offered or linked anywhere.
export const TIER_PRICES: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 35,  USD: 44  },
  ELITE:     { GBP: 99,  USD: 119 },
  CONCIERGE: { GBP: 149, USD: 179 },
}

/** The single Ivy plan price — the public-facing source of truth (matches live Stripe). */
export const IVY_PRICE: Record<Currency, number> = { GBP: 35, USD: 44 }

/** Minimum weekly stake the user puts on the line (§9 decision 2). */
export const STAKE_MIN_WEEKLY: Record<Currency, number> = { GBP: 7, USD: 10 }

export const IMPACT_WALLET_MONTHLY: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 30, USD: 37 },
  ELITE:     { GBP: 45, USD: 55 },
  CONCIERGE: { GBP: 60, USD: 75 },
}

export const B2B_PRICES: Record<string, Record<Currency, number>> = {
  TEAM:     { GBP: 45, USD: 55 },
  CHAMPION: { GBP: 65, USD: 79 },
}

export const COACH_PRICE: Record<Currency, number> = {
  GBP: 79, USD: 99,
}

export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount}`
}

export function getTierPrice(tier: string, currency: Currency): string {
  const price = TIER_PRICES[tier]?.[currency]
  if (!price) return 'Custom'
  return `${CURRENCY_SYMBOL[currency]}${price}/mo`
}

export function getWalletRate(tier: string, currency: Currency): string {
  const monthly = IMPACT_WALLET_MONTHLY[tier]?.[currency]
  if (!monthly) return ''
  const symbol = CURRENCY_SYMBOL[currency]
  const daily = (monthly / 30).toFixed(2).replace(/\.?0+$/, '')
  return `${symbol}${monthly}/month impact wallet (${symbol}${daily}/day)`
}
