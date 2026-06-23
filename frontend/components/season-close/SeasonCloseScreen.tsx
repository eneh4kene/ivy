'use client'

/**
 * SeasonCloseScreen — the end-of-arc review, wired to real data.
 *
 * Data sources:
 *   - seasonsApi.getAll()          → most recent closed (or closing) season:
 *                                    number, title, goal, dates, sprints,
 *                                    arcSummary + nextGoalSuggestions (set on close)
 *   - donationsApi.getImpactWallet → lifetime donated + donation count
 *   - statsApi.getStreak()         → longest streak
 *
 * Per-season stake kept/forfeited, per-sprint completion %, charity-specific
 * attribution and circle collective totals are NOT aggregated server-side, so
 * they are NOT shown (no fabricated figures). When the backend exposes a
 * season-close summary endpoint, this screen can be enriched.
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, Heart, Target, ArrowRight, ChevronDown, Check } from 'lucide-react'
import { seasonsApi, donationsApi, statsApi } from '@/lib/api'
import type { Season } from '@/lib/types'

function CountUp({ target, prefix = '', suffix = '', duration = 1200 }: {
  target: number; prefix?: string; suffix?: string; duration?: number
}) {
  const [value, setValue] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <span className="tabular-nums">{prefix}{value}{suffix}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function SprintRow({ sprint, index }: { sprint: Season['sprints'][number]; index: number }) {
  const done = sprint.status === 'COMPLETED'
  return (
    <div className="py-3 border-b border-ink-700/60 last:border-0" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-ink-200">Sprint {sprint.number}</p>
        <div className="flex items-center gap-1.5">
          <span className={`text-2xs font-medium ${done ? 'text-sage-400' : 'text-ink-400'}`}>
            {done ? 'Completed' : 'Active'}
          </span>
          {done && <Check className="w-3 h-3 text-sage-400" />}
        </div>
      </div>
      <p className="text-2xs text-ink-500 font-mono">
        {fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}
      </p>
    </div>
  )
}

export function SeasonCloseScreen({ seasonId }: { seasonId?: string } = {}) {
  const [season, setSeason] = useState<Season | null>(null)
  const [lifetimeDonated, setLifetimeDonated] = useState(0)
  const [donationCount, setDonationCount] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSprints, setShowSprints] = useState(false)

  useEffect(() => {
    let alive = true
    seasonsApi.getAll()
      .then((seasons) => {
        if (!alive) return
        let target: Season | null = null
        if (seasonId) {
          target = seasons.find((s) => s.id === seasonId) ?? null
        } else {
          // Most recently closed (or closing) season.
          const closed = seasons
            .filter((s) => s.status === 'CLOSED' || s.status === 'CLOSING')
            .sort((a, b) => new Date(b.closedAt ?? b.endDate).getTime() - new Date(a.closedAt ?? a.endDate).getTime())
          target = closed[0] ?? null
        }
        setSeason(target)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    donationsApi.getImpactWallet()
      .then((w) => {
        if (!alive) return
        setLifetimeDonated(Math.round(w.wallet?.lifetimeDonated ?? 0))
        setDonationCount(w.currentMonth?.donationCount ?? 0)
      })
      .catch(() => {})
    statsApi.getStreak()
      .then((s) => { if (alive) setLongestStreak(s.longestStreak ?? 0) })
      .catch(() => {})

    return () => { alive = false }
  }, [seasonId])

  if (loading) {
    return (
      <div className="min-h-dvh mesh-bg flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-gold-400 animate-spin" />
      </div>
    )
  }

  // No closed season yet — honest locked state.
  if (!season) {
    return (
      <div className="min-h-dvh mesh-bg flex flex-col items-center justify-center text-center px-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gold-400/12 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-gold-400" />
        </div>
        <h1 className="font-display text-xl text-ink-50">No season to close yet</h1>
        <p className="text-sm text-ink-400 max-w-xs">
          When you finish a season, this is where you&rsquo;ll see how the whole arc went — your
          follow-through, your impact, and Ivy&rsquo;s read on the chapter.
        </p>
        <Link href="/home">
          <button className="mt-2 px-5 py-3 rounded-2xl surface text-sm text-ink-200 hover:bg-ink-700 transition-colors">
            Back to home
          </button>
        </Link>
      </div>
    )
  }

  const completedSprints = season.sprints.filter((s) => s.status === 'COMPLETED').length

  return (
    <div className="min-h-dvh mesh-bg pb-12">
      <div className="relative overflow-hidden pt-safe-t">
        <div
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.22) 0%, transparent 60%)' }}
        />
        <div className="relative px-4 pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-400/10 border border-gold-400/25 mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-widest">Season close</span>
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-2">Season {season.number}</p>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-50 tracking-tight leading-snug mb-2">
              {season.title || `Season ${season.number}`}
            </h1>
            <p className="text-sm text-ink-400 italic">&ldquo;{season.goal}&rdquo;</p>
          </div>
          <p className="mt-3 text-2xs text-ink-600 font-mono animate-fade-in" style={{ animationDelay: '200ms' }}>
            {fmtDate(season.startDate)} – {fmtDate(season.endDate)}
          </p>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-6">
        {/* ── Sprints completed ── */}
        <div className="surface rounded-2xl p-6 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-2">Sprints completed</p>
          <p className="font-display text-3xl font-semibold text-gold-400">
            {completedSprints}<span className="text-ink-500 text-2xl"> / {season.sprints.length}</span>
          </p>
          {longestStreak > 0 && (
            <p className="text-xs text-ink-400 mt-2">
              Longest streak: <span className="text-ink-200 font-mono">{longestStreak} days</span>
            </p>
          )}
        </div>

        {/* ── Impact (lifetime) ── */}
        {lifetimeDonated > 0 && (
          <div className="glass-sage rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-sage-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-sage-400">Your impact</p>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-display text-3xl font-semibold text-ink-50">
                <CountUp target={lifetimeDonated} prefix="£" />
              </span>
              <span className="text-sm text-ink-400">donated to date</span>
            </div>
            {donationCount > 0 && (
              <p className="text-xs text-ink-400">{donationCount} donation{donationCount !== 1 ? 's' : ''} this month</p>
            )}
          </div>
        )}

        {/* ── Ivy's read (only if generated on close) ── */}
        {season.arcSummary && (
          <div className="glass-gold rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '500ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-gold-400">Ivy&rsquo;s read</p>
            </div>
            <p className="text-sm text-ink-100 leading-relaxed font-display italic">&ldquo;{season.arcSummary}&rdquo;</p>
          </div>
        )}

        {/* ── Sprint breakdown ── */}
        <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <button
            onClick={() => setShowSprints(!showSprints)}
            className="w-full flex items-center justify-between py-3 surface rounded-2xl px-4 hover:bg-ink-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-sage-400" />
              <p className="text-sm font-semibold text-ink-100">Sprint breakdown</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${showSprints ? 'rotate-180' : ''}`} />
          </button>
          {showSprints && (
            <div className="surface rounded-2xl mt-2 px-4 py-2 animate-slide-in-bottom">
              {season.sprints.map((sprint, i) => (
                <SprintRow key={sprint.id} sprint={sprint} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* ── Next season suggestion (only if generated on close) ── */}
        {season.nextGoalSuggestions && (
          <div className="surface rounded-2xl p-5 border border-sage-400/20 animate-fade-in" style={{ animationDelay: '700ms' }}>
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-3">
              Ivy&rsquo;s suggestion for Season {season.number + 1}
            </p>
            <p className="text-sm text-ink-200 leading-relaxed font-display italic">&ldquo;{season.nextGoalSuggestions}&rdquo;</p>
          </div>
        )}

        {/* ── CTA row ── */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '800ms' }}>
          <Link href="/seasons">
            <button className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
              Start Season {season.number + 1}
              <ArrowRight className="inline-block ml-2 w-4 h-4" />
            </button>
          </Link>
          <Link href="/home">
            <button className="w-full py-3.5 rounded-2xl text-sm text-ink-300 surface hover:bg-ink-700 transition-all active:scale-[0.98]">
              Back to home
            </button>
          </Link>
        </div>

        <p className="text-center text-2xs text-ink-700 pb-2 font-display italic">
          Season {season.number} is closed. The arc is complete.
        </p>
      </div>
    </div>
  )
}
