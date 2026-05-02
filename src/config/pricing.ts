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

export const IMPACT_WALLET_MONTHLY: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 30, USD: 37 },
  ELITE:     { GBP: 45, USD: 55 },
  CONCIERGE: { GBP: 60, USD: 75 },
}

// Stripe Price IDs — set these via environment variables
// Create USD prices in your Stripe dashboard, then add to .env:
//   STRIPE_PRICE_PRO_GBP, STRIPE_PRICE_PRO_USD
//   STRIPE_PRICE_ELITE_GBP, STRIPE_PRICE_ELITE_USD
//   STRIPE_PRICE_CONCIERGE_GBP, STRIPE_PRICE_CONCIERGE_USD
export function getStripePriceId(tier: string, currency: Currency): string | undefined {
  const key = `STRIPE_PRICE_${tier}_${currency}`
  return process.env[key]
}

export function formatPrice(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOL[currency]
  return `${symbol}${amount}`
}

export function getRegionFromCurrency(currency: Currency): Region {
  return currency === 'USD' ? 'US' : 'GB'
}
