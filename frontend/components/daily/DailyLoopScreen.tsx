'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart2, Flame } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { StakeBar } from './StakeBar'
import { VoiceRecorder } from './VoiceRecorder'
import { EveningChat } from './EveningChat'

import {
  MOCK_STAKE,
  MOCK_VOICE_NOTE,
  MOCK_CIRCLE,
  MOCK_EVENING_MESSAGES,
  MOCK_MORNING_PROMPT,
  MOCK_USER_NAME,
  MOCK_DAY_PROGRESS,
  type DailyLoopPhase,
  type VoiceNote,
} from '@/lib/mock/daily-loop'

/* ── Circle badge ─────────────────────────────────────────────────────────── */
function CircleBadge() {
  return (
    <Link href="/circles">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-periwinkle-500/10 border border-periwinkle-400/20 hover:bg-periwinkle-500/15 transition-colors">
        <Users className="w-3.5 h-3.5 text-periwinkle-400" />
        <span className="text-2xs font-semibold text-periwinkle-400 uppercase tracking-wider">
          {MOCK_CIRCLE.name}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-sage-400 pulse-sage" />
      </div>
    </Link>
  )
}

/* ── Top nav bar ──────────────────────────────────────────────────────────── */
function NavBar({
  phase,
  onPhaseToggle,
}: {
  phase: DailyLoopPhase
  onPhaseToggle: () => void
}) {
  const isEvening = phase === 'evening-review' || phase === 'evening-complete'
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <Link href="/dashboard">
        <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-ink-200" />
        </button>
      </Link>

      {/* Phase toggle — dev only, simulates morning/evening */}
      {isDev && (
        <div className="flex items-center gap-0.5 bg-ink-800 border border-ink-600 rounded-xl p-0.5">
          <button
            onClick={() => !isEvening || onPhaseToggle()}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !isEvening
                ? 'bg-gold-400 text-ink-900 shadow-sm'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Morning
          </button>
          <button
            onClick={() => isEvening || onPhaseToggle()}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isEvening
                ? 'bg-ink-700 text-ink-50 shadow-sm'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Evening
          </button>
        </div>
      )}

      <CircleBadge />
    </div>
  )
}

/* ── Day header ───────────────────────────────────────────────────────────── */
function DayHeader({ phase, streakDays = 9 }: { phase: DailyLoopPhase; streakDays?: number }) {
  const isEvening = phase === 'evening-review' || phase === 'evening-complete'
  const isArmed   = phase === 'morning-armed'

  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">
            {MOCK_DAY_PROGRESS.weekday}
          </p>
          <h1 className="font-display text-2xl text-ink-50 tracking-tight">
            {isEvening
              ? `Evening, ${MOCK_USER_NAME}`
              : isArmed
              ? `You're armed, ${MOCK_USER_NAME}`
              : `Morning, ${MOCK_USER_NAME}`}
          </h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {isEvening
              ? "Time to review your day with Ivy"
              : isArmed
              ? `${MOCK_DAY_PROGRESS.dateLabel} · Evening check-in at 6 pm`
              : `${MOCK_DAY_PROGRESS.dateLabel} · ${MOCK_DAY_PROGRESS.armingWindowLabel}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Flame className="w-3.5 h-3.5 text-ember-400" />
          <span className="font-mono text-sm font-medium text-ink-200 tabular-nums">{streakDays}</span>
          <span className="text-2xs text-ink-400">days</span>
        </div>
      </div>
    </div>
  )
}

/* ── Armed confirmation card ──────────────────────────────────────────────── */
function ArmedCard({ vn }: { vn: VoiceNote }) {
  const sym = MOCK_STAKE.currency === 'GBP' ? '£' : '$'
  const dur = `${Math.floor(vn.duration / 60)}:${String(vn.duration % 60).padStart(2, '0')}`

  return (
    <div className="px-4 flex-1 flex flex-col gap-4 animate-fade-in">
      {/* VN transcript card */}
      <div className="glass-gold rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-gold" />
          <span className="text-2xs font-semibold uppercase tracking-widest text-gold-400">
            This morning you said
          </span>
          <span className="text-2xs text-ink-400 font-mono ml-auto">{dur}</span>
        </div>
        <p className="text-sm text-ink-100 leading-relaxed font-display italic">
          "{vn.transcript}"
        </p>
      </div>

      {/* What happens next */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">What's next</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-sage-400/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-sage-400">1</span>
            </div>
            <p className="text-sm text-ink-200">
              Ivy has your commitment. Follow through and your {sym}{MOCK_STAKE.dailySlice} is safe.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-ink-400">2</span>
            </div>
            <p className="text-sm text-ink-400">
              Your evening review opens at 6 pm. Ivy will play this back to you.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-ink-400">3</span>
            </div>
            <p className="text-sm text-ink-400">
              Miss the evening review? Your buddy gets a nudge first.
            </p>
          </div>
        </div>
      </div>

      {/* Circle baton alert */}
      {MOCK_CIRCLE.userHoldsBaton && (
        <div className="glass rounded-2xl p-4 border border-periwinkle-400/30 animate-slide-in-bottom">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-periwinkle-400" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-periwinkle-400">
              You hold the baton
            </span>
          </div>
          <p className="text-sm text-ink-200">
            {MOCK_CIRCLE.name} is waiting on you. Complete your commitment to pass it.
          </p>
        </div>
      )}

      {/* Quick nav */}
      <div className="mt-auto pb-4 flex gap-3">
        <Link href="/circles" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700 transition-colors text-sm text-ink-200">
            <Users className="w-4 h-4 text-periwinkle-400" />
            Circle
          </button>
        </Link>
        <Link href="/dashboard" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700 transition-colors text-sm text-ink-200">
            <BarChart2 className="w-4 h-4 text-gold-400" />
            Dashboard
          </button>
        </Link>
      </div>
    </div>
  )
}

/* ── Root orchestrator ────────────────────────────────────────────────────── */
export function DailyLoopScreen() {
  const searchParams = useSearchParams()
  const actionParam  = searchParams.get('action')

  // Phase logic: in prod this comes from the API (is day armed? is it past 5pm?)
  const [phase, setPhase] = useState<DailyLoopPhase>(() => {
    const hour = new Date().getHours()
    if (actionParam === 'record') return 'morning-unarmed'
    if (hour >= 17) return 'evening-review'
    return 'morning-unarmed'
  })

  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null)

  const { height: viewportH } = useVisualViewport()

  const onVoiceNoteSubmit = useCallback((vn: VoiceNote) => {
    setVoiceNote(vn)
    // Transition to armed after a small ceremonial pause
    setTimeout(() => setPhase('morning-armed'), 600)
  }, [])

  const onCallIvy = useCallback(() => {
    // In prod: call api.calls.requestRescueCall()
    console.log('[mock] Requesting Ivy call')
  }, [])

  const togglePhase = useCallback(() => {
    if (phase === 'morning-unarmed' || phase === 'morning-armed') {
      setPhase('evening-review')
    } else {
      setPhase('morning-unarmed')
    }
  }, [phase])

  const isEvening = phase === 'evening-review' || phase === 'evening-complete'
  const isArmed   = phase === 'morning-armed'

  return (
    <div
      className="flex flex-col mesh-bg-subtle relative overflow-hidden"
      style={{
        // Use dvh to handle iOS address bar; fall back to 100vh
        height: viewportH > 0 ? `${viewportH}px` : '100dvh',
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.12) 0%, transparent 70%)' }}
      />
      {isEvening && (
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 w-64 h-64 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.12) 0%, transparent 70%)' }}
        />
      )}

      {/* Fixed top chrome */}
      <div className="shrink-0 safe-top">
        <NavBar phase={phase} onPhaseToggle={togglePhase} />
        <DayHeader phase={phase} />
        <StakeBar stake={MOCK_STAKE} isArmed={isArmed || isEvening} />
      </div>

      {/* ── Scrollable content zone ── */}
      {isEvening ? (
        /* Evening: full-bleed chat that manages its own scroll + input */
        <div className="flex-1 min-h-0">
          <EveningChat
            initialMessages={MOCK_EVENING_MESSAGES}
            voiceNote={voiceNote ?? MOCK_VOICE_NOTE}
            onCallIvy={onCallIvy}
          />
        </div>
      ) : isArmed ? (
        /* Daytime armed: static confirmation */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <ArmedCard vn={voiceNote ?? MOCK_VOICE_NOTE} />
        </div>
      ) : (
        /* Morning: VN recorder */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <VoiceRecorder
              onSubmit={onVoiceNoteSubmit}
              prompt={MOCK_MORNING_PROMPT}
              stakeAmount={MOCK_STAKE.dailySlice}
              currency={MOCK_STAKE.currency}
            />
          </div>
        </div>
      )}
    </div>
  )
}
