'use client'

/**
 * Reusable charity picker — used for:
 *   (a) success charity (§2: corporate donation fires on success) — optional
 *   (b) disliked charity — SAVAGE forfeit destination (§3) — required
 *
 * Wired to the real backend:
 *   - GET  /api/donations/charities         → curated DB catalogue (real ids)
 *   - GET  /api/donations/charities/search  → Every.org search (1M+ nonprofits)
 *   - POST /api/donations/charities/import  → upsert an Every.org pick into our DB
 *
 * onChange always emits a REAL DB charity id (+ display name). For an Every.org
 * result we import-on-select first so the id the stake config saves is a valid
 * active charity (the backend rejects unknown ids).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { donationsApi } from '@/lib/api'
import type { Charity } from '@/lib/types'

interface CharitySelectStepProps {
  mode: 'success' | 'savage'
  value: string | null
  onChange: (id: string, name: string) => void
  onNext: () => void
  /** success charity is optional — lets the user fall back to the house default */
  onSkip?: () => void
}

interface EveryOrgResult {
  slug: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
}

// Deterministic avatar colour + initials when a charity has no logo image.
function avatarFor(name: string): { initials: string; hue: number } {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return { initials: initials || '?', hue: hash % 360 }
}

function CharityAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const { initials, hue } = avatarFor(name)
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-ink-700" />
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-ink-900 shrink-0"
      style={{ background: `hsl(${hue}, 60%, 60%)` }}
    >
      {initials}
    </div>
  )
}

export function CharitySelectStep({ mode, value, onChange, onNext, onSkip }: CharitySelectStepProps) {
  const isSuccess = mode === 'success'

  const [query, setQuery] = useState('')
  const [charities, setCharities] = useState<Charity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Every.org search state
  const [everyOrgResults, setEveryOrgResults] = useState<EveryOrgResult[]>([])
  const [searching, setSearching] = useState(false)
  const [importingSlug, setImportingSlug] = useState<string | null>(null)

  // Track the selected charity's display name (selection may come from an import).
  const [selectedName, setSelectedName] = useState<string | null>(null)

  // ── Load the curated DB catalogue ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    donationsApi
      .getCharities()
      .then((list) => {
        if (cancelled) return
        setCharities(list)
        setLoadError(false)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Local filter over the DB catalogue.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return charities
    return charities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    )
  }, [charities, query])

  // ── Debounced Every.org search (for causes not in the curated list) ──
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setEveryOrgResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      donationsApi
        .searchCharities(q)
        .then((results: any[]) => {
          // Drop anything already in our curated list (matched by slug).
          const known = new Set(charities.map((c) => c.everyOrgSlug).filter(Boolean))
          setEveryOrgResults(
            (results || [])
              .filter((r) => r.slug && !known.has(r.slug))
              .slice(0, 8)
              .map((r) => ({
                slug: r.slug,
                name: r.name,
                description: r.description,
                logoUrl: r.logoUrl,
                websiteUrl: r.websiteUrl,
              }))
          )
        })
        .catch(() => setEveryOrgResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(t)
  }, [query, charities])

  const selectDbCharity = useCallback(
    (c: Charity) => {
      setSelectedName(c.name)
      onChange(c.id, c.name)
    },
    [onChange]
  )

  // Importing an Every.org pick yields a real DB charity row we can stake against.
  const selectEveryOrg = useCallback(
    async (r: EveryOrgResult) => {
      setImportingSlug(r.slug)
      try {
        const charity = await donationsApi.importCharity({
          slug: r.slug,
          name: r.name,
          description: r.description,
          logoUrl: r.logoUrl,
          websiteUrl: r.websiteUrl,
        })
        // Keep it visible in the curated list for the rest of this session.
        setCharities((prev) => (prev.some((c) => c.id === charity.id) ? prev : [charity, ...prev]))
        setSelectedName(charity.name)
        onChange(charity.id, charity.name)
        setEveryOrgResults([])
        setQuery('')
      } catch {
        // leave selection unchanged — user can retry
      } finally {
        setImportingSlug(null)
      }
    },
    [onChange]
  )

  const selected = charities.find((c) => c.id === value)
  const selectedDisplayName = selected?.name ?? selectedName

  return (
    <div className="flex flex-col gap-5">
      {/* Hero copy */}
      <div className="space-y-1.5">
        {isSuccess ? (
          <>
            <h2 className="font-display text-2xl text-ink-50 leading-tight">
              Who benefits when<br />
              <span className="text-gradient-sage">you follow through?</span>
            </h2>
            <p className="text-sm text-ink-400 leading-relaxed">
              On days you show up, a corporate donor contributes to this cause.
              You don't pay — this is the warmth side of the system. Optional.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-ink-50 leading-tight">
              Pick a cause you'd<br />
              <span className="text-ember-400 italic">hate to fund</span>
            </h2>
            <p className="text-sm text-ink-400 leading-relaxed">
              When you slip, your stake goes here. Choose something that genuinely
              makes you wince — that's the point.
            </p>
          </>
        )}
      </div>

      {/* Selected preview */}
      {value && selectedDisplayName && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 transition-all ${
            isSuccess
              ? 'glass-sage border border-sage-400/20'
              : 'border border-ember-400/30 glow-ember'
          }`}
          style={!isSuccess ? { background: 'rgba(210,90,46,0.06)' } : {}}
        >
          <CharityAvatar name={selectedDisplayName} logoUrl={selected?.logoUrl} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isSuccess ? 'text-sage-300' : 'text-ember-400'}`}>
              {selectedDisplayName}
            </p>
            {selected?.category && <p className="text-xs text-ink-400">{selected.category}</p>}
          </div>
          <Check className={`w-4 h-4 shrink-0 ${isSuccess ? 'text-sage-400' : 'text-ember-400'}`} />
        </div>
      )}

      {/* SAVAGE extra context */}
      {!isSuccess && (
        <div className="flex items-start gap-2 px-1">
          <AlertTriangle className="w-3.5 h-3.5 text-ember-400 shrink-0 mt-0.5" />
          <p className="text-xs text-ink-400">
            This must be a <em>real charity you'd hate to benefit from your failure</em>.
            Don't pick something harmless — that defeats the purpose.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search charities…"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-ink-700 border border-ink-600 text-sm text-ink-50 placeholder:text-ink-400 focus:outline-none focus:border-ink-400 transition-colors"
        />
      </div>

      {/* Charity list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto overscroll-contain pr-0.5">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-ink-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading charities…
          </div>
        )}

        {!loading && loadError && (
          <p className="text-center text-xs text-ember-400 py-6">
            Couldn't load charities. Check your connection and try again.
          </p>
        )}

        {!loading &&
          !loadError &&
          filtered.map((c) => {
            const isSelected = c.id === value
            return (
              <button
                key={c.id}
                onClick={() => selectDbCharity(c)}
                className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? isSuccess
                      ? 'border border-sage-400/30 bg-sage-400/07'
                      : 'border border-ember-400/40 bg-ember-400/07'
                    : 'surface hover:bg-ink-700'
                }`}
              >
                <CharityAvatar name={c.name} logoUrl={c.logoUrl} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isSelected ? (isSuccess ? 'text-sage-300' : 'text-ember-300') : 'text-ink-50'
                    }`}
                  >
                    {c.name}
                  </p>
                  {c.category && <p className="text-xs text-ink-400 truncate">{c.category}</p>}
                </div>
                {isSelected && (
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isSuccess ? 'bg-sage-400' : 'bg-ember-400'
                    }`}
                  >
                    <Check className="w-3 h-3 text-ink-900" />
                  </div>
                )}
              </button>
            )
          })}

        {/* Every.org results — anything not in the curated list */}
        {!loading && (searching || everyOrgResults.length > 0) && (
          <div className="pt-2">
            <p className="text-2xs uppercase tracking-widest text-ink-400 px-1 pb-1.5 flex items-center gap-1.5">
              More from Every.org {searching && <Loader2 className="w-3 h-3 animate-spin" />}
            </p>
            {everyOrgResults.map((r) => (
              <button
                key={r.slug}
                onClick={() => selectEveryOrg(r)}
                disabled={importingSlug !== null}
                className="w-full text-left flex items-center gap-3 p-3.5 rounded-xl transition-all duration-150 active:scale-[0.98] surface hover:bg-ink-700 disabled:opacity-50"
              >
                <CharityAvatar name={r.name} logoUrl={r.logoUrl} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-50 truncate">{r.name}</p>
                  {r.description && <p className="text-xs text-ink-400 truncate">{r.description}</p>}
                </div>
                {importingSlug === r.slug && <Loader2 className="w-4 h-4 animate-spin text-ink-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && everyOrgResults.length === 0 && !searching && (
          <p className="text-center text-xs text-ink-400 py-6">No charities matching "{query}"</p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!value}
        className={`w-full py-4 rounded-2xl font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 ${
          isSuccess
            ? 'text-ink-900 bg-gold-400 hover:bg-gold-300'
            : 'text-ink-900 bg-ember-400 hover:bg-ember-400/90 glow-ember'
        }`}
      >
        {value && selectedDisplayName
          ? isSuccess
            ? `${selectedDisplayName} — continue`
            : `That's my anti-charity — continue`
          : isSuccess
          ? 'Choose a success charity'
          : 'Choose your anti-charity'}
      </button>

      {/* Success charity is optional — let the user defer to the house default */}
      {isSuccess && onSkip && (
        <button
          onClick={onSkip}
          className="w-full -mt-2 py-2 text-sm text-ink-400 hover:text-ink-200 transition-colors"
        >
          Skip — no success charity for now
        </button>
      )}
    </div>
  )
}
