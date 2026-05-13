'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { useCurrencyStore } from '@/lib/store/currency.store'
import { donationsApi } from '@/lib/api'
import { Search, CheckCircle2, Sparkles } from 'lucide-react'

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
  FREE: 2,
  PRO: 2,
  ELITE: 3,
  CONCIERGE: 999,
}

const CATEGORY_EMOJI: Record<string, string> = {
  health: '💚',
  poverty: '🤝',
  environment: '🌍',
  education: '📚',
  animals: '🐾',
  community: '🌿',
}

interface CharitySelectionStepProps {
  onCharityReady?: (ready: boolean) => void
}

export function CharitySelectionStep({ onCharityReady }: CharitySelectionStepProps) {
  const { user } = useAuthStore()
  const currency = useCurrencyStore((s) => s.currency)
  const region = user?.region ?? 'GB'
  const tier = user?.subscriptionTier ?? 'PRO'
  const limit = TIER_LIMITS[tier] ?? 1
  const walletRate = currency === 'USD' ? '$1/session' : '£1/session'

  const [partnerCharities, setPartnerCharities] = useState<Charity[]>([])
  const [allSelected, setAllSelected] = useState<Charity[]>([]) // both partner + imported
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EveryOrgResult[]>([])
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null) // slug being imported
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    donationsApi.getCharities({ region, track: user?.track })
      .then(setPartnerCharities)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [region, user?.track])

  const save = async (ids: string[]) => {
    setSaving(true)
    try {
      await donationsApi.setUserCharities(ids)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const togglePartner = async (charity: Charity) => {
    const isSelected = selectedIds.includes(charity.id)
    let nextIds: string[]
    let nextSelected: Charity[]

    if (isSelected) {
      nextIds = selectedIds.filter((id) => id !== charity.id)
      nextSelected = allSelected.filter((c) => c.id !== charity.id)
    } else {
      if (selectedIds.length >= limit) return
      nextIds = [...selectedIds, charity.id]
      nextSelected = [...allSelected, charity]
    }

    setSelectedIds(nextIds)
    setAllSelected(nextSelected)
    onCharityReady?.(nextIds.length > 0)
    if (nextIds.length > 0) await save(nextIds)
  }

  const handleSearch = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await donationsApi.searchCharities(q.trim())
        // Filter out charities already in partner list
        const partnerSlugs = new Set(partnerCharities.map((c) => c.everyOrgSlug).filter(Boolean))
        setSearchResults((res ?? []).filter((r: EveryOrgResult) => !partnerSlugs.has(r.slug)))
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const importAndSelect = async (result: EveryOrgResult) => {
    if (selectedIds.length >= limit) return
    setImporting(result.slug)
    try {
      const imported = await donationsApi.importCharity({
        slug: result.slug,
        name: result.name,
        description: result.description,
        logoUrl: result.logoUrl,
        websiteUrl: result.websiteUrl,
      })
      const nextIds = [...selectedIds, imported.id]
      const nextSelected = [...allSelected, imported]
      setSelectedIds(nextIds)
      setAllSelected(nextSelected)
      onCharityReady?.(true)
      setQuery('')
      setSearchResults([])
      await save(nextIds)
    } catch (e) {
      console.error('Failed to import charity:', e)
    } finally {
      setImporting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}
      </div>
    )
  }

  const atLimit = selectedIds.length >= limit

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Every time you follow through, {walletRate} from your wallet goes to the cause you choose.
        {limit < 999
          ? ` Choose up to ${limit} — your wallet splits equally.`
          : ' Choose as many as you like — your wallet splits equally.'}
      </p>

      {/* Partner charities */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Partner charities</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          These charities work with Ivy directly — we can show you exactly what your donations achieve.
        </p>
        <div className="space-y-2.5">
          {partnerCharities.map((charity) => {
            const isSelected = selectedIds.includes(charity.id)
            const disabled = atLimit && !isSelected
            return (
              <div
                key={charity.id}
                onClick={() => !disabled && togglePartner(charity)}
                className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : disabled
                    ? 'border-border opacity-40 cursor-not-allowed'
                    : 'border-border hover:border-border/80 hover:bg-accent/20 cursor-pointer'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                  {CATEGORY_EMOJI[charity.category] ?? '💛'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{charity.name}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/20">
                      Partner
                    </span>
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
      </div>

      {/* Search any charity */}
      <div className="border-t border-border pt-6">
        <p className="text-sm font-medium mb-1">Or search any registered charity</p>
        <p className="text-xs text-muted-foreground mb-3">
          1M+ charities via Every.org. No impact data available for these — just your donation.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={atLimit ? `Limit reached (${limit})` : 'Search charities…'}
            value={query}
            disabled={atLimit}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>

        {searching && <p className="mt-2 text-xs text-muted-foreground px-1">Searching…</p>}

        {searchResults.length > 0 && (
          <div className="mt-2 space-y-2">
            {searchResults.slice(0, 6).map((r) => {
              const isAlreadySelected = allSelected.some((c) => c.everyOrgSlug === r.slug)
              const isImporting = importing === r.slug
              return (
                <div
                  key={r.slug}
                  onClick={() => !isAlreadySelected && !isImporting && !atLimit && importAndSelect(r)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isAlreadySelected
                      ? 'border-emerald-500 bg-emerald-500/5 cursor-default'
                      : atLimit
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : 'border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isImporting ? (
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : isAlreadySelected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Add</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selection summary */}
      {selectedIds.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Selected ({selectedIds.length}/{limit === 999 ? '∞' : limit})</p>
          <div className="flex flex-wrap gap-2">
            {allSelected.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400"
              >
                {c.name}
                {saving ? null : (
                  <button
                    onClick={() => togglePartner(c)}
                    className="text-emerald-400/60 hover:text-emerald-400 ml-0.5"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {saving && <p className="text-xs text-muted-foreground mt-2">Saving…</p>}
        </div>
      )}
    </div>
  )
}
