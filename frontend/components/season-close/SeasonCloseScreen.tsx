'use client'

/**
 * SeasonCloseScreen — the ceremonial end-of-arc review.
 *
 * Shows: arc summary, charity impact, stake stats, sprint breakdown,
 * AI reflection, next season suggestion.
 *
 * MOCK DATA ONLY — all API wiring points marked // TODO(api):
 * §8 of docs/product-pricing-rework.md (Season Close, Impact Stories).
 */

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, Heart, Shield, Flame, Target, Users, ArrowRight,
  ChevronDown, Check,
} from 'lucide-react'
import { MOCK_SEASON_CLOSE, type SprintSummary, type SeasonCloseData } from '@/lib/mock/season-close'
import { seasonsApi } from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sym(currency: string) {
  return currency === 'GBP' ? '£' : '$'
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

// ─── Animated counter (mounts once, counts up) ────────────────────────────────

function CountUp({ target, prefix = '', suffix = '', duration = 1200 }: {
  target: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return (
    <span className="tabular-nums">
      {prefix}{value}{suffix}
    </span>
  )
}

// ─── Sprint row ───────────────────────────────────────────────────────────────

function SprintRow({ sprint, index }: { sprint: SprintSummary; index: number }) {
  const completionPct = pct(sprint.completedDays, sprint.totalDays)
  const s = sym('GBP')

  return (
    <div
      className="py-3 border-b border-ink-700/60 last:border-0"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-ink-200">Sprint {sprint.number}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-mono text-ink-400">{completionPct}%</span>
          {completionPct >= 85 && <Check className="w-3 h-3 text-sage-400" />}
        </div>
      </div>
      <p className="text-xs text-ink-600 italic mb-2">"{sprint.pledge}"</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              completionPct >= 85 ? 'bg-sage-400' : completionPct >= 60 ? 'bg-gold-400' : 'bg-ember-400'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <span className="text-2xs text-ink-600 font-mono shrink-0">
          {sprint.completedDays}/{sprint.totalDays}d
        </span>
      </div>
      {sprint.forfeited > 0 && (
        <p className="text-2xs text-ember-400/70 mt-1 font-mono">
          {sprint.forfeited} day{sprint.forfeited !== 1 ? 's' : ''} forfeited · {s}{sprint.stakeAmount} stake
        </p>
      )}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  value,
  prefix = '',
  suffix = '',
  label,
  color = 'text-ink-50',
  sub,
}: {
  value: number
  prefix?: string
  suffix?: string
  label: string
  color?: string
  sub?: string
}) {
  return (
    <div className="surface rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">{label}</p>
      <p className={`font-display text-2xl font-semibold ${color} tabular-nums leading-none`}>
        <CountUp target={value} prefix={prefix} suffix={suffix} />
      </p>
      {sub && <p className="text-2xs text-ink-600">{sub}</p>}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function SeasonCloseScreen({ seasonId }: { seasonId?: string } = {}) {
  const [data, setData] = useState<SeasonCloseData>(MOCK_SEASON_CLOSE)
  const [showSprints, setShowSprints] = useState(false)

  useEffect(() => {
    // Attempt to fetch real season close data.
    // The /api/seasons/:id/close endpoint is a POST (not GET), and there's no
    // dedicated GET for the close summary yet — leave on MOCK_SEASON_CLOSE for now.
    // When the season-close summary endpoint lands, wire it here.
    // TODO: wire to real season close summary endpoint when available
  }, [seasonId])

  const s = sym(data.currency)

  return (
    <div className="min-h-dvh mesh-bg pb-12">
      {/* Hero / ceremony header */}
      <div className="relative overflow-hidden pt-safe-t">
        {/* Glow orbs */}
        <div
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.22) 0%, transparent 60%)' }}
        />
        <div
          className="pointer-events-none absolute top-32 -right-16 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.18) 0%, transparent 70%)' }}
        />

        <div className="relative px-4 pt-12 pb-8 text-center">
          {/* Season close badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold-400/10 border border-gold-400/25 mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-widest">Season close</span>
          </div>

          {/* Season title */}
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-2">
              Season {data.seasonNumber}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl text-ink-50 tracking-tight leading-snug mb-2">
              {data.seasonTitle}
            </h1>
            <p className="text-sm text-ink-400 italic">
              "{data.seasonGoal}"
            </p>
          </div>

          {/* Date range */}
          <p className="mt-3 text-2xs text-ink-600 font-mono animate-fade-in" style={{ animationDelay: '200ms' }}>
            {data.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            {' – '}
            {data.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-6">
        {/* ── Follow-through score ─────────────────────────────────────────────── */}
        <div
          className="relative rounded-3xl border border-gold-400/25 bg-ink-800 overflow-hidden glow-gold animate-fade-in"
          style={{ animationDelay: '300ms' }}
        >
          <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
          <div className="p-6 text-center">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-3">Follow-through</p>
            <div className="relative w-28 h-28 mx-auto mb-4">
              {/* Circular progress */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--ink-700))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="hsl(var(--gold-400))" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - data.followThroughPct / 100)}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-semibold text-gold-400 tabular-nums">
                  {data.followThroughPct}%
                </span>
              </div>
            </div>
            <p className="text-sm text-ink-200">
              {data.totalDaysCompleted} of {data.totalDaysArmed} days completed
            </p>
            <p className="text-xs text-ink-400 mt-1">
              Longest streak: <span className="text-ink-200 font-mono">{data.longestStreak} days</span>
            </p>
          </div>
        </div>

        {/* ── Stake financials ─────────────────────────────────────────────────── */}
        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-3">Your stake</p>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              value={data.totalStakeKept}
              prefix={s}
              label="Kept"
              color="text-sage-400"
              sub="returned to you"
            />
            <StatTile
              value={data.totalStakeForfeited}
              prefix={s}
              label="Forfeited"
              color="text-ember-400"
              sub={`to ${data.totalStakeForfeited > 0 ? 'house charity' : 'nobody — clean run'}`}
            />
          </div>
        </div>

        {/* ── Charity impact ────────────────────────────────────────────────────── */}
        <div
          className="glass-sage rounded-2xl p-5 animate-fade-in"
          style={{ animationDelay: '500ms' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-ink-900"
              style={{ background: `hsl(${data.charityLogoHue}, 38%, 42%)` }}
            >
              {data.charityLogoInitials}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sage-400">Charity impact</p>
              <p className="text-sm font-semibold text-ink-100">{data.charityName}</p>
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-display text-3xl font-semibold text-ink-50">
              <CountUp target={data.totalDonated} prefix={s} />
            </span>
            <span className="text-sm text-ink-400">donated this season</span>
          </div>
          <p className="text-xs text-ink-400">
            {data.donationCount} successful days · each one funded a donation
          </p>

          {/* Circle collective */}
          <div className="mt-4 pt-4 border-t border-sage-400/20 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-periwinkle-400" />
            <p className="text-xs text-ink-400">
              <span className="text-periwinkle-400 font-semibold">{data.circleName}</span>
              {' '}collectively donated{' '}
              <span className="text-ink-200 font-semibold font-mono">{s}{data.circleCollectiveTotal}</span>
              {' '}this season
            </p>
          </div>
        </div>

        {/* ── Arc summary (AI-generated) ────────────────────────────────────────── */}
        <div
          className="glass-gold rounded-2xl p-5 animate-fade-in"
          style={{ animationDelay: '600ms' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400">Ivy's read</p>
          </div>
          <p className="text-sm text-ink-100 leading-relaxed font-display italic">
            "{data.arcSummary}"
          </p>
        </div>

        {/* ── Sprint breakdown ──────────────────────────────────────────────────── */}
        <div className="animate-fade-in" style={{ animationDelay: '700ms' }}>
          <button
            onClick={() => setShowSprints(!showSprints)}
            className="w-full flex items-center justify-between py-3 surface rounded-2xl px-4 hover:bg-ink-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-sage-400" />
              <p className="text-sm font-semibold text-ink-100">Sprint breakdown</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${showSprints ? 'rotate-180' : ''}`}
            />
          </button>

          {showSprints && (
            <div className="surface rounded-2xl mt-2 px-4 py-2 animate-slide-in-bottom">
              {data.sprints.map((sprint, i) => (
                <SprintRow key={sprint.number} sprint={sprint} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* ── Next season suggestion ────────────────────────────────────────────── */}
        <div
          className="surface rounded-2xl p-5 border border-sage-400/20 animate-fade-in"
          style={{ animationDelay: '800ms' }}
        >
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-3">
            Ivy's suggestion for Season {data.seasonNumber + 1}
          </p>
          <p className="text-sm text-ink-200 leading-relaxed font-display italic">
            "{data.nextSeasonSuggestion}"
          </p>
        </div>

        {/* ── CTA row ────────────────────────────────────────────────────────────── */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '900ms' }}>
          <Link href="/seasons">
            <button className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
              Start Season {data.seasonNumber + 1}
              <ArrowRight className="inline-block ml-2 w-4 h-4" />
            </button>
          </Link>
          <Link href="/home">
            <button className="w-full py-3.5 rounded-2xl text-sm text-ink-300 surface hover:bg-ink-700 transition-all active:scale-[0.98]">
              Back to home
            </button>
          </Link>
        </div>

        {/* Ceremonial bottom note */}
        <p className="text-center text-2xs text-ink-700 pb-2 font-display italic">
          Season {data.seasonNumber} is closed. The arc is complete.
        </p>
      </div>
    </div>
  )
}
