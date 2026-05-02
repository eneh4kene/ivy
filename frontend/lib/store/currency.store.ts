import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Currency, Region } from '../pricing'

interface CurrencyState {
  currency: Currency
  region: Region
  setCurrency: (currency: Currency) => void
  setRegion: (region: Region) => void
  setFromUser: (user: { currency?: string; region?: string }) => void
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: 'GBP',
      region: 'GB',
      setCurrency: (currency) => set({ currency }),
      setRegion: (region) => set({ region }),
      setFromUser: (user) => set({
        currency: (user.currency as Currency) ?? 'GBP',
        region: (user.region as Region) ?? 'GB',
      }),
    }),
    { name: 'ivy-currency' }
  )
)
