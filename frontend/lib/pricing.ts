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

export const IMPACT_WALLET_MONTHLY: Record<string, Record<Currency, number>> = {
  PRO:       { GBP: 30, USD: 37 },
  ELITE:     { GBP: 45, USD: 55 },
  CONCIERGE: { GBP: 60, USD: 75 },
}

export const B2B_PRICES: Record<string, Record<Currency, number>> = {
  TEAM:     { GBP: 45, USD: 55 },
  CHAMPION: { GBP: 65, USD: 79 },
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
