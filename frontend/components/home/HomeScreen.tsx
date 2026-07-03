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
import { Flame, Users, Target, Heart, ArrowRight, Shield, ChevronRight, Mic, Phone, MessageCircle } from 'lucide-react'
import { useStakeGate } from '@/hooks/useStakeGate'
import { StakeReNudge } from '@/components/stake-setup/StakeReNudge'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { IvyVine } from '@/components/living/IvyVine'
import {
  stakeApi,
  statsApi,
  seasonsApi,
  circlesApi,
  donationsApi,
  callsApi,
  chatApi,
  type StakeState,
  type StakeDayStatus,
} from '@/lib/api'
import type { Season, Sprint, ImpactWallet, Call } from '@/lib/types'
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
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

// ─── The vine hero — the living organism grown from this cycle ────────────────

const KEPT_STATUSES: StakeDayStatus[] = ['armed', 'complete', 'grace']

function VineHero({ state }: { state: StakeState }) {
  const week = state.week ?? []
  const keptCount = week.filter((d) => KEPT_STATUSES.includes(d.status)).length
  const forfeitedCount = week.filter((d) => d.status === 'forfeited').length
  const lived = keptCount + forfeitedCount
  const integrity = lived > 0 ? Math.round((keptCount / lived) * 100) : 100
  const today = week.find((d) => d.isToday)
  const todayKept = today ? KEPT_STATUSES.includes(today.status) : false
  const s = sym(state.cycle?.currency ?? state.config.currency)
  const slice = state.cycle?.dailySlice

  return (
    <div className="relative -mt-2">
      <div className="relative">
        {/* HUD readouts — the machine watching the organism */}
        <div className="absolute left-1 top-2 font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400/80">
          Ivy-01
          <span className="block mt-1 font-medium text-sage-400">
            {keptCount} {keptCount === 1 ? 'leaf' : 'leaves'}
          </span>
        </div>
        <div className="absolute right-1 top-2 text-right font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-400/80">
          Integrity
          <span className="block mt-1 font-medium text-sage-400">{integrity}%</span>
        </div>
        <IvyVine days={week} className="mx-auto h-60 w-auto" />
      </div>

      {/* Terminal statusline — blunt consequence, blinking cursor */}
      <div className="mt-2 rounded-xl border border-gold-400/20 bg-gold-400/[0.045] px-3.5 py-2.5 font-mono text-[11px] tracking-[0.04em] text-sage-300">
        {todayKept ? (
          <>&gt; tonight&apos;s leaf is lit{slice != null && <span className="text-gold-300"> · {s}{slice} protected</span>}</>
        ) : (
          <>&gt; miss tonight and a leaf falls{slice != null && <span className="text-ember-400"> · −{s}{slice}</span>}</>
        )}{' '}
        <span className="cursor-blink inline-block h-[11px] w-[6px] translate-y-[1.5px] bg-gold-400" />
      </div>
    </div>
  )
}

// ─── Today's stake status card ────────────────────────────────────────────────

function TodayStakeCard({ state, hasCard }: { state: StakeState; hasCard: boolean }) {
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

  // Stake configured but no active cycle yet. Two very different states:
  //  • No card on file → the stake CANNOT arm. Be honest and drive to add one;
  //    never imply a cycle is coming when nothing will open. (This was the old
  //    "Stake ready · cycle starts Monday" lie shown to card-less new users.)
  //  • Card on file → the cycle genuinely opens with the weekly cron.
  if (!cycle) {
    if (!hasCard) {
      return (
        <Link href="/stake-setup">
          <div className="relative rounded-2xl p-4 overflow-hidden border border-gold-400/30 bg-gold-400/05 glow-sm-gold active:scale-[0.99] transition-all">
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold-400/12">
                <Shield className="w-5 h-5 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gold-300">Add a card to arm your stake</p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {config.weeklyAmount != null
                    ? `Your ${s}${config.weeklyAmount}/week stake activates the moment your card's on file. Nothing's charged today.`
                    : "Your stake activates the moment your card's on file. Nothing's charged today."}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-gold-400" />
            </div>
          </div>
        </Link>
      )
    }
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
  const week = state.week ?? []

  // The console voice: NOT ARMED burns amber (attention), coral is reserved
  // for money actually leaving. See docs/design-constitution.md.
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.3em] text-ink-400">
        Stake console · {cycle.isFoundation ? 'Foundation Run' : 'Week cycle'}
        <span className="h-px flex-1 bg-gold-400/10" />
      </p>

      <div className="overflow-hidden rounded-2xl border border-gold-400/20 bg-gradient-to-br from-[#082230]/60 to-[#04121a]/80 shadow-[0_0_44px_rgba(70,240,200,0.05)] transition-all active:scale-[0.99]">
        <Link href="/daily" className="flex items-stretch">
          <div className="flex-1 px-4 py-3.5">
            <p
              className={`font-mono text-[13px] font-semibold tracking-[0.18em] ${
                isArmed
                  ? 'text-gold-300 [text-shadow:0_0_12px_rgba(70,240,200,0.4)]'
                  : 'text-[#ffb03a] [text-shadow:0_0_12px_rgba(255,176,58,0.35)]'
              }`}
            >
              {isArmed ? 'ARMED' : 'NOT ARMED'}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
              {isArmed ? (
                <>Today&apos;s <b className="font-medium text-ink-50">{s}{cycle.dailySlice}</b> is protected. The vine grows at dawn.</>
              ) : (
                <>
                  Voice note{today.armingWindowEnd ? <> by <b className="font-medium text-ink-50">{today.armingWindowEnd}</b></> : null} — or {s}{cycle.dailySlice} of your {s}{cycle.weeklyAmount} goes
                  {config.forfeitDestination ? ` to ${config.forfeitDestination}` : ' to charity'}.
                </>
              )}
            </p>
          </div>
          <div className="flex w-[96px] shrink-0 flex-col items-center justify-center gap-1.5 border-l border-gold-400/15 bg-gradient-to-b from-gold-400/15 to-gold-400/5 text-gold-300">
            <span className="font-mono text-[13px] font-semibold tracking-[0.08em] [text-shadow:0_0_14px_rgba(70,240,200,0.6)]">
              {isArmed ? '[✓]' : '[ARM]'}
            </span>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.2em] text-ink-400">
              {isArmed ? 'Locked in' : 'Hold to rec'}
            </span>
          </div>
        </Link>

        {/* Week as lives */}
        <div className="flex items-center gap-1.5 border-t border-gold-400/10 px-4 py-3">
          <span className="mr-1.5 font-mono text-[8.5px] uppercase tracking-[0.24em] text-ink-400">Week</span>
          {week.map((d, i) => {
            const kept = KEPT_STATUSES.includes(d.status)
            const forfeited = d.status === 'forfeited'
            const isTodayCell = d.isToday && !kept && !forfeited
            return (
              <span
                key={d.date + i}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-[8px] ${
                  kept
                    ? 'border-gold-400 bg-gold-400/15 text-gold-100 shadow-[0_0_10px_rgba(70,240,200,0.25),inset_0_0_6px_rgba(70,240,200,0.18)]'
                    : forfeited
                      ? 'border-ember-500/50 text-ember-400/80'
                      : isTodayCell
                        ? 'border-dashed border-[#ffb03a]/60 text-[#ffb03a]'
                        : 'border-gold-400/12 text-ink-600'
                }`}
              >
                {d.label}
              </span>
            )
          })}
          <span className="ml-auto text-right font-mono text-2xs leading-tight text-ink-600">
            {s}{cycle.amountSafe} safe
            <span className="block text-ember-400/70">{s}{cycle.amountAtRisk} at risk</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Upcoming call (orientation / "Ivy is about to call you") ──────────────────

function formatCallWhen(iso: string): string {
  const when = new Date(iso)
  const now = new Date()
  const sameDay = when.toDateString() === now.toDateString()
  const tmrw = new Date(now); tmrw.setDate(now.getDate() + 1)
  const isTomorrow = when.toDateString() === tmrw.toDateString()
  const time = when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today at ${time}`
  if (isTomorrow) return `tomorrow at ${time}`
  return `${when.toLocaleDateString('en-GB', { weekday: 'long' })} at ${time}`
}

const CALL_COPY: Record<string, { title: string; sub: string }> = {
  ONBOARDING: {
    title: 'Ivy is calling to get you started',
    sub: "Pick up — it's a quick chat to set up your week and show you the ropes.",
  },
  MORNING_PLANNING: { title: 'Morning planning call', sub: 'Ivy rings to set your intention for the day.' },
  EVENING_REVIEW:   { title: 'Evening review call',   sub: 'Ivy rings to close out your day.' },
  WEEKLY_PLANNING:  { title: 'Weekly planning call',  sub: 'Ivy rings to plan the week ahead.' },
}

function NextCallCard({ call }: { call: Call }) {
  const copy = CALL_COPY[call.callType] ?? { title: 'Upcoming call with Ivy', sub: 'Ivy will call you shortly.' }
  const isOnboarding = call.callType === 'ONBOARDING'
  return (
    <div className={`relative rounded-2xl p-4 overflow-hidden border ${isOnboarding ? 'border-periwinkle-400/30 bg-periwinkle-400/05 glow-sm' : 'border-ink-700/60 surface'}`}>
      <div className="relative flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOnboarding ? 'bg-periwinkle-400/12' : 'bg-ink-700/60'}`}>
          <Phone className={`w-5 h-5 ${isOnboarding ? 'text-periwinkle-400' : 'text-ink-300'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isOnboarding ? 'text-periwinkle-200' : 'text-ink-100'}`}>{copy.title}</p>
          <p className="text-xs text-ink-400 mt-0.5">{copy.sub}</p>
          <p className="text-xs font-medium text-periwinkle-300 mt-1.5 font-mono">📞 {formatCallWhen(call.scheduledAt)}</p>
        </div>
      </div>
    </div>
  )
}

function IvyMessageCard({ count }: { count: number }) {
  return (
    <Link
      href="/ivy"
      className="relative flex items-center gap-3 rounded-2xl p-4 overflow-hidden border border-gold-400/30 bg-gold-400/05 glow-sm transition-colors hover:bg-gold-400/10"
    >
      <div className="w-10 h-10 rounded-xl bg-gold-400/12 flex items-center justify-center shrink-0">
        <MessageCircle className="w-5 h-5 text-gold-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gold-200">
          Ivy left you {count > 1 ? `${count} messages` : 'a message'}
        </p>
        <p className="text-xs text-ink-400 mt-0.5">Tap to open your chat with Ivy.</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gold-300 shrink-0" />
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
  const total = circle.maxSize || circle.size || circle.members?.length || 0
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
  const [nextCall, setNextCall] = useState<Call | null>(null)
  const [ivyUnread, setIvyUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  // No card on file (FREE tier) → the stake can't arm yet. Drives honest copy.
  const hasCard = (authUser?.subscriptionTier ?? 'FREE') !== 'FREE'

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

    callsApi.getUpcoming()
      .then((cs) => { if (alive) setNextCall(cs?.[0] ?? null) })
      .catch(() => {})

    // Unread count only — never getThread() here, which would mark Ivy's
    // messages read as a side-effect of loading home.
    chatApi.getUnreadCount()
      .then((n) => { if (alive) setIvyUnread(n) })
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
            <div className="text-right">
              <span className="font-mono text-lg font-semibold tabular-nums text-gold-400 [text-shadow:0_0_14px_rgba(70,240,200,0.5)]">
                {String(streak.current).padStart(2, '0')}
              </span>
              <span className="block -mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-400">
                day run
              </span>
            </div>
            <Link
              href="/settings"
              aria-label="Profile & settings"
              className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full bg-gold-400/15 border border-gold-400/30 text-gold-300 text-sm font-semibold hover:bg-gold-400/25 transition-colors overflow-hidden"
            >
              {authUser?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authUser.profileImage} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(firstName)
              )}
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
            {/* The organism — your ivy, grown from this cycle's real days */}
            {state && state.cycle && <VineHero state={state} />}

            {/* Ivy reached out — onboarding handoff / evening check-in / replies */}
            {ivyUnread > 0 && <IvyMessageCard count={ivyUnread} />}

            {/* Today's primary CTA */}
            {state && <TodayStakeCard state={state} hasCard={hasCard} />}

            {/* Upcoming call — Ivy reaching out (welcome call / daily check-ins) */}
            {nextCall && <NextCallCard call={nextCall} />}

            {/* Streak / week dots — only when there's no active cycle (the
                stake console above carries the week-as-lives row otherwise) */}
            {!state?.cycle && <StreakWeekCard streak={streak} week={state?.week ?? []} />}

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
