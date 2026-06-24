'use client'

/**
 * HomeScreen — the daily hub / home dashboard.
 *
 * Shows: today's arming/stake status, streak, week dots, Circle snapshot,
 * charity impact-to-date, current Season/Sprint progress.
 *
 * Fully wired to real APIs. New users (no stake config, no cycle, no circle,
 * no season, zero impact) get honest empty/pre-cycle states — never mock data.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flame, Users, Target, Heart, ArrowRight, Shield, ChevronRight, Mic, Settings } from 'lucide-react'
import { useStakeGate } from '@/hooks/useStakeGate'
import { StakeReNudge } from '@/components/stake-setup/StakeReNudge'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import {
  stakeApi,
  statsApi,
  seasonsApi,
  circlesApi,
  donationsApi,
  type StakeState,
  type StakeDayStatus,
} from '@/lib/api'
import type { Season, Sprint, ImpactWallet } from '@/lib/types'
import { useAuthStore } from '@/lib/store/auth.store'

// ─── Tokens / helpers ─────────────────────────────────────────────────────────

function sym(currency: string) {
  return currency === 'GBP' ? '£' : '$'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

// ─── Day dot ──────────────────────────────────────────────────────────────────

const DAY_META: Record<StakeDayStatus, { bg: string; ring: string }> = {
  armed:    { bg: 'bg-gold-400',  ring: 'ring-gold-400/30 pulse-gold' },
  complete: { bg: 'bg-sage-400',  ring: '' },
  forfeited:{ bg: 'bg-ember-500', ring: '' },
  grace:    { bg: 'bg-ink-600',   ring: 'ring-gold-400/20' },
  upcoming: { bg: 'bg-ink-700',   ring: '' },
}

function WeekDot({ day }: { day: StakeState['week'][number] }) {
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

function TodayStakeCard({ state }: { state: StakeState }) {
  const { config, cycle, today } = state
  const s = sym(cycle?.currency ?? config.currency)

  // No stake configured yet → drive the user to set it up.
  if (!config.hasConfig) {
    return (
      <Link href="/stake-setup">
        <div className="relative rounded-2xl p-4 overflow-hidden border border-gold-400/30 bg-gold-400/05 glow-sm-gold active:scale-[0.99] transition-all">
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold-400/12">
              <Shield className="w-5 h-5 text-gold-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gold-300">Set up your stake</p>
              <p className="text-xs text-ink-400 mt-0.5">
                Put money on the line so your commitment has teeth. Takes a minute.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-gold-400" />
          </div>
        </div>
      </Link>
    )
  }

  // Stake configured but no active weekly cycle yet (cycles open Monday).
  if (!cycle) {
    return (
      <Link href="/stake-setup">
        <div className="relative rounded-2xl p-4 overflow-hidden border border-ink-700/60 surface active:scale-[0.99] transition-all">
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-ink-700/60">
              <Shield className="w-5 h-5 text-ink-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-100">Stake ready · cycle starts Monday</p>
              <p className="text-xs text-ink-400 mt-0.5">
                {config.weeklyAmount != null
                  ? `${s}${config.weeklyAmount}/week on the line once your cycle opens.`
                  : 'Your weekly cycle opens Monday morning.'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-ink-500" />
          </div>
        </div>
      </Link>
    )
  }

  const isArmed = today.isArmed
  const daysDecided = cycle.daysCompleted + cycle.daysForfeited

  return (
    <Link href="/daily">
      <div
        className={`relative rounded-2xl p-4 overflow-hidden border transition-all active:scale-[0.99] ${
          isArmed
            ? 'border-gold-400/30 bg-gold-400/05 glow-sm-gold'
            : 'border-ember-400/30 bg-ember-400/04 glow-ember'
        }`}
      >
        <div
          className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
          style={{
            background: isArmed
              ? 'radial-gradient(circle, rgba(204,163,72,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(210,90,46,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isArmed ? 'bg-gold-400/12' : 'bg-ember-400/12'
            }`}
          >
            {isArmed ? <Shield className="w-5 h-5 text-gold-400" /> : <Mic className="w-5 h-5 text-ember-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isArmed ? 'text-gold-300' : 'text-ember-400'}`}>
              {isArmed ? 'Armed for today' : 'Not armed yet'}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              {isArmed
                ? `${s}${cycle.dailySlice} protected today`
                : `Record your voice note${today.armingWindowEnd ? ` by ${today.armingWindowEnd}` : ''} or today's ${s}${cycle.dailySlice} goes${config.forfeitDestination ? ` to ${config.forfeitDestination}` : ' to charity'}`}
            </p>
          </div>

          <ArrowRight className={`w-4 h-4 shrink-0 mt-0.5 ${isArmed ? 'text-gold-400' : 'text-ember-400'}`} />
        </div>

        {/* Cycle bar */}
        <div className="relative mt-3.5 pt-3.5 border-t border-ink-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-ink-400">{cycle.isFoundation ? 'Your first run' : 'Week cycle'}</span>
            <span className="text-ink-400 font-mono tabular-nums">{cycle.daysCompleted}/{cycle.daysInCycle} days done</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden flex gap-0.5">
            {[...Array(cycle.daysInCycle)].map((_, i) => {
              const forfeited = i < cycle.daysForfeited
              const done = !forfeited && i < daysDecided
              const armed = i === daysDecided && isArmed
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all ${
                    forfeited ? 'bg-ember-500' : done ? 'bg-sage-400' : armed ? 'bg-gold-400 pulse-gold' : 'bg-ink-700'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xs text-ink-600 font-mono">{s}{cycle.amountSafe} safe</span>
            <span className="text-2xs text-ink-600 font-mono">{s}{cycle.amountAtRisk} at risk</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Streak + week dots ───────────────────────────────────────────────────────

interface StreakView { current: number; longest: number; graceRemaining: number }

function StreakWeekCard({ streak, week }: { streak: StreakView; week: StakeState['week'] }) {
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-ember-400" />
        <p className="text-sm font-semibold text-ink-50 tabular-nums">
          {streak.current}-day streak
        </p>
        <span className="ml-auto text-2xs text-ink-600 font-mono">best: {streak.longest}d</span>
      </div>

      <div className="flex items-center justify-between">
        {week.map((day) => (
          <WeekDot key={day.label} day={day} />
        ))}
      </div>

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

type MyCircle = Awaited<ReturnType<typeof circlesApi.getMy>>[number]

function CircleCard({ circle }: { circle: MyCircle }) {
  const total = circle.maxSize || circle.size || circle.members.length
  const activePct = total > 0 ? Math.round((circle.size / total) * 100) : 0

  return (
    <Link href="/circles">
      <div className="surface rounded-2xl p-4 hover:border-periwinkle-400/25 transition-colors active:scale-[0.99]">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-periwinkle-400" />
          <p className="text-sm font-semibold text-ink-50">{circle.name}</p>
          {circle.isActive && <span className="w-1.5 h-1.5 rounded-full bg-sage-400 pulse-sage ml-auto" />}
        </div>

        {circle.seasonTheme && <p className="text-xs text-ink-400 mb-3">{circle.seasonTheme}</p>}

        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-periwinkle-400 transition-all duration-700"
              style={{ width: `${activePct}%` }}
            />
          </div>
          <span className="text-2xs text-ink-400 font-mono">
            {circle.size}/{total} members
          </span>
        </div>
      </div>
    </Link>
  )
}

function JoinCircleCard() {
  return (
    <Link href="/circles">
      <div className="surface rounded-2xl p-4 hover:border-periwinkle-400/25 transition-colors active:scale-[0.99]">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-periwinkle-400" />
          <p className="text-sm font-semibold text-ink-50">Join a circle</p>
        </div>
        <p className="text-xs text-ink-400">
          Stake alongside a small group. Accountability hits harder together.
        </p>
      </div>
    </Link>
  )
}

// ─── Season / sprint progress ─────────────────────────────────────────────────

function pct(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const now = Date.now()
  if (e <= s) return 0
  return Math.max(0, Math.min(100, Math.round(((now - s) / (e - s)) * 100)))
}

function daysLeft(end: string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

function SeasonCard({ season, sprint }: { season: Season; sprint: Sprint | null }) {
  const seasonProgressPct = pct(season.startDate, season.endDate)
  const sprintProgressPct = sprint ? pct(sprint.startDate, sprint.endDate) : 0

  return (
    <Link href="/seasons">
      <div className="surface rounded-2xl p-4 hover:border-sage-400/25 transition-colors active:scale-[0.99]">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-sage-400" />
          <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">
            Season {season.number}{sprint ? ` · Sprint ${sprint.number}` : ''}
          </p>
        </div>

        <p className="font-display text-base text-ink-100 italic leading-snug mb-3">
          "{season.goal}"
        </p>

        {sprint && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-2xs text-ink-600 mb-1.5">
              <span className="font-mono">Sprint {sprint.number}</span>
              <span className="font-mono">{sprintProgressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-sage-400 transition-all duration-700"
                style={{ width: `${sprintProgressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-2xs text-ink-600 mb-1.5">
          <span className="font-mono">Season arc</span>
          <span className="font-mono">{seasonProgressPct}%</span>
        </div>
        <div className="h-1 rounded-full bg-ink-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-sage-300/50 transition-all duration-700"
            style={{ width: `${seasonProgressPct}%` }}
          />
        </div>

        <p className="text-2xs text-ink-600 mt-2">
          {daysLeft(sprint ? sprint.endDate : season.endDate)} days left in this {sprint ? 'sprint' : 'season'}
        </p>
      </div>
    </Link>
  )
}

// ─── Charity impact card ──────────────────────────────────────────────────────

function ImpactCard({ impact, currency }: { impact: ImpactWallet; currency: string }) {
  const s = sym(currency)
  const lifetime = impact.wallet?.lifetimeDonated ?? 0
  const count = impact.currentMonth?.donationCount ?? 0

  return (
    <Link href="/donations">
      <div className="surface rounded-2xl p-4 hover:border-gold-400/20 transition-colors active:scale-[0.99]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold-400/12">
            <Heart className="w-5 h-5 text-gold-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-2xs font-bold uppercase tracking-widest text-ink-400 mb-1">
              Lifetime impact
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-semibold text-ink-50 tabular-nums">
                {s}{lifetime}
              </span>
              <span className="text-xs text-ink-400">donated</span>
            </div>
            <p className="text-xs text-ink-400 mt-0.5">
              {count > 0 ? `${count} donation${count === 1 ? '' : 's'} this month` : 'Your giving shows up here'}
            </p>
          </div>

          <ChevronRight className="w-4 h-4 text-ink-500 shrink-0 mt-1" />
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

  const [state, setState] = useState<StakeState | null>(null)
  const [streak, setStreak] = useState<StreakView>({ current: 0, longest: 0, graceRemaining: 0 })
  const [season, setSeason] = useState<Season | null>(null)
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const [circle, setCircle] = useState<MyCircle | null>(null)
  const [impact, setImpact] = useState<ImpactWallet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    // Primary state drives the page; secondary cards each fail soft to an empty state.
    stakeApi.getState()
      .then((s) => { if (alive) setState(s) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    statsApi.getStreak()
      .then((s) => {
        if (!alive) return
        setStreak({
          current: s.currentStreak ?? 0,
          longest: s.longestStreak ?? 0,
          graceRemaining: s.graceDays?.balance ?? 0,
        })
      })
      .catch(() => {})

    seasonsApi.getActive()
      .then((s) => { if (alive) setSeason(s ?? null) })
      .catch(() => {})
    seasonsApi.getCurrentSprint()
      .then((sp) => { if (alive) setSprint(sp ?? null) })
      .catch(() => {})

    circlesApi.getMy()
      .then((cs) => { if (alive) setCircle(cs?.[0] ?? null) })
      .catch(() => {})

    donationsApi.getImpactWallet()
      .then((w) => { if (alive) setImpact(w ?? null) })
      .catch(() => {})

    return () => { alive = false }
  }, [])

  const firstName = authUser?.firstName ?? 'there'
  const currency = state?.cycle?.currency ?? state?.config.currency ?? 'GBP'

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
              {greeting()}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-ember-400" />
              <span className="font-mono text-sm font-medium text-ink-200 tabular-nums">
                {streak.current}
              </span>
              <span className="text-2xs text-ink-600">days</span>
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-ink-400 hover:text-ink-100 hover:bg-ink-700/50 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll content */}
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {showStakeNudge && <StakeReNudge currency={gateCurrency} />}

        {loading && !state ? (
          <div className="space-y-4">
            <div className="h-28 rounded-2xl surface animate-pulse" />
            <div className="h-32 rounded-2xl surface animate-pulse" />
          </div>
        ) : (
          <>
            {/* Today's primary CTA */}
            {state && <TodayStakeCard state={state} />}

            {/* Streak / week dots */}
            <StreakWeekCard streak={streak} week={state?.week ?? []} />

            {/* Quick actions */}
            <SectionHead label="Go to" />
            <QuickActions />

            {/* Circle */}
            <SectionHead label="Your circle" href="/circles" />
            {circle ? <CircleCard circle={circle} /> : <JoinCircleCard />}

            {/* Season */}
            {season && (
              <>
                <SectionHead label="Season arc" href="/seasons" />
                <SeasonCard season={season} sprint={sprint} />
              </>
            )}

            {/* Impact */}
            {impact && (
              <>
                <SectionHead label="Your impact" href="/donations" />
                <ImpactCard impact={impact} currency={currency} />
              </>
            )}
          </>
        )}

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
