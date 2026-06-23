'use client'

/**
 * HomeScreen — the daily hub / home dashboard.
 *
 * Shows: today's arming/stake status, streak, week dots, Circle snapshot,
 * charity impact-to-date, current Season/Sprint progress.
 *
 * MOCK DATA ONLY — all API wiring points marked // TODO(api):
 * §2, §4a, §5b of docs/product-pricing-rework.md.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flame, Users, Target, Heart, ArrowRight, Shield, ChevronRight, Mic } from 'lucide-react'
import { useStakeGate } from '@/hooks/useStakeGate'
import { StakeReNudge } from '@/components/stake-setup/StakeReNudge'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import {
  MOCK_DASHBOARD_STAKE,
  MOCK_WEEK_DAYS,
  MOCK_STREAK,
  MOCK_SEASON,
  MOCK_DASHBOARD_CIRCLE,
  MOCK_IMPACT,
  MOCK_DASHBOARD_USER,
  type DayStatus,
  type WeekDay,
} from '@/lib/mock/dashboard'
import { statsApi, seasonsApi, circlesApi, donationsApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

// ─── Tokens / helpers ─────────────────────────────────────────────────────────

function sym(currency: string) {
  return currency === 'GBP' ? '£' : '$'
}

// ─── Day dot ──────────────────────────────────────────────────────────────────

const DAY_META: Record<DayStatus, { bg: string; ring: string; label: string }> = {
  armed:    { bg: 'bg-gold-400',       ring: 'ring-gold-400/30 pulse-gold',    label: 'Armed' },
  complete: { bg: 'bg-sage-400',       ring: '',                                label: 'Done' },
  forfeited:{ bg: 'bg-ember-500',      ring: '',                                label: 'Forfeited' },
  grace:    { bg: 'bg-ink-600',        ring: 'ring-gold-400/20',               label: 'Grace' },
  upcoming: { bg: 'bg-ink-700',        ring: '',                                label: '—' },
}

function WeekDot({ day }: { day: WeekDay }) {
  const meta = DAY_META[day.status]
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full ${meta.bg} ${day.isToday ? `ring-2 ${meta.ring}` : ''} transition-all`}
      />
      <span className={`text-2xs font-medium ${day.isToday ? 'text-ink-50' : 'text-ink-600'}`}>
        {day.label}
      </span>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ label, href }: { label: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">{label}</p>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-2xs text-ink-400 hover:text-ink-200 transition-colors">
          View <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Today's stake status card ────────────────────────────────────────────────

function TodayStakeCard() {
  const stake = MOCK_DASHBOARD_STAKE
  const s = sym(stake.currency)
  const isArmed = MOCK_DASHBOARD_USER.isArmedToday

  return (
    <Link href="/daily">
      <div
        className={`relative rounded-2xl p-4 overflow-hidden border transition-all active:scale-[0.99] ${
          isArmed
            ? 'border-gold-400/30 bg-gold-400/05 glow-sm-gold'
            : 'border-ember-400/30 bg-ember-400/04 glow-ember'
        }`}
      >
        {/* Subtle glow blob */}
        <div
          className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
          style={{
            background: isArmed
              ? 'radial-gradient(circle, rgba(204,163,72,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(210,90,46,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex items-start gap-3">
          {/* Status icon */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isArmed ? 'bg-gold-400/12' : 'bg-ember-400/12'
            }`}
          >
            {isArmed ? (
              <Shield className={`w-5 h-5 text-gold-400`} />
            ) : (
              <Mic className="w-5 h-5 text-ember-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isArmed ? 'text-gold-300' : 'text-ember-400'}`}>
              {isArmed ? 'Armed for today' : 'Not armed yet'}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              {isArmed
                ? `${s}${stake.dailySlice} protected · evening review at 6 pm`
                : `Arm by 9:30 am or today's ${s}${stake.dailySlice} goes to ${stake.forfeitDestination}`}
            </p>
          </div>

          <ArrowRight className={`w-4 h-4 shrink-0 mt-0.5 ${isArmed ? 'text-gold-400' : 'text-ember-400'}`} />
        </div>

        {/* Cycle bar */}
        <div className="relative mt-3.5 pt-3.5 border-t border-ink-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-ink-400">Week cycle</span>
            <span className="text-ink-400 font-mono tabular-nums">
              {stake.daysCompleted}/{stake.daysArmed + stake.daysCompleted + (7 - stake.daysCompleted - stake.daysArmed - stake.daysForfeited)} days done
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden flex gap-0.5">
            {[...Array(7)].map((_, i) => {
              const done = i < stake.daysCompleted
              const armed = i === stake.daysCompleted && isArmed
              const forfeited = i < stake.daysForfeited
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all ${
                    forfeited ? 'bg-ember-500' :
                    done ? 'bg-sage-400' :
                    armed ? 'bg-gold-400 pulse-gold' :
                    'bg-ink-700'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xs text-ink-600 font-mono">{s}{stake.amountSafe} safe</span>
            <span className="text-2xs text-ink-600 font-mono">{s}{stake.amountAtRisk} at risk</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Streak + week dots ───────────────────────────────────────────────────────

function StreakWeekCard({ streak }: { streak: typeof MOCK_STREAK }) {
  return (
    <div className="surface rounded-2xl p-4">
      {/* Streak */}
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-ember-400" />
        <p className="text-sm font-semibold text-ink-50 tabular-nums">
          {streak.current}-day streak
        </p>
        <span className="ml-auto text-2xs text-ink-600 font-mono">best: {streak.longest}d</span>
      </div>

      {/* Week dots */}
      <div className="flex items-center justify-between">
        {MOCK_WEEK_DAYS.map((day) => (
          <WeekDot key={day.label} day={day} />
        ))}
      </div>

      {/* Grace */}
      {streak.graceRemaining > 0 && (
        <div className="mt-3 flex items-center gap-1.5 pt-3 border-t border-ink-700">
          <Shield className="w-3 h-3 text-ink-400" />
          <span className="text-2xs text-ink-400">
            {streak.graceRemaining} grace skip remaining this week
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Circle snapshot ──────────────────────────────────────────────────────────

function CircleCard() {
  const circle = MOCK_DASHBOARD_CIRCLE
  const armedPct = Math.round((circle.membersActive / circle.membersTotal) * 100)

  return (
    <Link href="/circles">
      <div className="surface rounded-2xl p-4 hover:border-periwinkle-400/25 transition-colors active:scale-[0.99]">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-periwinkle-400" />
          <p className="text-sm font-semibold text-ink-50">{circle.name}</p>
          <span className="w-1.5 h-1.5 rounded-full bg-sage-400 pulse-sage ml-auto" />
        </div>

        <p className="text-xs text-ink-400 mb-3">{circle.gameLabel}</p>

        {/* Members armed progress */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-periwinkle-400 transition-all duration-700"
              style={{ width: `${armedPct}%` }}
            />
          </div>
          <span className="text-2xs text-ink-400 font-mono">
            {circle.membersActive}/{circle.membersTotal} armed
          </span>
        </div>

        <p className="text-2xs text-ink-600">
          {circle.circleDaysArmedThisWeek} collective days armed this week
        </p>

        {circle.userHoldsBaton && (
          <div className="mt-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-periwinkle-400/10 border border-periwinkle-400/20">
            <span className="text-xs">🏃</span>
            <p className="text-xs font-semibold text-periwinkle-400">You hold the baton</p>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Season / sprint progress ─────────────────────────────────────────────────

function SeasonCard() {
  const season = MOCK_SEASON

  return (
    <Link href="/seasons">
      <div className="surface rounded-2xl p-4 hover:border-sage-400/25 transition-colors active:scale-[0.99]">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-sage-400" />
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">
            Season {season.seasonNumber} · {season.sprintLabel}
          </p>
        </div>

        <p className="font-display text-base text-ink-100 italic leading-snug mb-3">
          "{season.goal}"
        </p>

        {/* Sprint progress */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-2xs text-ink-600 mb-1.5">
            <span className="font-mono">Sprint {season.sprintNumber}</span>
            <span className="font-mono">{season.sprintProgressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-sage-400 transition-all duration-700"
              style={{ width: `${season.sprintProgressPct}%` }}
            />
          </div>
        </div>

        {/* Season arc */}
        <div className="flex items-center justify-between text-2xs text-ink-600 mb-1.5">
          <span className="font-mono">Season arc</span>
          <span className="font-mono">{season.seasonProgressPct}%</span>
        </div>
        <div className="h-1 rounded-full bg-ink-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-sage-300/50 transition-all duration-700"
            style={{ width: `${season.seasonProgressPct}%` }}
          />
        </div>

        <p className="text-2xs text-ink-600 mt-2">
          {season.daysLeftInSprint} days left in this sprint
        </p>
      </div>
    </Link>
  )
}

// ─── Charity impact card ──────────────────────────────────────────────────────

function ImpactCard() {
  const impact = MOCK_IMPACT
  const s = sym(impact.currency)

  return (
    <Link href="/donations">
      <div className="surface rounded-2xl p-4 hover:border-gold-400/20 transition-colors active:scale-[0.99]">
        <div className="flex items-start gap-3">
          {/* Charity avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-ink-900"
            style={{ background: `hsl(${152}, 38%, 42%)` }}
          >
            {impact.charityLogoInitials}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-1">
              Lifetime impact
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-semibold text-ink-50 tabular-nums">
                {s}{impact.lifetimeDonated}
              </span>
              <span className="text-xs text-ink-400">donated</span>
            </div>
            <p className="text-xs text-ink-400 mt-0.5 truncate">
              {impact.charityName} · {impact.donationCount} donations
            </p>
          </div>

          <Heart className="w-4 h-4 text-gold-400 shrink-0 mt-1" />
        </div>
      </div>
    </Link>
  )
}

// ─── Quick action row ─────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'Record VN', icon: Mic, href: '/daily?action=record', color: 'text-gold-400', bg: 'bg-gold-400/10' },
    { label: 'Circles', icon: Users, href: '/circles', color: 'text-periwinkle-400', bg: 'bg-periwinkle-400/10' },
    { label: 'Season', icon: Target, href: '/seasons', color: 'text-sage-400', bg: 'bg-sage-400/10' },
    { label: 'Impact', icon: Heart, href: '/donations', color: 'text-ember-400', bg: 'bg-ember-400/10' },
  ]

  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((a) => (
        <Link key={a.label} href={a.href}>
          <div className="flex flex-col items-center gap-1.5 py-3 rounded-2xl surface hover:bg-ink-700/60 transition-colors active:scale-[0.97]">
            <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center`}>
              <a.icon className={`w-4 h-4 ${a.color}`} />
            </div>
            <span className="text-2xs text-ink-400 font-medium">{a.label}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { user: authUser } = useAuthStore()
  const { showNudge: showStakeNudge, currency: gateCurrency } = useStakeGate()
  const [streak, setStreak] = useState(MOCK_STREAK)

  useEffect(() => {
    statsApi.getStreak().then((s) => {
      setStreak({
        current:        s.currentStreak ?? 0,
        longest:        s.longestStreak ?? 0,
        graceRemaining: s.graceDays?.balance ?? 0,
      })
    }).catch(() => {})
  }, [])

  const user = authUser
    ? { firstName: authUser.firstName, isArmedToday: false }
    : MOCK_DASHBOARD_USER

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink-900/80 backdrop-blur-xl border-b border-ink-700/60 safe-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-display text-xl text-ink-50 tracking-tight leading-snug">
              Morning, {user.firstName}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-ember-400" />
            <span className="font-mono text-sm font-medium text-ink-200 tabular-nums">
              {streak.current}
            </span>
            <span className="text-2xs text-ink-600">days</span>
          </div>
        </div>
      </div>

      {/* Scroll content */}
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Deferred stake re-nudge */}
        {showStakeNudge && <StakeReNudge currency={gateCurrency} />}

        {/* Today's primary CTA */}
        <TodayStakeCard />

        {/* Streak / week dots */}
        <StreakWeekCard streak={streak} />

        {/* Quick actions */}
        <SectionHead label="Go to" />
        <QuickActions />

        {/* Circle */}
        <SectionHead label="Your circle" href="/circles" />
        <CircleCard />

        {/* Season */}
        <SectionHead label="Season arc" href="/seasons" />
        <SeasonCard />

        {/* Impact */}
        <SectionHead label="Your impact" href="/donations" />
        <ImpactCard />

        {/* Bottom whisper */}
        <p className="text-center text-2xs text-ink-700 pb-2">
          Ivy · {new Date().getFullYear()} · Your commitment. Your money. Their future.
        </p>
      </div>

      {/* Install-to-Home-Screen nudge (self-hides when installed/dismissed) */}
      <InstallPrompt />
    </div>
  )
}
