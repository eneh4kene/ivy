export type Currency = 'GBP' | 'USD'
export type Region = 'GB' | 'US'

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: '£',
  USD: '$',
}

export const TIER_PRICES: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 70,  USD: 89  },
  ELITE:     { GBP: 99,  USD: 119 },
  CONCIERGE: { GBP: 149, USD: 179 },
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

export const IMPACT_WALLET_MONTHLY: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 30, USD: 37 },
  ELITE:     { GBP: 45, USD: 55 },
  CONCIERGE: { GBP: 60, USD: 75 },
}

// Maps internal tier enum → env var name fragment.
// Env vars: STRIPE_PRICE_IVY_{GBP|USD}, STRIPE_PRICE_IVY_PLUS_{GBP|USD},
//   STRIPE_PRICE_IVY_CONCIERGE_{GBP|USD}, STRIPE_PRICE_B2B_TEAM_{GBP|USD}
// Coach plans use createCoachCheckoutSession (STRIPE_PRICE_COACH_{5|10|20}_{GBP|USD}).
const TIER_ENV_NAME: Record<string, string> = {
  PRO:       'IVY',
  ELITE:     'IVY_PLUS',
  CONCIERGE: 'IVY_CONCIERGE',
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
