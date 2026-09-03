'use client'

/**
 * CirclesScreen — the cohort view, wired to real API data.
 *
 * Data sources:
 *   - circlesApi.getMy()            → the user's circle(s) + member roster
 *   - circleGamesApi.getActiveGame()→ the active game + Ivy's state summary
 *   - circlesApi.getSessions()      → upcoming sprint session
 *
 * Per-member arming/streak/stake status is NOT exposed by the API, so it is
 * not shown here (no fabricated dots/streaks/witnessed-stake badges).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Calendar, Zap, Sparkles, Lock, Send, Eye, EyeOff, UserPlus } from 'lucide-react'
import { circlesApi, circleGamesApi, peerApi, type CircleCurrentSession, type WitnessedStakeStatus, type PeerPartner } from '@/lib/api'
import PartnerNote from './PartnerNote'
import { useAuthStore } from '@/lib/store/auth.store'

type Circle = Awaited<ReturnType<typeof circlesApi.getMy>>[number]
type ActiveGame = Awaited<ReturnType<typeof circleGamesApi.getActiveGame>>
type Pulse = Awaited<ReturnType<typeof circlesApi.getConsistency>>

const HUES = [14, 44, 152, 238, 280, 320]
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

// Witnessed-stake chip: only opted-in members show a status; 'private' and
// 'no_stake' show nothing at all — absence, not a lock icon, so opting out
// never reads as hiding something.
function StakeChip({ status }: { status?: WitnessedStakeStatus }) {
  if (!status || status.stakeStatus === 'private' || status.stakeStatus === 'no_stake') return null
  const map: Record<string, { label: string; cls: string }> = {
    armed: { label: 'armed', cls: 'text-gold-300 border-gold-400/30 bg-gold-400/08' },
    completed: { label: 'kept today', cls: 'text-gold-300 border-gold-400/30 bg-gold-400/08' },
    forfeited: { label: 'slipped today', cls: 'text-ember-400 border-ember-500/35 bg-ember-500/08' },
    unarmed: { label: 'not armed yet', cls: 'text-[#ffb03a] border-[#ffb03a]/35 bg-[#ffb03a]/08' },
  }
  const c = map[status.stakeStatus]
  if (!c) return null
  return (
    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] ${c.cls}`}>
      {c.label}
    </span>
  )
}

function MemberRow({ name, isYou, stakeStatus }: { name: string; isYou: boolean; stakeStatus?: WitnessedStakeStatus }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
      isYou ? 'bg-gold-400/05 border border-gold-400/10' : 'hover:bg-ink-700/50'
    }`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-900 shrink-0"
        style={{ background: `hsl(${hueFor(name)}, 60%, 60%)` }}
      >
        {initials}
      </div>
      <p className={`flex-1 text-sm font-medium ${isYou ? 'text-gold-300' : 'text-ink-50'}`}>
        {isYou ? 'You' : name}
      </p>
      <StakeChip status={stakeStatus} />
    </div>
  )
}

// Header only — no back arrow, no menu button. This screen lives inside
// ConsumerShell's bottom nav (Home·Ivy·Circle·Impact); a second navigation
// paradigm on top of it taught users two conflicting ways home.
function NavBar({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <>
      <div className="safe-top" />
      <div className="pt-3 pb-5 text-center">
        {title && <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">{title}</p>}
        {subtitle && <p className="text-xs text-ink-200 font-display italic mt-0.5">&ldquo;{subtitle}&rdquo;</p>}
      </div>
    </>
  )
}

/**
 * The active game, rendered by mechanic: a progress bar for the collective
 * pact, a mini leaderboard for the points race, holder + lives for the relay.
 * Ivy's own state summary rides underneath — her voice, our pixels.
 */
function GameCard({ game, stateSummary, nameOf, myUserId, partner, onPartnerChange }: {
  game: NonNullable<ActiveGame>['game']
  stateSummary?: string
  nameOf: (id: string) => string
  myUserId?: string
  partner?: PeerPartner | null
  onPartnerChange?: (next: PeerPartner) => void
}) {
  const state = (game.state ?? {}) as Record<string, any>
  const rules = (game.rules ?? {}) as Record<string, any>

  let body: React.ReactNode = null
  if (game.templateType === 'collective') {
    const target = Number(rules.target ?? 30)
    const total = Number(state.total ?? 0)
    const pct = Math.min(100, Math.round((total / Math.max(1, target)) * 100))
    const deadlineDays = Number(rules.deadline_days ?? 0)
    const started = game.startedAt ? new Date(game.startedAt).getTime() : Date.now()
    const daysLeft = deadlineDays ? Math.max(0, Math.ceil((started + deadlineDays * 86_400_000 - Date.now()) / 86_400_000)) : null
    body = (
      <div className="mt-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-sm text-ink-50 font-semibold tabular-nums">{total} <span className="text-ink-400 font-normal">of {target} kept days</span></p>
          {daysLeft != null && <p className="text-2xs text-ink-400">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</p>}
        </div>
        <div className="h-2 rounded-full bg-ink-900/70 border border-ink-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-sage-500 to-sage-300 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  } else if (game.templateType === 'points_race') {
    const scores = (state.scores ?? {}) as Record<string, number>
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
    const top = sorted.slice(0, 3)
    const myRank = sorted.findIndex(([id]) => id === myUserId)
    const rows = myUserId && myRank >= 3 ? [...top, sorted[myRank]] : top
    body = (
      <div className="mt-3 space-y-1">
        {rows.map(([id, pts]) => {
          const rank = sorted.findIndex(([sid]) => sid === id) + 1
          const isYou = id === myUserId
          return (
            <div key={id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${isYou ? 'bg-gold-400/05 border border-gold-400/10' : ''}`}>
              <span className="text-2xs text-ink-400 w-4 tabular-nums">{rank === 1 ? '👑' : rank}</span>
              <span className={`flex-1 text-xs font-medium ${isYou ? 'text-gold-300' : 'text-ink-100'}`}>{isYou ? 'You' : nameOf(id)}</span>
              <span className="text-xs text-ink-200 tabular-nums">{pts} pts</span>
            </div>
          )
        })}
        <p className="text-2xs text-ink-400 pt-0.5">First to {rules.target ?? 20} takes the crown.</p>
      </div>
    )
  } else if (game.templateType === 'pairs') {
    const target = Number(rules.target ?? 20)
    const banked = Number(state.banked ?? 0)
    const pct = Math.min(100, Math.round((banked / Math.max(1, target)) * 100))
    const pairs = (rules.pairs ?? []) as string[][]
    const mine = pairs.find((p) => p.includes(myUserId ?? ''))
    const partnerId = mine?.find((id) => id !== myUserId)
    const ours = Number((state.pair_banked ?? {})[[...(mine ?? [])].sort().join('|')] ?? 0)
    const isSolo = !partnerId && ((rules.solo ?? []) as string[]).includes(myUserId ?? '')
    body = (
      <div className="mt-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-sm text-ink-50 font-semibold tabular-nums">
            {banked} <span className="text-ink-400 font-normal">of {target} paired days</span>
          </p>
          {(partnerId || isSolo) && (
            <p className="text-2xs text-ink-400 tabular-nums">{ours} yours</p>
          )}
        </div>
        <div className="h-2 rounded-full bg-ink-900/70 border border-ink-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-sage-500 to-sage-300 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-2xs text-ink-400 pt-2 leading-relaxed">
          {partnerId
            ? <>You&rsquo;re with <span className="text-ink-100">{nameOf(partnerId)}</span>. A day only counts when you both keep it.</>
            : isSolo
              ? <>Odd one out this sprint — your kept days count on their own.</>
              : <>Every day here took two people.</>}
        </p>
      </div>
    )
  } else if (game.templateType === 'relay') {
    const lives = Number(state.lives_remaining ?? 0)
    const holderId = state.current_holder_id as string | undefined
    const isYou = holderId === myUserId
    body = (
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-ink-100">
          <span className={isYou ? 'text-gold-300 font-semibold' : 'text-ink-50 font-semibold'}>{isYou ? 'You hold' : `${holderId ? nameOf(holderId) : 'Someone'} holds`}</span> the baton
        </p>
        <p className="text-xs tabular-nums" aria-label={`${lives} lives left`}>
          {Array.from({ length: Math.max(lives, 0) }).map((_, i) => <span key={i} className="text-ember-400">♥ </span>)}
          <span className="text-ink-400">{lives} {lives === 1 ? 'life' : 'lives'}</span>
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1.5 mb-3">
        <Zap className="w-3 h-3 text-sage-400" />
        <span className="text-2xs font-semibold uppercase tracking-widest text-sage-400">Active game</span>
      </div>
      <h2 className="font-display text-lg text-ink-50">{game.name}</h2>
      {game.description && <p className="text-sm text-ink-400 mt-1">{game.description}</p>}
      {body}
      {game.templateType === 'pairs' && partner && onPartnerChange && (
        <PartnerNote partner={partner} onChange={onPartnerChange} />
      )}
      {stateSummary && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-ink-900/60 border border-ink-700 p-3">
          <Sparkles className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
          <p className="text-xs text-ink-200 leading-relaxed">{stateSummary}</p>
        </div>
      )}
    </>
  )
}

/**
 * The async session room. Sharing is the price of seeing it: until your win +
 * struggle are in, the others' shares stay counted-but-veiled.
 */
function SessionCard({ session, onUpdate }: {
  session: CircleCurrentSession
  onUpdate: (s: CircleCurrentSession | null) => void
}) {
  const [win, setWin] = useState('')
  const [struggle, setStruggle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [nudgeBusy, setNudgeBusy] = useState(false)
  const [nudgeNote, setNudgeNote] = useState('')

  // Ivy drafts from the member's real sprint record; only empty fields are
  // filled so a half-written thought is never clobbered. Always editable.
  const nudge = async () => {
    setNudgeBusy(true)
    setNudgeNote('')
    try {
      const draft = await circlesApi.getSessionNudge()
      if (!win.trim()) setWin(draft.win)
      if (!struggle.trim()) setStruggle(draft.struggle)
      setNudgeNote('Drafted from your sprint — edit it into your own words before you step in.')
    } catch (err: any) {
      setNudgeNote(err.message ?? "Couldn't draft anything — say it in your own words.")
    } finally {
      setNudgeBusy(false)
    }
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await circlesApi.submitSessionShare(win, struggle)
      onUpdate(updated)
    } catch (err: any) {
      setError(err.message ?? "Couldn't share — try again.")
    } finally {
      setBusy(false)
    }
  }

  const hoursLeft = Math.max(0, Math.round((new Date(session.closesAt).getTime() - Date.now()) / 3_600_000))
  const inputClass = 'w-full px-3 py-2.5 text-sm bg-ink-900/50 border border-ink-600 rounded-xl text-ink-200 placeholder:text-ink-600 focus:outline-none focus:ring-1 focus:ring-periwinkle-400/40 resize-none'

  // Upcoming: a promise, not a room yet.
  if (session.status === 'scheduled') {
    const days = Math.max(0, Math.ceil((new Date(session.opensAt).getTime() - Date.now()) / 86_400_000))
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-3 page-enter" style={{ animationDelay: '150ms' }}>
        <Calendar className="w-4 h-4 text-periwinkle-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-50">
            {days === 0 ? 'Session opens today' : `Session opens in ${days} day${days !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">Come with one win and one honest struggle.</p>
        </div>
      </div>
    )
  }

  // Open, not yet shared: the locked room.
  if (session.status === 'open' && !session.myShare) {
    return (
      <div className="surface border-periwinkle-400/25 rounded-2xl p-4 page-enter" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-periwinkle-400" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-periwinkle-400">Session open</span>
          </div>
          <span className="text-2xs text-ink-400">{hoursLeft}h left</span>
        </div>
        <p className="text-sm text-ink-200 mb-1">
          {session.sharedCount > 0
            ? `${session.sharedCount} of ${session.memberCount} are already in the room.`
            : 'The room is waiting for its first voice.'}
        </p>
        <p className="text-xs text-ink-400 mb-3">Share yours to see theirs — that&rsquo;s the deal.</p>
        <div className="space-y-2">
          <textarea value={win} onChange={(e) => setWin(e.target.value)} rows={2} maxLength={500}
            placeholder="One win from this sprint…" className={inputClass} />
          <textarea value={struggle} onChange={(e) => setStruggle(e.target.value)} rows={2} maxLength={500}
            placeholder="One honest struggle…" className={inputClass} />
          {(!win.trim() || !struggle.trim()) && (
            <button
              onClick={nudge}
              disabled={nudgeBusy || busy}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-periwinkle-300 hover:text-periwinkle-200 transition-colors disabled:opacity-60"
            >
              <Sparkles className={`w-3 h-3 ${nudgeBusy ? 'animate-pulse' : ''}`} />
              {nudgeBusy ? 'Ivy is thinking back over your sprint…' : 'Blank? Let Ivy draft it from your sprint'}
            </button>
          )}
          {nudgeNote && <p className="text-2xs text-ink-400 text-center leading-relaxed">{nudgeNote}</p>}
          <button
            onClick={submit}
            disabled={busy || !win.trim() || !struggle.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-periwinkle-500/90 text-ink-900 text-sm font-semibold hover:bg-periwinkle-400 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> {busy ? 'Stepping in…' : 'Step into the room'}
          </button>
          {error && <p className="text-xs text-ember-400">{error}</p>}
        </div>
      </div>
    )
  }

  // Shared (open or completed): the room itself.
  if (session.myShare && session.room) {
    return (
      <div className="surface rounded-2xl p-4 page-enter" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-sage-400" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-sage-400">
              {session.status === 'open' ? 'The room' : 'Session closed'}
            </span>
          </div>
          <span className="text-2xs text-ink-400">
            {session.status === 'open' ? `${session.sharedCount} of ${session.memberCount} in · ${hoursLeft}h left` : `${session.sharedCount} of ${session.memberCount} showed`}
          </span>
        </div>
        <div className="space-y-3">
          {session.room.map((s, i) => (
            <div key={i} className={`rounded-xl p-3 ${s.isYou ? 'bg-gold-400/05 border border-gold-400/10' : 'bg-ink-900/50 border border-ink-700'}`}>
              <p className={`text-xs font-semibold mb-1.5 ${s.isYou ? 'text-gold-300' : 'text-ink-100'}`}>{s.isYou ? 'You' : s.firstName}</p>
              <p className="text-xs text-ink-200 leading-relaxed"><span className="text-sage-400">Win</span> — {s.win}</p>
              <p className="text-xs text-ink-300 leading-relaxed mt-1"><span className="text-ember-400">Struggle</span> — {s.struggle}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Completed without sharing: you missed the room.
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 page-enter" style={{ animationDelay: '150ms' }}>
      <Lock className="w-4 h-4 text-ink-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-200">The room closed without you this time</p>
        <p className="text-xs text-ink-400 mt-0.5">Ivy will catch you up on your next call. Next session, step in.</p>
      </div>
    </div>
  )
}

export function CirclesScreen() {
  const { user } = useAuthStore()
  const [circle, setCircle] = useState<Circle | null>(null)
  const [activeGame, setActiveGame] = useState<ActiveGame>(null)
  const [partner, setPartner] = useState<PeerPartner | null>(null)
  const [session, setSession] = useState<CircleCurrentSession | null>(null)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [stakeStatuses, setStakeStatuses] = useState<WitnessedStakeStatus[]>([])
  const [shareBusy, setShareBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    circlesApi.getMy()
      .then((cs) => {
        if (!alive) return
        const c = cs?.[0] ?? null
        setCircle(c)
        if (c) {
          circlesApi.getConsistency(c.id)
            .then((p) => { if (alive) setPulse(p) })
            .catch(() => {})
          circlesApi.getStakeStatuses(c.id)
            .then((st) => { if (alive) setStakeStatuses(st) })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    circlesApi.getCurrentSession()
      .then((s) => { if (alive) setSession(s) })
      .catch(() => {})

    circleGamesApi.getActiveGame()
      .then((g) => { if (alive) setActiveGame(g) })
    // Null for anyone not in a pairs game, and for the odd member out — the
    // right to write comes from sharing an outcome, and they do not share one.
    peerApi.getPartner()
      .then((p) => { if (alive) setPartner(p) })
      .catch(() => {})
      .catch(() => {})

    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <div className="min-h-dvh mesh-bg-subtle flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-periwinkle-400 animate-spin" />
      </div>
    )
  }

  // ── Empty state: not in a circle ───────────────────────────────────────────
  if (!circle) {
    return (
      <div className="min-h-dvh mesh-bg-subtle relative overflow-x-hidden">
        <div className="relative max-w-lg mx-auto px-4 pb-24">
          <NavBar />
          <div className="flex flex-col items-center justify-center text-center gap-4 mt-24">
            <div className="w-14 h-14 rounded-2xl bg-periwinkle-500/15 border border-periwinkle-400/25 flex items-center justify-center">
              <Users className="w-7 h-7 text-periwinkle-400" />
            </div>
            <h1 className="font-display text-xl text-ink-50">You&rsquo;re not in a circle yet</h1>
            <p className="text-sm text-ink-400 max-w-xs">
              Circles are small cohorts who show up together — shared sessions, shared games, shared
              accountability. When you join or get added to one, it&rsquo;ll appear here.
            </p>
            <Link href="/home">
              <button className="mt-2 px-5 py-3 rounded-2xl surface text-sm text-ink-200 hover:bg-ink-700 transition-colors">
                Back to home
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const myUserId = user?.id
  const game = activeGame?.game ?? null
  // Under 3 people a room isn't a room yet: be honest about it, hide the game
  // (a two-person leaderboard teaches "ghost town"), and point the social
  // energy at the witness — the accountability that works at any scale.
  const isForming = circle.members.length < 3
  const myStakeStatus = stakeStatuses.find((s) => s.userId === myUserId)
  const iShareStake = myStakeStatus?.shareStakeWithCircle ?? false

  const toggleShareStake = async () => {
    if (!circle || shareBusy) return
    setShareBusy(true)
    try {
      await circlesApi.setShareStake(circle.id, !iShareStake)
      const st = await circlesApi.getStakeStatuses(circle.id)
      setStakeStatuses(st)
    } catch {
      // leave state as-is; the toggle can be retried
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <div className="min-h-dvh mesh-bg-subtle relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed -top-32 -right-20 w-80 h-80 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(238,238,255,0.18) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-40 -left-20 w-72 h-72 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-lg mx-auto px-4 pb-24">
        <NavBar title={circle.track} subtitle={circle.seasonTheme} />

        {/* ── Hero header ── */}
        <div className="mb-6 page-enter">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-periwinkle-500/15 border border-periwinkle-400/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-periwinkle-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-ink-50 tracking-tight">{circle.name}</h1>
              <p className="text-sm text-ink-400 mt-0.5">
                {circle.size} member{circle.size !== 1 ? 's' : ''}
                {circle.maxSize ? ` · ${circle.maxSize - circle.size} spot${circle.maxSize - circle.size !== 1 ? 's' : ''} open` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Forming state: honest about the quiet, points at the witness ── */}
        {isForming && (
          <div className="surface border-periwinkle-400/20 rounded-2xl p-4 mb-5 page-enter" style={{ animationDelay: '30ms' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <UserPlus className="w-3 h-3 text-periwinkle-400" />
              <span className="text-2xs font-semibold uppercase tracking-widest text-periwinkle-400">Room forming</span>
            </div>
            <p className="text-sm text-ink-200 leading-relaxed">
              {circle.members.length === 1
                ? 'You’re first in. The room fills as others start — sessions and games wake up when there are enough of you to matter.'
                : `${circle.members.length} of ${circle.maxSize ?? 8} in so far. Sessions and games wake up as the room fills.`}
            </p>
            <p className="text-xs text-ink-400 mt-2 leading-relaxed">
              Meanwhile, the strongest accountability is one person who knows you —{' '}
              <Link href="/settings" className="text-periwinkle-300 hover:text-periwinkle-200 underline underline-offset-2">
                add your witness in Settings
              </Link>{' '}
              and they&rsquo;ll hear how your week goes.
            </p>
          </div>
        )}

        {/* ── Group pulse strip ── */}
        {pulse && pulse.memberCount > 1 && (
          <div className="surface rounded-2xl p-4 mb-5 page-enter flex items-center gap-4" style={{ animationDelay: '40ms' }}>
            <p className="font-display text-3xl font-semibold text-ink-50 tabular-nums leading-none">
              {pulse.rate}<span className="text-lg text-ink-400">%</span>
            </p>
            <div className="min-w-0">
              <p className="text-xs text-ink-200">of the group&rsquo;s planned days kept this sprint</p>
              {pulse.topPerformers.length > 0 && (
                <p className="text-2xs text-ink-400 mt-0.5 truncate">
                  Carrying it: <span className="text-ink-200">{pulse.topPerformers.join(', ')}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Member roster ── */}
        <div className="surface rounded-2xl p-3 mb-5 page-enter" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Members</p>
            <p className="text-2xs text-ink-400">{circle.members.length} people</p>
          </div>
          <div className="space-y-0.5">
            {circle.members.map((m) => (
              <MemberRow
                key={m.userId}
                name={m.user.firstName}
                isYou={m.userId === myUserId}
                stakeStatus={stakeStatuses.find((s) => s.userId === m.userId)}
              />
            ))}
          </div>
          {/* Witnessed stakes: my own visibility toggle — being seen is the mechanic */}
          {myStakeStatus && (
            <button
              onClick={toggleShareStake}
              disabled={shareBusy}
              className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-ink-700/40 transition-colors disabled:opacity-60"
            >
              {iShareStake
                ? <Eye className="w-3.5 h-3.5 text-gold-300 shrink-0" />
                : <EyeOff className="w-3.5 h-3.5 text-ink-400 shrink-0" />}
              <span className="flex-1 text-xs text-ink-300">
                {iShareStake
                  ? 'The room sees your stake days — armed, kept, slipped.'
                  : 'Let the room see your stake days. Being seen is half the teeth.'}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-400">
                {shareBusy ? '…' : iShareStake ? 'On' : 'Off'}
              </span>
            </button>
          )}
        </div>

        {/* ── Active game — hidden while the room is forming ── */}
        {!isForming && (
        <div className="surface rounded-2xl p-4 mb-5 page-enter" style={{ animationDelay: '100ms' }}>
          {game ? (
            <GameCard
              game={game}
              stateSummary={activeGame?.stateSummary}
              myUserId={myUserId}
              partner={partner}
              onPartnerChange={setPartner}
              nameOf={(id) => circle.members.find((m) => m.userId === id)?.user.firstName ?? 'A circle-mate'}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-ink-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-200">No active game</p>
                <p className="text-xs text-ink-400 mt-0.5">Your circle&rsquo;s next game will show up here once it starts.</p>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ── The session — upcoming promise / locked room / the room / missed ── */}
        {session && <SessionCard session={session} onUpdate={setSession} />}
      </div>
    </div>
  )
}
