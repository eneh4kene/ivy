'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { useCurrencyStore } from '@/lib/store/currency.store'
import { donationsApi } from '@/lib/api'
import { usersApi } from '@/lib/api'
import { Search, CheckCircle2, ExternalLink } from 'lucide-react'

interface Charity {
  id: string
  name: string
  description: string
  category: string
  impactMetric: string
  impactPerPound: string
  logoUrl?: string
  website?: string
  everyOrgSlug?: string
  featured: boolean
}

interface EveryOrgResult {
  slug: string
  name: string
  description: string
  logoUrl?: string
  websiteUrl?: string
}

const TIER_LIMITS: Record<string, number> = {
  FREE: 1,
  PRO: 1,
  ELITE: 2,
  CONCIERGE: 999,
}

const CATEGORY_EMOJI: Record<string, string> = {
  health: '💚',
  poverty: '🤝',
  environment: '🌍',
  education: '📚',
  animals: '🐾',
}

export function CharitySelectionStep() {
  const { user } = useAuthStore()
  const currency = useCurrencyStore((s) => s.currency)
  const region = user?.region ?? 'GB'
  const tier = user?.subscriptionTier ?? 'PRO'
  const limit = TIER_LIMITS[tier] ?? 1
  const isElitePlus = tier === 'ELITE' || tier === 'CONCIERGE'
  const isConcierge = tier === 'CONCIERGE'
  const walletRate = currency === 'USD' ? '$1/day' : '£1/day'

  const [charities, setCharities] = useState<Charity[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Every.org search for Concierge
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EveryOrgResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const track = user?.track ?? undefined
    donationsApi.getCharities({ region, track })
      .then(setCharities)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [region, user?.track])

  const toggle = async (charityId: string) => {
    let next: string[]
    if (selected.includes(charityId)) {
      next = selected.filter((id) => id !== charityId)
    } else {
      if (selected.length >= limit) {
        // Replace last selection if at limit (for single-pick tiers)
        next = limit === 1 ? [charityId] : selected
      } else {
        next = [...selected, charityId]
      }
    }
    setSelected(next)
    setSaving(true)
    try {
      // Save the primary (first) charity
      await usersApi.updateProfile({ preferredCharityId: next[0] ?? null } as any)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await donationsApi.searchCharities(q.trim())
      setSearchResults(res ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const addEveryOrgCharity = async (result: EveryOrgResult) => {
    // For Every.org results on Concierge, we'd create the charity in DB first
    // For now, set a placeholder that gets resolved on next sprint
    setQuery('')
    setSearchResults([])
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every time you follow through, {walletRate} from your wallet goes to the cause you choose.
          {!isElitePlus && ' You can change this any time in settings.'}
          {isElitePlus && limit < 999 && ` You can choose up to ${limit} charities.`}
          {isConcierge && ' On Concierge you can choose any registered charity.'}
        </p>
      </div>

      {/* Curated list */}
      <div className="space-y-2.5">
        {charities.map((charity) => {
          const isSelected = selected.includes(charity.id)
          return (
            <div
              key={charity.id}
              onClick={() => toggle(charity.id)}
              className={`relative flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border hover:border-border/80 hover:bg-accent/20'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                {CATEGORY_EMOJI[charity.category] ?? '💛'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{charity.name}</span>
                  {charity.featured && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      Curated
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{charity.description}</p>
                <p className="text-xs text-emerald-400 mt-1 font-medium">{charity.impactPerPound}</p>
              </div>
              <div className={`shrink-0 mt-0.5 transition-all ${isSelected ? 'text-emerald-500' : 'text-transparent'}`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Every.org search — Concierge only */}
      {isConcierge && (
        <div className="border-t border-border pt-6">
          <p className="text-xs text-muted-foreground mb-3">
            Don't see your cause? Search any registered charity.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search 1M+ charities..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {searching && (
            <div className="mt-2 text-xs text-muted-foreground px-1">Searching...</div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-2">
              {searchResults.slice(0, 5).map((r) => (
                <div
                  key={r.slug}
                  onClick={() => addEveryOrgCharity(r)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
                  </div>
                  {r.websiteUrl && (
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          {saving ? 'Saving...' : `✓ ${charities.find(c => c.id === selected[0])?.name} selected`}
        </div>
      )}
    </div>
  )
}
