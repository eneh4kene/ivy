'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart2, Flame, Sparkles, BellRing, Share, Plus } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { StakeBar } from './StakeBar'
import { VoiceRecorder } from './VoiceRecorder'
import { EveningReview } from './EveningReview'
import { LivingForm, hashSeed, type LivingState } from './LivingForm'
import { stakeApi, statsApi, circlesApi, type StakeState } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { isIOS, isStandalone } from '@/lib/pwa'
import type { DailyLoopPhase, VoiceNote, StakeStatus } from './types'

/* ── Circle badge ─────────────────────────────────────────────────────────── */
function CircleBadge({ name }: { name: string }) {
  return (
    <Link href="/circles">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-arcade panel-cyan hover:bg-white/[0.06] transition-colors">
        <Users className="w-3.5 h-3.5 text-neon-cyan" />
        <span className="text-2xs font-bold text-neon-cyan uppercase tracking-wider">{name}</span>
        <span className="neon-dot lime anim-breathe" />
      </div>
    </Link>
  )
}

/* ── Top nav bar ──────────────────────────────────────────────────────────── */
function NavBar({ circleName }: { circleName: string | null }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <Link href="/home">
        <button className="w-9 h-9 rounded-xl glass-arcade flex items-center justify-center hover:bg-white/[0.07] transition-colors">
          <ArrowLeft className="w-4 h-4 text-white/80" />
        </button>
      </Link>
      {circleName && <CircleBadge name={circleName} />}
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
      <div className="flex items-baseline gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-[0.22em] text-neon-cyan">{weekday}</p>
          <h1 className="font-mono text-2xl font-semibold text-white tracking-tight uppercase mt-0.5">
            {isEvening ? `Evening · ${name}` : isArmed ? `Armed · ${name}` : `Morning · ${name}`}
          </h1>
          <p className="text-sm text-white/45 mt-1">
            {isEvening
              ? 'Time to close out your day with Ivy'
              : isArmed
              ? `${dateLabel} · Evening reflection later`
              : `${dateLabel} · Arm your day`}
          </p>
        </div>
        {/* COMBO ×N */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0 glass-arcade rounded-xl px-2.5 py-1.5">
          <Flame className="w-3.5 h-3.5 text-neon-amber" />
          <span className="font-mono text-sm font-bold text-neon-amber tabular-nums led">×{streakDays}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Armed confirmation card ──────────────────────────────────────────────── */
/* ── Push opt-in (arcade-themed, daily screen) ────────────────────────────── */
/**
 * The whole stake loop depends on the user arming each morning, and the morning
 * reminder ladder is push-first. Plenty of users never hit the stake-setup screen
 * where EnablePushCard lives (or armed before it existed), so they get a single
 * morning SMS and silence. This surfaces the opt-in right on the daily screen —
 * the page every reminder deep-links to — so future nudges actually land.
 *
 * Self-hides once notifications are on. Dismissible per-session so it's a nudge,
 * not a nag. Styled to match the arcade daily screen (not the dawn EnablePushCard).
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
        <div className="glass-arcade rounded-2xl p-4 space-y-2 relative">
          <div className="flex items-center gap-2">
            <BellRing className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-2xs font-bold uppercase tracking-widest text-neon-cyan">Get your morning reminder</span>
            <button
              onClick={() => setDismissed(true)}
              className="ml-auto text-2xs text-white/35 hover:text-white/70 transition-colors uppercase tracking-wider"
              aria-label="Dismiss"
            >
              Later
            </button>
          </div>
          <p className="text-2xs text-white/55 leading-relaxed">
            On iPhone, add Ivy to your Home Screen: tap <Share className="w-3 h-3 inline text-neon-cyan" /> then
            <span className="text-white/80 font-medium"> Add to Home Screen </span><Plus className="w-3 h-3 inline text-white/60" />, and open Ivy from there.
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
        className="w-full glass-arcade rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.07] transition-colors active:scale-[0.98] disabled:opacity-60"
      >
        <div className="w-8 h-8 rounded-xl bg-[#27e8ff]/12 border border-[#27e8ff]/25 flex items-center justify-center shrink-0">
          {isLoading
            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-neon-cyan/40 border-t-neon-cyan animate-spin" />
            : <BellRing className="w-4 h-4 text-neon-cyan" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90">Turn on morning reminders</p>
          <p className="text-2xs text-white/45 mt-0.5">So Ivy can nudge you to arm before your deadline</p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="text-2xs text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider shrink-0"
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
        <div className="glass-arcade panel-cyan rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="neon-dot anim-breathe" />
            <span className="text-2xs font-bold uppercase tracking-widest text-neon-cyan">This morning you said</span>
            {vn.duration > 0 && (
              <span className="text-2xs text-hud font-mono ml-auto led">
                {Math.floor(vn.duration / 60)}:{String(vn.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {vn.transcript ? (
            <p className="text-sm text-white/90 leading-relaxed italic">&ldquo;{vn.transcript}&rdquo;</p>
          ) : (
            <p className="text-sm text-white/45 leading-relaxed">Voice note recorded — transcript still processing.</p>
          )}
        </div>
      )}

      <div className="glass-arcade rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-hud">What&rsquo;s next</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#c6ff44]/12 border border-[#c6ff44]/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-neon-lime">1</span>
            </div>
            <p className="text-sm text-white/80">
              Ivy has your commitment. Follow through and your {sym}{dailySlice} is safe.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-white/45">2</span>
            </div>
            <p className="text-sm text-white/45">
              This evening, Ivy reflects with you over a short check-in call.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto pb-4 flex gap-3">
        <Link href="/circles" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl glass-arcade hover:bg-white/[0.07] transition-colors text-sm text-white/80">
            <Users className="w-4 h-4 text-neon-cyan" /> Circle
          </button>
        </Link>
        <Link href="/home" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl glass-arcade hover:bg-white/[0.07] transition-colors text-sm text-white/80">
            <BarChart2 className="w-4 h-4 text-neon-lime" /> Home
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
      <div className="glass-arcade panel-cyan rounded-2xl p-4 space-y-1.5 relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-2xs font-bold uppercase tracking-widest text-neon-cyan">{lead}</span>
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto text-2xs text-white/35 hover:text-white/70 transition-colors uppercase tracking-wider"
            aria-label="Dismiss hint"
          >
            Dismiss
          </button>
        </div>
        <p className="text-sm text-white/90 leading-relaxed italic">&ldquo;{intention.text}&rdquo;</p>
        <p className="text-2xs text-hud">Still the plan? Say it your way below.</p>
      </div>
    </div>
  )
}

/* ── Pre-cycle / no-config state ──────────────────────────────────────────── */
function NoStakeState({ hasConfig, weeklyAmount, currency, seed }: { hasConfig: boolean; weeklyAmount: number | null; currency: 'GBP' | 'USD'; seed: number }) {
  const sym = currency === 'GBP' ? '£' : '$'
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      {/* Signature LivingForm seed — the plant before it has anything to grow from */}
      <div className="w-full max-w-[280px] h-[240px] -mb-2">
        <LivingForm daysKept={0} daysForfeited={0} state="asleep" seed={seed} />
      </div>
      {hasConfig ? (
        <>
          <p className="font-mono text-xl font-semibold uppercase text-white tracking-tight">Setting up your first run</p>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            {weeklyAmount != null
              ? `Your first run goes live right after payment clears — a flat starter stake, no teeth on day one. It steps up to your ${sym}${weeklyAmount}/week from next week. Check back shortly.`
              : 'Your first run goes live as soon as payment clears. Check back shortly.'}
          </p>
          <Link href="/home">
            <button className="mt-2 px-5 py-3 rounded-2xl glass-arcade text-sm text-white/80 hover:bg-white/[0.07] transition-colors">
              Back to home
            </button>
          </Link>
        </>
      ) : (
        <>
          <p className="font-mono text-xl font-semibold uppercase text-white tracking-tight">Set up your stake first</p>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            Put money on the line so your daily commitment has teeth. Takes a minute.
          </p>
          <Link href="/stake-setup">
            <button className="relative overflow-hidden mt-2 px-6 py-3 rounded-2xl btn-arcade text-sm uppercase">
              <span className="arcade-sheen" />
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

  // ── LivingForm hero: geometry grown from real follow-through ──
  // daysCompleted → living lime leaves; daysForfeited → magenta scars; the crown
  // bloom is closed when unarmed, half-open when armed, and flares to your live
  // voice while recording. Seed is stable per user so each plant is unique.
  const livingSeed = hashSeed(authUser?.id ?? authUser?.email ?? 'ivy')
  const livingState: LivingState =
    phase === 'evening-review' ? 'bloom'
    : phase === 'morning-armed' ? 'armed'
    : recording ? 'speaking'
    : 'asleep'
  const livingPalette: 'dawn' | 'dusk' = phase === 'evening-review' ? 'dusk' : 'dawn'
  const daysKept = cycle?.daysCompleted ?? 0
  const daysForfeited = cycle?.daysForfeited ?? 0

  return (
    <div
      className="flex flex-col arcade-screen relative overflow-hidden"
      style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
    >
      {/* Fixed top chrome */}
      <div className="shrink-0 safe-top">
        <NavBar circleName={circleName} />
        <DayHeader phase={phase} name={name} streakDays={streak} />
        {stakeForBar && <StakeBar stake={stakeForBar} isArmed={isArmed || phase === 'evening-review'} />}
      </div>

      {/* Content zone */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-white/10 border-t-[#27e8ff] animate-spin" />
        </div>
      ) : !cycle ? (
        <NoStakeState
          hasConfig={!!state?.config.hasConfig}
          weeklyAmount={state?.config.weeklyAmount ?? null}
          currency={currency}
          seed={livingSeed}
        />
      ) : phase === 'evening-review' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative shrink-0 h-[24vh] min-h-[150px]">
            <LivingForm
              className="absolute inset-0"
              daysKept={daysKept}
              daysForfeited={daysForfeited}
              state={livingState}
              palette={livingPalette}
              seed={livingSeed}
              detail={0.85}
            />
          </div>
          <div className="flex-1 min-h-0">
            <EveningReview voiceNote={todayVN} isArmed={isArmed} />
          </div>
        </div>
      ) : phase === 'morning-armed' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative shrink-0 h-[30vh] min-h-[180px]">
            <LivingForm
              className="absolute inset-0"
              daysKept={daysKept}
              daysForfeited={daysForfeited}
              state="armed"
              palette={livingPalette}
              seed={livingSeed}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <ArmedCard vn={todayVN} dailySlice={cycle.dailySlice} currency={currency} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Living hero — grows as you speak your intention */}
          <div className="relative flex-1 min-h-0">
            <LivingForm
              className="absolute inset-0"
              daysKept={daysKept}
              daysForfeited={daysForfeited}
              state={livingState}
              intensity={micLevel}
              palette={livingPalette}
              seed={livingSeed}
            />
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
