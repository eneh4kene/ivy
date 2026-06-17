'use client'

/**
 * /coaches/[id] — Coach profile view (consumer side).
 *
 * Data source: GET /api/coach/marketplace/:id (real API).
 * Fields not yet in the schema fall back to MOCK_MARKETPLACE_COACHES lookup by id.
 *
 * MOCKED (not in schema, left mocked with clear flag):
 *   - hourlyRate, rating, reviewCount, specialties, credentials, yearsCoaching,
 *     activeClients, responseHours, testimonials, billingNote
 *
 * TODO(api): GET /api/coach/marketplace/:id/reviews (no CoachReview model yet)
 * TODO(api): POST /api/user/coach { coachId } → add-coach flow
 */

import { useState, use, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Star, Shield, Clock, Users, Trophy, Check, ChevronRight, X,
} from 'lucide-react'
import { coachMarketplaceApi, type MarketplaceCoachDetail } from '@/lib/api'
import {
  MOCK_MARKETPLACE_COACHES,
  MOCK_COACH_REVIEWS,
  type MarketplaceCoach,
  type Specialty,
} from '@/lib/mock/coach'

/**
 * Merge real API detail with mock fallback for fields not in the schema.
 */
function mergeDetailWithMock(real: MarketplaceCoachDetail): MarketplaceCoach {
  const mock = MOCK_MARKETPLACE_COACHES.find((m) => m.id === real.id)
  return {
    id: real.id,
    firstName: real.firstName,
    lastName: real.lastName,
    displayName: real.displayName,
    photoUrl: real.photoUrl ?? mock?.photoUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${real.displayName}`,
    tagline: mock?.tagline ?? real.coachingStyle ?? real.programmeName ?? '',
    bio: mock?.bio ?? real.programmeNotes ?? '',
    specialties: real.specialties ?? mock?.specialties ?? [],
    // MOCKED — hourlyRate not in CoachProfile schema yet
    hourlyRate: real.hourlyRate ?? mock?.hourlyRate ?? 0,
    currency: mock?.currency ?? 'GBP',
    // MOCKED — rating / reviewCount require a CoachReview model
    rating: real.rating ?? mock?.rating ?? 0,
    reviewCount: real.reviewCount ?? mock?.reviewCount ?? 0,
    activeClients: mock?.activeClients ?? 0,
    yearsCoaching: mock?.yearsCoaching ?? 0,
    credentials: real.credentials ?? mock?.credentials ?? [],
    ivyVetted: real.ivyVetted,
    available: mock?.available ?? true,
    responseHours: mock?.responseHours ?? 24,
    testimonials: mock?.testimonials ?? [],
    programmes: mock?.programmes ?? (real.programmeName ? [real.programmeName] : []),
    billingNote: mock?.billingNote
      ?? `${real.firstName} bills you directly. Ivy takes 0% — you pay exactly what they charge.`,
  } as MarketplaceCoach
}

// ─── Specialty labels (duplicated locally for self-containment) ───────────────

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

// ─── Star row ─────────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3 h-3 ${
            n <= Math.round(rating) ? 'fill-gold-400 text-gold-400' : 'text-ink-600'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Add-coach bottom sheet ───────────────────────────────────────────────────

function AddCoachSheet({
  coach,
  onClose,
  onConfirm,
}: {
  coach: MarketplaceCoach
  onClose: () => void
  onConfirm: () => void
}) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-ink-800 border-t border-ink-600 rounded-t-3xl p-6 pb-safe-b animate-slide-in-bottom">
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-ink-600 mx-auto mb-6" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-ink-700 shrink-0">
            <img src={coach.photoUrl} alt={coach.displayName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-50">{coach.displayName}</h3>
            <p className="text-xs text-ink-400">{coach.tagline}</p>
          </div>
        </div>

        {/* What happens next */}
        <div className="rounded-xl bg-ink-700/60 border border-ink-600 p-4 mb-5 space-y-3">
          <p className="text-xs font-semibold text-ink-200 uppercase tracking-wider">What happens next</p>
          {[
            { icon: Check, text: `${coach.firstName} can see your Ivy accountability data — streak, programme areas, recent call summaries.` },
            { icon: Clock, text: `${coach.firstName} typically responds within ${coach.responseHours}h of you connecting.` },
            { icon: Trophy, text: `Billing is direct between you and ${coach.firstName}. Ivy takes 0% — you pay exactly their rate.` },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3 h-3 text-gold-400" />
              </div>
              <p className="text-xs text-ink-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Billing note */}
        <div className="rounded-xl bg-sage-400/6 border border-sage-400/15 p-3 mb-5">
          <p className="text-xs text-sage-400 leading-relaxed">
            <span className="font-semibold">Billing note:</span> {coach.billingNote}
          </p>
        </div>

        {/* Consent checkbox */}
        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <div
            onClick={() => setAgreed(!agreed)}
            className={`
              w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center
              transition-colors cursor-pointer
              ${agreed ? 'bg-gold-400 border-gold-400' : 'bg-transparent border-ink-600 hover:border-ink-400'}
            `}
          >
            {agreed && <Check className="w-3 h-3 text-ink-900" />}
          </div>
          <span className="text-xs text-ink-400 leading-relaxed">
            I understand {coach.firstName} will have read access to my Ivy accountability data, and that billing is arranged directly with them outside of Ivy.
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={onConfirm}
          disabled={!agreed}
          className="
            w-full py-4 rounded-2xl font-semibold text-sm
            bg-gold-400 text-ink-900
            hover:bg-gold-300 active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150
          "
        >
          Connect with {coach.firstName}
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 text-xs text-ink-400 hover:text-ink-200 transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function AddCoachSuccess({ coach, onDone }: { coach: MarketplaceCoach; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-900 px-8 text-center animate-fade-in-scale">
      {/* Avatar + check */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full overflow-hidden mx-auto">
          <img src={coach.photoUrl} alt={coach.displayName} className="w-full h-full object-cover" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-sage-400 flex items-center justify-center glow-sm-sage">
          <Check className="w-5 h-5 text-ink-900 font-bold" />
        </div>
      </div>

      <h2 className="font-display text-2xl font-semibold text-ink-50 mb-2">
        You're connected
      </h2>
      <p className="text-sm text-ink-400 leading-relaxed mb-2">
        {coach.firstName} will be notified and can now see your progress in Ivy.
      </p>
      <p className="text-xs text-ink-400 mb-8">
        Reach out to {coach.firstName} directly to arrange your first session and billing.
      </p>

      <button
        onClick={onDone}
        className="px-8 py-4 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm hover:bg-gold-300 transition-colors"
      >
        Back to dashboard
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [showSheet, setShowSheet] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [coach, setCoach] = useState<MarketplaceCoach | null>(
    // Start with mock data if available so the page renders immediately
    MOCK_MARKETPLACE_COACHES.find((c) => c.id === id) ?? null,
  )
  const [notFound, setNotFound] = useState(false)

  // Fetch real coach data from backend; merge with mock for missing fields
  useEffect(() => {
    coachMarketplaceApi.get(id)
      .then((real) => setCoach(mergeDetailWithMock(real)))
      .catch((err: any) => {
        const status = err?.response?.status ?? err?.status
        if (status === 404) {
          // Genuinely not found — if we had mock data, keep it (dev mode);
          // in prod there will be no mock data for real IDs that don't exist.
          if (!coach) setNotFound(true)
        }
        // Other errors: keep mock data (or null) and degrade gracefully
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // MOCK: reviews — no CoachReview model yet
  // TODO(api): GET /api/coach/marketplace/:id/reviews
  const reviews = MOCK_COACH_REVIEWS[id] ?? []

  if (notFound || (!coach && !MOCK_MARKETPLACE_COACHES.find((c) => c.id === id))) {
    return (
      <div className="min-h-dvh mesh-bg flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-ink-400 mb-4">Coach not found.</p>
          <Link href="/coaches" className="text-gold-400 text-sm hover:text-gold-300">← Back to marketplace</Link>
        </div>
      </div>
    )
  }

  if (!coach) {
    // Still loading — render nothing (coach will be set by effect)
    return null
  }

  if (confirmed) {
    return <AddCoachSuccess coach={coach} onDone={() => router.push('/dashboard')} />
  }

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-32">
      <div className="max-w-lg mx-auto">

        {/* ── Sticky nav ── */}
        <div className="sticky top-0 z-20 bg-ink-900/85 backdrop-blur-md border-b border-ink-600/40 px-4 pt-safe-t flex items-center gap-3 py-3">
          <Link href="/coaches">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors" aria-label="Back">
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-50 truncate">{coach.displayName}</p>
            <p className="text-2xs text-ink-400">Optional coach add-on</p>
          </div>
          {coach.available ? (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-sage-400/10 border border-sage-400/20 text-2xs text-sage-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-400" /> Available
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-ink-700 border border-ink-600 text-2xs text-ink-400">Waitlist</span>
          )}
        </div>

        <div className="px-4 pt-6 space-y-5">

          {/* ── Hero ── */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-ink-700">
                <img src={coach.photoUrl} alt={coach.displayName} className="w-full h-full object-cover" />
              </div>
              {coach.ivyVetted && (
                <div
                  className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-ink-900 border border-ink-600 flex items-center justify-center glow-sm-gold"
                  title="Ivy-vetted"
                >
                  <Shield className="w-3.5 h-3.5 text-gold-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-display text-2xl font-semibold text-ink-50 leading-tight mb-1">
                {coach.displayName}
              </h1>
              <p className="text-sm text-ink-400 italic mb-3">"{coach.tagline}"</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <StarRow rating={coach.rating} />
                  <span className="text-xs font-semibold text-gold-400">{coach.rating.toFixed(1)}</span>
                  <span className="text-2xs text-ink-400">({coach.reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Experience', value: `${coach.yearsCoaching}yr` },
              { label: 'Active clients', value: String(coach.activeClients) },
              { label: 'Response', value: `~${coach.responseHours}h` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl surface p-3 text-center">
                <p className="font-display text-lg font-semibold text-ink-50 tabular-nums">{value}</p>
                <p className="text-2xs text-ink-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Specialties ── */}
          <div>
            <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-2">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {coach.specialties.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full bg-periwinkle-500/10 border border-periwinkle-400/20 text-xs text-periwinkle-400 font-medium"
                >
                  {SPECIALTY_LABELS[s]}
                </span>
              ))}
            </div>
          </div>

          {/* ── About ── */}
          <div className="rounded-2xl surface p-5">
            <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">About</p>
            <p className="text-sm text-ink-200 leading-relaxed">{coach.bio}</p>
          </div>

          {/* ── Credentials ── */}
          {coach.credentials.length > 0 && (
            <div className="rounded-2xl surface p-5">
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">Credentials</p>
              <div className="space-y-2">
                {coach.credentials.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />
                    <span className="text-sm text-ink-200">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Programmes ── */}
          {coach.programmes.length > 0 && (
            <div className="rounded-2xl surface p-5">
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">Typical programmes</p>
              <div className="space-y-2">
                {coach.programmes.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    <span className="text-sm text-ink-200">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Testimonials ── */}
          {coach.testimonials.length > 0 && (
            <div>
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">Client stories</p>
              <div className="space-y-3">
                {coach.testimonials.map((t, i) => (
                  <div key={i} className="rounded-2xl glass-gold p-4">
                    <p className="text-sm text-ink-200 leading-relaxed italic mb-3">
                      "{t.quote}"
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-50">{t.author}</span>
                      <span className="text-xs font-semibold text-sage-400 bg-sage-400/10 border border-sage-400/20 px-2 py-0.5 rounded-full">
                        {t.result}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Reviews ── */}
          {reviews.length > 0 && (
            <div>
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">
                Reviews ({reviews.length})
              </p>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl surface p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-50">{r.clientName}</p>
                        <p className="text-2xs text-ink-400">
                          {new Date(r.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <StarRow rating={r.rating} />
                    </div>
                    <p className="text-sm text-ink-400 leading-relaxed">{r.comment}</p>
                    {r.result && (
                      <p className="mt-2 text-xs font-semibold text-sage-400">{r.result}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom spacer for fixed CTA */}
          <div className="h-4" />
        </div>
      </div>

      {/* ── Fixed CTA ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-ink-900/90 backdrop-blur-md border-t border-ink-600/40 px-4 py-4 pb-safe-b">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div>
            <p className="font-display text-xl font-semibold text-ink-50 tabular-nums">
              £{coach.hourlyRate}<span className="text-sm font-normal text-ink-400">/session</span>
            </p>
            <p className="text-2xs text-ink-400">Ivy takes 0%</p>
          </div>
          <button
            onClick={() => setShowSheet(true)}
            disabled={!coach.available}
            className="
              flex-1 py-4 rounded-2xl font-semibold text-sm
              bg-gold-400 text-ink-900
              hover:bg-gold-300 active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150
            "
          >
            {coach.available ? `Add ${coach.firstName} as my coach` : 'Join waitlist'}
          </button>
        </div>
      </div>

      {/* ── Add coach sheet ── */}
      {showSheet && (
        <AddCoachSheet
          coach={coach}
          onClose={() => setShowSheet(false)}
          onConfirm={() => {
            // MOCK: simulate API call
            // TODO(api): POST /api/user/coach { coachId: coach.id }
            setShowSheet(false)
            setConfirmed(true)
          }}
        />
      )}
    </div>
  )
}
