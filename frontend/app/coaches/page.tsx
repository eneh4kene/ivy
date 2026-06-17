'use client'

/**
 * /coaches — Consumer-facing coach marketplace.
 *
 * Browse Ivy-vetted coaches, filter by specialty, see cards with photo/rating/rate.
 * MOCK DATA ONLY — all API shapes are marked with // TODO(api): / // MOCK:
 *
 * Key product facts (§5f of docs/product-pricing-rework.md):
 *   - Coach is an optional add-on, available at any time on any plan
 *   - Ivy takes 0% — coaches bill clients directly
 *   - "Ivy-delivered features are free; humans are paid to the humans."
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Star, Shield, Clock, ChevronRight, Search, SlidersHorizontal, X,
} from 'lucide-react'
import {
  MOCK_MARKETPLACE_COACHES,
  type MarketplaceCoach,
  type Specialty,
} from '@/lib/mock/coach'

// ─── Specialty labels ─────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<Specialty, string> = {
  'strength':  'Strength',
  'fat-loss':  'Fat loss',
  'endurance': 'Endurance',
  'mindset':   'Mindset',
  'nutrition': 'Nutrition',
  'business':  'Business',
  'career':    'Career',
  'wellbeing': 'Wellbeing',
  'sleep':     'Sleep',
}

const ALL_SPECIALTIES = Object.keys(SPECIALTY_LABELS) as Specialty[]

// ─── Star rating display ──────────────────────────────────────────────────────

function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3 h-3 fill-gold-400 text-gold-400" />
      <span className="text-xs font-semibold text-gold-400 tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-2xs text-ink-400">({reviewCount})</span>
    </div>
  )
}

// ─── Coach card ───────────────────────────────────────────────────────────────

function CoachCard({ coach }: { coach: MarketplaceCoach }) {
  return (
    <Link href={`/coaches/${coach.id}`} className="block">
      <div
        className="
          relative rounded-2xl surface overflow-hidden
          hover:border-gold-400/20 active:scale-[0.99]
          transition-all duration-200 cursor-pointer group
          animate-fade-in
        "
        style={{ animationDelay: '0ms' }}
      >
        {/* Availability ribbon */}
        {!coach.available && (
          <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-ink-700 border border-ink-600 text-2xs text-ink-400 font-medium">
            Waitlist
          </div>
        )}
        {coach.available && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage-400/10 border border-sage-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sage-400" />
            <span className="text-2xs text-sage-400 font-medium">Available</span>
          </div>
        )}

        <div className="p-4 flex gap-4">
          {/* Photo */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-700">
              {/* MOCK: photo placeholder from unsplash */}
              <img
                src={coach.photoUrl}
                alt={coach.displayName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {coach.ivyVetted && (
              <div
                className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-900 border border-ink-600 flex items-center justify-center"
                title="Ivy-vetted coach"
              >
                <Shield className="w-2.5 h-2.5 text-gold-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <h3 className="font-display text-base font-semibold text-ink-50 leading-tight">
                {coach.displayName}
              </h3>
              <ChevronRight className="w-4 h-4 text-ink-400 shrink-0 mt-0.5 group-hover:text-gold-400 transition-colors" />
            </div>

            <p className="text-xs text-ink-400 italic mb-2 leading-snug">
              "{coach.tagline}"
            </p>

            <div className="flex items-center gap-3 mb-2.5">
              <StarRating rating={coach.rating} reviewCount={coach.reviewCount} />
              <span className="text-2xs text-ink-400">·</span>
              <span className="text-2xs text-ink-400">{coach.yearsCoaching}yr exp</span>
              <span className="text-2xs text-ink-400">·</span>
              <span className="text-2xs text-ink-400">{coach.activeClients} clients</span>
            </div>

            {/* Specialties */}
            <div className="flex flex-wrap gap-1 mb-3">
              {coach.specialties.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-full bg-ink-700 border border-ink-600 text-2xs text-ink-200 font-medium capitalize"
                >
                  {SPECIALTY_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Rate footer */}
        <div className="px-4 pb-4 pt-0 flex items-center justify-between">
          <div>
            <span className="font-display text-xl font-semibold text-ink-50">
              £{coach.hourlyRate}
            </span>
            <span className="text-xs text-ink-400"> / session</span>
          </div>
          <div className="flex items-center gap-1 text-2xs text-ink-400">
            <Clock className="w-3 h-3" />
            <span>Responds in ~{coach.responseHours}h</span>
          </div>
        </div>

        {/* Subtle hover glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(204,163,72,0.12)' }}
        />
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSpecialty, setActiveSpecialty] = useState<Specialty | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // MOCK: client has no coach yet
  // TODO(api): GET /api/user/coach → check if user has an active coach
  const hasCoach = false

  // MOCK: filter logic on client
  // TODO(api): pass filters to GET /api/coach/marketplace?specialty=strength&q=...
  const filtered = useMemo(() => {
    let list = MOCK_MARKETPLACE_COACHES
    if (activeSpecialty) {
      list = list.filter((c) => c.specialties.includes(activeSpecialty))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.specialties.some((s) => s.includes(q))
      )
    }
    return list
  }, [searchQuery, activeSpecialty])

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
                Each coach is Ivy-vetted, sets their own rate, and bills you directly — Ivy takes 0%.
                Add a coach any time. Cancel any time. No lock-in.
              </p>
            </div>
          </div>
        </div>

        {/* ── Already has a coach ── */}
        {hasCoach && (
          <Link href="/coaches/my-coach" className="block mb-5">
            <div className="rounded-2xl surface border-gold-400/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-gold-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-50">Your coach</p>
                <p className="text-xs text-ink-400">View your active coaching relationship</p>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-400" />
            </div>
          </Link>
        )}

        {/* ── Search ── */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coaches, specialties…"
              className="
                w-full pl-9 pr-4 py-2.5 rounded-xl
                bg-ink-800 border border-ink-600
                text-sm text-ink-50 placeholder:text-ink-400
                focus:outline-none focus:ring-1 focus:ring-gold-400/50 focus:border-gold-400/30
                transition-colors
              "
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors
              ${showFilters || activeSpecialty
                ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                : 'bg-ink-800 border-ink-600 text-ink-400 hover:text-ink-200'}
            `}
            aria-label="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* ── Specialty filter pills ── */}
        {showFilters && (
          <div className="flex flex-wrap gap-1.5 mb-4 animate-fade-in">
            <button
              onClick={() => setActiveSpecialty(null)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${activeSpecialty === null
                  ? 'bg-gold-400 text-ink-900 border-gold-400'
                  : 'bg-ink-800 text-ink-400 border-ink-600 hover:border-ink-400'}
              `}
            >
              All
            </button>
            {ALL_SPECIALTIES.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSpecialty(activeSpecialty === s ? null : s)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${activeSpecialty === s
                    ? 'bg-gold-400 text-ink-900 border-gold-400'
                    : 'bg-ink-800 text-ink-400 border-ink-600 hover:border-ink-400'}
                `}
              >
                {SPECIALTY_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        {/* ── Result count ── */}
        <p className="text-2xs text-ink-400 mb-3 uppercase tracking-wider font-medium">
          {filtered.length} coach{filtered.length !== 1 ? 'es' : ''}{activeSpecialty ? ` · ${SPECIALTY_LABELS[activeSpecialty]}` : ''}
        </p>

        {/* ── Coach cards ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-400 text-sm">No coaches match your search.</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveSpecialty(null) }}
              className="mt-3 text-xs text-gold-400 hover:text-gold-300 underline underline-offset-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        )}

        {/* ── Bottom note ── */}
        <div className="mt-8 mb-4 text-center">
          <p className="text-2xs text-ink-400 leading-relaxed">
            All coaches pass Ivy's basic screening. Billing is direct between you and your coach — Ivy facilitates the accountability layer only.
          </p>
        </div>

      </div>
    </div>
  )
}
