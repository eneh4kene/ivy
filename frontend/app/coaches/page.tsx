'use client'

/**
 * /coaches — Consumer-facing coach marketplace.
 *
 * Data source: GET /api/coach/marketplace (real API → MarketplaceCoachSummary[]).
 *
 * Only fields that actually exist on the backend are shown: displayName, photo,
 * programmeName/coachingStyle, ivyVetted. Fields that are not yet in the schema
 * (hourlyRate, rating, reviewCount, specialties, credentials) are intentionally
 * NOT displayed — no fabricated ratings/rates. When those land in CoachProfile,
 * surface them here.
 *
 * Product facts (§5f of docs/product-pricing-rework.md):
 *   - Coach is an optional add-on, available on any plan
 *   - Ivy takes 0% — coaches bill clients directly
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, ChevronRight, Search, X } from 'lucide-react'
import { coachMarketplaceApi, type MarketplaceCoachSummary } from '@/lib/api'

const AVATAR_HUES = [14, 44, 152, 238, 280, 320]
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_HUES[h % AVATAR_HUES.length]
}

function CoachCard({ coach }: { coach: MarketplaceCoachSummary }) {
  const name = coach.displayName || `${coach.firstName} ${coach.lastName}`.trim()
  const tagline = coach.coachingStyle || coach.programmeName || ''
  return (
    <Link href={`/coaches/${coach.id}`} className="block">
      <div className="relative rounded-2xl surface overflow-hidden hover:border-gold-400/20 active:scale-[0.99] transition-all duration-200 cursor-pointer group animate-fade-in">
        <div className="p-4 flex gap-4 items-center">
          {/* Photo / initials */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-700 flex items-center justify-center">
              {coach.photoUrl ? (
                <img src={coach.photoUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center text-lg font-semibold text-ink-900"
                  style={{ background: `hsl(${hueFor(name)}, 52%, 56%)` }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            {coach.ivyVetted && (
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-900 border border-ink-600 flex items-center justify-center" title="Ivy-vetted coach">
                <Shield className="w-2.5 h-2.5 text-gold-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <h3 className="font-display text-base font-semibold text-ink-50 leading-tight">{name}</h3>
              <ChevronRight className="w-4 h-4 text-ink-400 shrink-0 mt-0.5 group-hover:text-gold-400 transition-colors" />
            </div>
            {tagline && <p className="text-xs text-ink-400 italic leading-snug">&ldquo;{tagline}&rdquo;</p>}
            {coach.programmeName && coach.coachingStyle && (
              <p className="text-2xs text-ink-500 mt-1.5">{coach.programmeName}</p>
            )}
            {coach.ivyVetted && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-gold-400/10 border border-gold-400/20 text-2xs text-gold-400 font-medium">
                <Shield className="w-2.5 h-2.5" /> Ivy-vetted
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function CoachMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [coaches, setCoaches] = useState<MarketplaceCoachSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    coachMarketplaceApi.list()
      .then((list) => { if (alive) setCoaches(list) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return coaches
    const q = searchQuery.toLowerCase()
    return coaches.filter((c) => {
      const name = (c.displayName || `${c.firstName} ${c.lastName}`).toLowerCase()
      return name.includes(q) ||
        (c.programmeName ?? '').toLowerCase().includes(q) ||
        (c.coachingStyle ?? '').toLowerCase().includes(q)
    })
  }, [searchQuery, coaches])

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-safe-b">
      <div className="max-w-lg mx-auto px-4">

        {/* ── Nav ── */}
        <div className="flex items-center gap-3 pt-safe-t pt-4 pb-4">
          <Link href="/dashboard">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors" aria-label="Back">
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold text-ink-50 leading-tight">Find a coach</h1>
            <p className="text-2xs text-ink-400 mt-0.5">Optional add-on · Ivy takes 0%</p>
          </div>
        </div>

        {/* ── Value proposition banner ── */}
        <div className="glass-gold rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gold-400/15 border border-gold-400/20 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-gold-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-50 mb-1">Human expertise, Ivy accountability</p>
              <p className="text-xs text-ink-400 leading-relaxed">
                Each coach is Ivy-vetted and bills you directly — Ivy takes 0%.
                Add a coach any time. Cancel any time. No lock-in.
              </p>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        {coaches.length > 0 && (
          <div className="relative flex-1 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coaches…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-ink-800 border border-ink-600 text-sm text-ink-50 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-gold-400/50 focus:border-gold-400/30 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-gold-400 animate-spin" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-ink-700 border border-ink-600 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-ink-400" />
            </div>
            <p className="text-sm font-semibold text-ink-200 mb-1">No coaches available yet</p>
            <p className="text-xs text-ink-400 leading-relaxed max-w-xs mx-auto">
              Ivy-vetted coaches will appear here as they join. For now, Ivy handles your daily accountability solo.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-400 text-sm">No coaches match your search.</p>
            <button onClick={() => setSearchQuery('')} className="mt-3 text-xs text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="text-2xs text-ink-400 mb-3 uppercase tracking-wider font-medium">
              {filtered.length} coach{filtered.length !== 1 ? 'es' : ''}
            </p>
            <div className="space-y-3">
              {filtered.map((coach) => <CoachCard key={coach.id} coach={coach} />)}
            </div>
          </>
        )}

        {/* ── Bottom note ── */}
        <div className="mt-8 mb-4 text-center">
          <p className="text-2xs text-ink-400 leading-relaxed">
            All coaches pass Ivy&rsquo;s screening. Billing is direct between you and your coach — Ivy facilitates the accountability layer only.
          </p>
        </div>

      </div>
    </div>
  )
}
