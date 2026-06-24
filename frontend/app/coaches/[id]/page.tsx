'use client'

/**
 * /coaches/[id] — Coach profile view (consumer side).
 *
 * Data source: GET /api/coach/marketplace/:id (real API → MarketplaceCoachDetail).
 *
 * Only real fields are shown: displayName, photo, coachingStyle, programmeName,
 * programmeNotes, ivyVetted. Ratings/reviews/rate/specialties/credentials are
 * NOT in the schema, so they are not displayed (no fabricated figures).
 *
 * There is no client→coach "connect" endpoint — coaches onboard clients via
 * their own invite link. The CTA reflects that real mechanism instead of
 * simulating a connection.
 */

import { useState, use, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, Link2 } from 'lucide-react'
import { coachMarketplaceApi, type MarketplaceCoachDetail } from '@/lib/api'

const AVATAR_HUES = [14, 44, 152, 238, 280, 320]
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_HUES[h % AVATAR_HUES.length]
}

function Avatar({ name, photoUrl, size }: { name: string; photoUrl: string | null; size: number }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-ink-700 flex items-center justify-center" style={{ width: size, height: size }}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center font-semibold text-ink-900"
          style={{ background: `hsl(${hueFor(name)}, 52%, 56%)`, fontSize: size / 2.5 }}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  )
}

export default function CoachProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [coach, setCoach] = useState<MarketplaceCoachDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    coachMarketplaceApi.get(id)
      .then((real) => { if (alive) setCoach(real) })
      .catch(() => { if (alive) setNotFound(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  if (loading) {
    return (
      <div className="theme-arcade min-h-dvh mesh-bg flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-gold-400 animate-spin" />
      </div>
    )
  }

  if (notFound || !coach) {
    return (
      <div className="theme-arcade min-h-dvh mesh-bg flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-ink-400 mb-4">Coach not found.</p>
          <Link href="/coaches" className="text-gold-400 text-sm hover:text-gold-300">← Back to marketplace</Link>
        </div>
      </div>
    )
  }

  const name = coach.displayName || `${coach.firstName} ${coach.lastName}`.trim()
  const tagline = coach.coachingStyle || coach.programmeName || ''
  const about = coach.programmeNotes || ''

  return (
    <div className="theme-arcade min-h-dvh mesh-bg-subtle pb-32">
      <div className="max-w-lg mx-auto">

        {/* ── Sticky nav ── */}
        <div className="sticky top-0 z-20 bg-ink-900/85 backdrop-blur-md border-b border-ink-600/40 px-4 pt-safe-t flex items-center gap-3 py-3">
          <Link href="/coaches">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors" aria-label="Back">
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-50 truncate">{name}</p>
            <p className="text-2xs text-ink-400">Optional coach add-on</p>
          </div>
        </div>

        <div className="px-4 pt-6 space-y-5">

          {/* ── Hero ── */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar name={name} photoUrl={coach.photoUrl} size={80} />
              {coach.ivyVetted && (
                <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-ink-900 border border-ink-600 flex items-center justify-center glow-sm-gold" title="Ivy-vetted">
                  <Shield className="w-3.5 h-3.5 text-gold-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-display text-2xl font-semibold text-ink-50 leading-tight mb-1">{name}</h1>
              {tagline && <p className="text-sm text-ink-400 italic mb-2">&ldquo;{tagline}&rdquo;</p>}
              {coach.ivyVetted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-400/10 border border-gold-400/20 text-2xs text-gold-400 font-medium">
                  <Shield className="w-2.5 h-2.5" /> Ivy-vetted
                </span>
              )}
            </div>
          </div>

          {/* ── Programme ── */}
          {coach.programmeName && (
            <div className="rounded-2xl surface p-5">
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-2">Programme</p>
              <p className="text-sm font-semibold text-ink-100">{coach.programmeName}</p>
            </div>
          )}

          {/* ── About ── */}
          {about && (
            <div className="rounded-2xl surface p-5">
              <p className="text-2xs text-ink-400 uppercase tracking-wider font-medium mb-3">About</p>
              <p className="text-sm text-ink-200 leading-relaxed whitespace-pre-line">{about}</p>
            </div>
          )}

          {/* ── How to work together (real mechanism) ── */}
          <div className="rounded-2xl glass-gold p-5">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-gold-400" />
              <p className="text-xs font-semibold text-ink-100 uppercase tracking-wider">Work with {coach.firstName}</p>
            </div>
            <p className="text-sm text-ink-300 leading-relaxed">
              {coach.firstName} onboards clients through their own Ivy invite link. Reach out to them
              directly for the link — once you join their programme, {coach.firstName} can see your Ivy
              accountability data and bills you directly. Ivy takes 0%.
            </p>
          </div>

          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
