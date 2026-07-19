'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart2, Flame, Sparkles, BellRing, Share, Plus } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { StakeBar } from './StakeBar'
import { VoiceRecorder } from './VoiceRecorder'
import { EveningReview } from './EveningReview'
import { IvyVine } from '@/components/living/IvyVine'
import { stakeApi, statsApi, circlesApi, type StakeState } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { isIOS, isStandalone } from '@/lib/pwa'
import type { DailyLoopPhase, VoiceNote, StakeStatus } from './types'

/* ── Circle badge ─────────────────────────────────────────────────────────── */
function CircleBadge({ name }: { name: string }) {
  return (
    <Link href="/circles">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl surface border-gold-400/25 hover:bg-ink-700/60 transition-colors">
        <Users className="w-3.5 h-3.5 text-gold-300" />
        <span className="text-2xs font-bold text-gold-300 uppercase tracking-wider">{name}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-sage-400 animate-pulse" />
      </div>
    </Link>
  )
}

/* ── Top nav bar ──────────────────────────────────────────────────────────── */
function NavBar({ circleName }: { circleName: string | null }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <Link href="/home">
        <button className="w-9 h-9 rounded-xl surface flex items-center justify-center hover:bg-ink-700/60 transition-colors">
          <ArrowLeft className="w-4 h-4 text-ink-200" />
        </button>
      </Link>
      {circleName && <CircleBadge name={circleName} />}
    </div>
  )
}

/* ── Honest-mistake valve ─────────────────────────────────────────────────── */
// Today's slice forfeited but they say they DID the thing (forgot the VN — the
// likeliest unfair-forfeit case). One tap flags it for human review; money
// never moves from here. Grace reassurance comes from the server's answer.
function DisputeStrip({ workoutId, dailySlice, currency }: {
  workoutId: string
  dailySlice: number
  currency: 'GBP' | 'USD'
}) {
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [graceCovers, setGraceCovers] = useState(false)
  const s = currency === 'GBP' ? '£' : '$'

  const flag = async () => {
    setPhase('sending')
    try {
      const res = await stakeApi.dispute(workoutId)
      setGraceCovers(res.graceCovers)
      setPhase('done')
    } catch {
      setPhase('failed')
    }
  }

  return (
    <div className="mx-4 mt-2 rounded-xl border border-ember-500/30 bg-ember-500/[0.06] px-3.5 py-2.5">
      {phase === 'done' ? (
        <p className="text-xs leading-relaxed text-ink-200">
          {graceCovers
            ? <>Flagged. Your <b className="font-medium text-ink-50">grace day</b> already covers this when the week settles — no charge for it.</>
            : <>Flagged. A human reviews every flag — if it&apos;s upheld, that day&apos;s {s}{dailySlice} comes back.</>}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs leading-relaxed text-ink-300">
            Today&apos;s {s}{dailySlice} slice forfeited — no voice note landed.
            {phase === 'failed' && <span className="text-ember-400"> Flag didn&apos;t send — try again.</span>}
          </p>
          <button
            onClick={flag}
            disabled={phase === 'sending'}
            className="shrink-0 rounded-lg border border-ember-500/40 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ember-400 hover:bg-ember-500/10 transition-colors disabled:opacity-50"
          >
            {phase === 'sending' ? 'Flagging…' : 'I actually did this'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Day header ───────────────────────────────────────────────────────────── */
function DayHeader({ phase, name, streakDays }: { phase: DailyLoopPhase; name: string; streakDays: number }) {
  const isEvening = phase === 'evening-review'
  const isArmed = phase === 'morning-armed'
  const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.22em] text-ink-400">
            {weekday} · {dateLabel} · {isEvening ? 'Settle the day' : isArmed ? 'Armed' : 'Arm your day'}
          </p>
          <h1 className="font-display text-2xl text-ink-50 tracking-tight mt-0.5">
            {isEvening ? `Evening, ${name}` : `Morning, ${name}`}
          </h1>
        </div>
        <div className="ml-auto text-right shrink-0">
          <span className="font-mono text-lg font-semibold tabular-nums text-gold-400 [text-shadow:0_0_14px_rgba(70,240,200,0.5)]">
            {String(streakDays).padStart(2, '0')}
          </span>
          <span className="block -mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-400">
            day run
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Armed confirmation card ──────────────────────────────────────────────── */
/* ── Push opt-in (daily screen) ───────────────────────────────────────────── */
/**
 * The whole stake loop depends on the user arming each morning, and the morning
 * reminder ladder is push-first. Plenty of users never hit the stake-setup screen
 * where EnablePushCard lives (or armed before it existed), so they get a single
 * morning SMS and silence. This surfaces the opt-in right on the daily screen —
 * the page every reminder deep-links to — so future nudges actually land.
 *
 * Self-hides once notifications are on. Dismissible per-session so it's a nudge,
 * not a nag. Styled in the Living Vine language.
 */
function DailyPushPrompt() {
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)
  const [iosTab] = useState(() => isIOS() && !isStandalone())

  // Already on, blocked (can't re-prompt), unsupported, or dismissed → show nothing.
  if (
    dismissed ||
    (isSubscribed && permission === 'granted') ||
    permission === 'denied' ||
    permission === 'unsupported'
  ) {
    return null
  }

  // iOS browser tab — push needs Home Screen install first.
  if (iosTab) {
    return (
      <div className="w-full max-w-sm mx-auto mb-4 animate-fade-in">
        <div className="surface rounded-2xl p-4 space-y-2 relative">
          <div className="flex items-center gap-2">
            <BellRing className="w-3.5 h-3.5 text-gold-300" />
            <span className="text-2xs font-bold uppercase tracking-widest text-gold-300">Get your morning reminder</span>
            <button
              onClick={() => setDismissed(true)}
              className="ml-auto text-2xs text-ink-400 hover:text-ink-200 transition-colors uppercase tracking-wider"
              aria-label="Dismiss"
            >
              Later
            </button>
          </div>
          <p className="text-2xs text-ink-400 leading-relaxed">
            On iPhone, add Ivy to your Home Screen: tap <Share className="w-3 h-3 inline text-gold-300" /> then
            <span className="text-ink-200 font-medium"> Add to Home Screen </span><Plus className="w-3 h-3 inline text-ink-400" />, and open Ivy from there.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto mb-4 animate-fade-in">
      <button
        onClick={subscribe}
        disabled={isLoading}
        className="w-full surface rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:bg-ink-700/60 transition-colors active:scale-[0.98] disabled:opacity-60"
      >
        <div className="w-8 h-8 rounded-xl bg-[#46f0c8]/12 border border-[#46f0c8]/25 flex items-center justify-center shrink-0">
          {isLoading
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-gold-400/40 border-t-gold-400 animate-spin" />
            : <BellRing className="w-4 h-4 text-gold-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-50">Turn on morning reminders</p>
          <p className="text-2xs text-ink-400 mt-0.5">So Ivy can nudge you to arm before your deadline</p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="text-2xs text-ink-400 hover:text-ink-400 transition-colors uppercase tracking-wider shrink-0"
        >
          Later
        </span>
      </button>
    </div>
  )
}

function ArmedCard({ vn, dailySlice, currency }: { vn: VoiceNote | null; dailySlice: number; currency: 'GBP' | 'USD' }) {
  const sym = currency === 'GBP' ? '£' : '$'

  return (
    <div className="px-4 flex-1 flex flex-col gap-4 animate-fade-in">
      <DailyPushPrompt />
      {vn && (
        <div className="surface border-gold-400/25 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-2xs font-bold uppercase tracking-widest text-gold-300">This morning you said</span>
            {vn.duration > 0 && (
              <span className="text-2xs text-ink-400 font-mono ml-auto">
                {Math.floor(vn.duration / 60)}:{String(vn.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {vn.transcript ? (
            <p className="text-sm text-ink-50 leading-relaxed italic">&ldquo;{vn.transcript}&rdquo;</p>
          ) : (
            <p className="text-sm text-ink-400 leading-relaxed">Voice note recorded — transcript still processing.</p>
          )}
        </div>
      )}

      <div className="surface rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-400">What&rsquo;s next</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#2dd4bf]/12 border border-[#2dd4bf]/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-sage-300">1</span>
            </div>
            <p className="text-sm text-ink-200">
              Ivy has your commitment. Follow through and your {sym}{dailySlice} is safe.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-700/50 border border-ink-600 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-ink-400">2</span>
            </div>
            <p className="text-sm text-ink-400">
              This evening, Ivy reflects with you over a short check-in call.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto pb-4 flex gap-3">
        <Link href="/circles" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700/60 transition-colors text-sm text-ink-200">
            <Users className="w-4 h-4 text-gold-300" /> Circle
          </button>
        </Link>
        <Link href="/home" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700/60 transition-colors text-sm text-ink-200">
            <BarChart2 className="w-4 h-4 text-sage-300" /> Home
          </button>
        </Link>
      </div>
    </div>
  )
}

/* ── Morning intention hint ───────────────────────────────────────────────── */
/**
 * Surfaces the next-day commitment Ivy captured on the last call, so the
 * morning VN screen isn't a blank page: "Last night you said you'll…".
 * Dismissible — it's a prompt, not a prescription.
 */
function IntentionHint({ intention }: { intention: { text: string; capturedAt: string } }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  // "Last night" if it was captured within the last ~36h, else "Last time".
  const ageHours = (Date.now() - new Date(intention.capturedAt).getTime()) / 36e5
  const lead = ageHours <= 36 ? 'Last night you said you’ll' : 'Last time you said you’ll'

  return (
    <div className="w-full max-w-sm mx-auto mb-5 animate-fade-in">
      <div className="surface border-gold-400/25 rounded-2xl p-4 space-y-1.5 relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gold-300" />
          <span className="text-2xs font-bold uppercase tracking-widest text-gold-300">{lead}</span>
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto text-2xs text-ink-400 hover:text-ink-200 transition-colors uppercase tracking-wider"
            aria-label="Dismiss hint"
          >
            Dismiss
          </button>
        </div>
        <p className="text-sm text-ink-50 leading-relaxed italic">&ldquo;{intention.text}&rdquo;</p>
        <p className="text-2xs text-ink-400">Still the plan? Say it your way below.</p>
      </div>
    </div>
  )
}

/* ── Pre-cycle / no-config state ──────────────────────────────────────────── */
function NoStakeState({ hasConfig, weeklyAmount, currency }: { hasConfig: boolean; weeklyAmount: number | null; currency: 'GBP' | 'USD' }) {
  const sym = currency === 'GBP' ? '£' : '$'
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      {/* The sprout — a plant with nothing to grow from yet */}
      <div className="w-full max-w-[240px] h-[200px] -mb-2 flex items-center justify-center">
        <IvyVine days={[]} className="h-full w-auto opacity-80" />
      </div>
      {hasConfig ? (
        <>
          <p className="font-mono text-xl font-semibold uppercase text-ink-50 tracking-tight">Setting up your first run</p>
          <p className="text-sm text-ink-400 max-w-xs leading-relaxed">
            {weeklyAmount != null
              ? `Your first run goes live right after payment clears — a flat starter stake, no teeth on day one. It steps up to your ${sym}${weeklyAmount}/week from next week. Check back shortly.`
              : 'Your first run goes live as soon as payment clears. Check back shortly.'}
          </p>
          <Link href="/home">
            <button className="mt-2 px-5 py-3 rounded-2xl surface text-sm text-ink-200 hover:bg-ink-700/60 transition-colors">
              Back to home
            </button>
          </Link>
        </>
      ) : (
        <>
          <p className="font-mono text-xl font-semibold uppercase text-ink-50 tracking-tight">Set up your stake first</p>
          <p className="text-sm text-ink-400 max-w-xs leading-relaxed">
            Put money on the line so your daily commitment has teeth. Takes a minute.
          </p>
          <Link href="/stake-setup">
            <button className="relative overflow-hidden mt-2 px-6 py-3 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm uppercase">
              Set up my stake
            </button>
          </Link>
        </>
      )}
    </div>
  )
}

/* ── Root orchestrator ────────────────────────────────────────────────────── */
export function DailyLoopScreen() {
  const searchParams = useSearchParams()
  const actionParam = searchParams.get('action')
  const { user: authUser } = useAuthStore()
  const { height: viewportH } = useVisualViewport()

  const [state, setState] = useState<StakeState | null>(null)
  const [streak, setStreak] = useState(0)
  const [circleName, setCircleName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [armedJustNow, setArmedJustNow] = useState(false)
  // Live mic state — drives the LivingForm hero while you speak your intention.
  const [recording, setRecording] = useState(false)
  const [micLevel, setMicLevel] = useState(0)

  const loadState = useCallback(() => {
    return stakeApi.getState()
      .then((s) => setState(s))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    Promise.resolve(loadState()).finally(() => { if (alive) setLoading(false) })
    statsApi.getStreak().then((s) => { if (alive) setStreak(s.currentStreak ?? 0) }).catch(() => {})
    circlesApi.getMy().then((cs) => { if (alive) setCircleName(cs?.[0]?.name ?? null) }).catch(() => {})
    return () => { alive = false }
  }, [loadState])

  const onVoiceNoteSubmit = useCallback(() => {
    setArmedJustNow(true)
    // Refetch real state so armed status, today's VN, and counters reflect the server.
    loadState()
  }, [loadState])

  const name = authUser?.firstName ?? 'there'

  // Derive phase from real data + time of day.
  const isArmed = !!state?.today.isArmed || armedJustNow
  const isEvening = new Date().getHours() >= 17
  let phase: DailyLoopPhase = 'morning-unarmed'
  if (isEvening && actionParam !== 'record') phase = 'evening-review'
  else if (isArmed) phase = 'morning-armed'

  const cycle = state?.cycle ?? null
  const currency: 'GBP' | 'USD' = cycle?.currency ?? state?.config.currency ?? 'GBP'

  const stakeForBar: StakeStatus | null = cycle
    ? {
        weeklyAmount: cycle.weeklyAmount,
        dailySlice: cycle.dailySlice,
        currency,
        daysCompleted: cycle.daysCompleted,
        daysForfeited: cycle.daysForfeited,
        daysLeft: Math.max(0, cycle.daysInCycle - cycle.daysCompleted - cycle.daysForfeited),
        isFoundation: cycle.isFoundation,
      }
    : null

  const todayVN: VoiceNote | null = state?.today.voiceNote
    ? {
        id: state.today.voiceNote.id,
        duration: state.today.voiceNote.durationSec ?? 0,
        transcript: state.today.voiceNote.transcript ?? '',
        recordedAt: new Date(state.today.voiceNote.recordedAt),
      }
    : null

  const morningPrompt = `Morning. Your ${currency === 'GBP' ? '£' : '$'}${cycle?.dailySlice ?? ''} stake is live. What's the one thing you're taking on today — say it out loud.`

  // ── The vine hero — grown from the real week; glows brighter as you speak ──
  const week = state?.week ?? []
  const vineGlow = recording ? 1 + Math.min(micLevel, 1) * 0.65 : 1
  const vineStyle = {
    filter: `brightness(${vineGlow}) drop-shadow(0 0 ${Math.round(6 + micLevel * 22)}px rgba(70,240,200,${(0.15 + micLevel * 0.45).toFixed(2)}))`,
    transition: 'filter 120ms linear',
  }

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
    >
      {/* Fixed top chrome */}
      <div className="shrink-0 safe-top">
        <NavBar circleName={circleName} />
        <DayHeader phase={phase} name={name} streakDays={streak} />
        {stakeForBar && <StakeBar stake={stakeForBar} isArmed={isArmed || phase === 'evening-review'} />}
        {state?.today.sliceOutcome === 'FORFEITED' && state.today.workoutId && cycle && (
          <DisputeStrip
            workoutId={state.today.workoutId}
            dailySlice={cycle.dailySlice}
            currency={currency}
          />
        )}
      </div>

      {/* Content zone */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-[#46f0c8] animate-spin" />
        </div>
      ) : !cycle ? (
        <NoStakeState
          hasConfig={!!state?.config.hasConfig}
          weeklyAmount={state?.config.weeklyAmount ?? null}
          currency={currency}
        />
      ) : phase === 'evening-review' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative shrink-0 h-[24vh] min-h-[150px] flex items-center justify-center">
            <IvyVine days={week} className="h-full w-auto" />
          </div>
          <div className="flex-1 min-h-0">
            <EveningReview voiceNote={todayVN} isArmed={isArmed} />
          </div>
        </div>
      ) : phase === 'morning-armed' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative shrink-0 h-[30vh] min-h-[180px] flex items-center justify-center">
            <IvyVine days={week} className="h-full w-auto" />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <ArmedCard vn={todayVN} dailySlice={cycle.dailySlice} currency={currency} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* The vine — glows brighter as you speak your intention */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center" style={vineStyle}>
            <IvyVine days={week} className="max-h-full w-auto" />
          </div>
          <div className="shrink-0 px-4 pb-6">
            <DailyPushPrompt />
            {state?.today.suggestedIntention && (
              <IntentionHint intention={state.today.suggestedIntention} />
            )}
            <VoiceRecorder
              onSubmit={onVoiceNoteSubmit}
              prompt={morningPrompt}
              stakeAmount={cycle.dailySlice}
              currency={currency}
              onRecordingChange={setRecording}
              onLevel={setMicLevel}
            />
          </div>
        </div>
      )}
    </div>
  )
}
