'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, BarChart2, Flame, Shield } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { StakeBar } from './StakeBar'
import { VoiceRecorder } from './VoiceRecorder'
import { EveningReview } from './EveningReview'
import { stakeApi, statsApi, circlesApi, type StakeState } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import type { DailyLoopPhase, VoiceNote, StakeStatus } from './types'

/* ── Circle badge ─────────────────────────────────────────────────────────── */
function CircleBadge({ name }: { name: string }) {
  return (
    <Link href="/circles">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-periwinkle-500/10 border border-periwinkle-400/20 hover:bg-periwinkle-500/15 transition-colors">
        <Users className="w-3.5 h-3.5 text-periwinkle-400" />
        <span className="text-2xs font-semibold text-periwinkle-400 uppercase tracking-wider">{name}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-sage-400 pulse-sage" />
      </div>
    </Link>
  )
}

/* ── Top nav bar ──────────────────────────────────────────────────────────── */
function NavBar({ circleName }: { circleName: string | null }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <Link href="/home">
        <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-ink-200" />
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
        <div>
          <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">{weekday}</p>
          <h1 className="font-display text-2xl text-ink-50 tracking-tight">
            {isEvening ? `Evening, ${name}` : isArmed ? `You're armed, ${name}` : `Morning, ${name}`}
          </h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {isEvening
              ? 'Time to close out your day with Ivy'
              : isArmed
              ? `${dateLabel} · Evening reflection later`
              : `${dateLabel} · Arm your day`}
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
function ArmedCard({ vn, dailySlice, currency }: { vn: VoiceNote | null; dailySlice: number; currency: 'GBP' | 'USD' }) {
  const sym = currency === 'GBP' ? '£' : '$'

  return (
    <div className="px-4 flex-1 flex flex-col gap-4 animate-fade-in">
      {vn && (
        <div className="glass-gold rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-gold" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-gold-400">This morning you said</span>
            {vn.duration > 0 && (
              <span className="text-2xs text-ink-400 font-mono ml-auto">
                {Math.floor(vn.duration / 60)}:{String(vn.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {vn.transcript ? (
            <p className="text-sm text-ink-100 leading-relaxed font-display italic">&ldquo;{vn.transcript}&rdquo;</p>
          ) : (
            <p className="text-sm text-ink-400 leading-relaxed">Voice note recorded — transcript still processing.</p>
          )}
        </div>
      )}

      <div className="surface rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">What&rsquo;s next</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-sage-400/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-2xs font-bold text-sage-400">1</span>
            </div>
            <p className="text-sm text-ink-200">
              Ivy has your commitment. Follow through and your {sym}{dailySlice} is safe.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center shrink-0 mt-0.5">
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
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700 transition-colors text-sm text-ink-200">
            <Users className="w-4 h-4 text-periwinkle-400" /> Circle
          </button>
        </Link>
        <Link href="/home" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl surface hover:bg-ink-700 transition-colors text-sm text-ink-200">
            <BarChart2 className="w-4 h-4 text-gold-400" /> Home
          </button>
        </Link>
      </div>
    </div>
  )
}

/* ── Pre-cycle / no-config state ──────────────────────────────────────────── */
function NoStakeState({ hasConfig, weeklyAmount, currency }: { hasConfig: boolean; weeklyAmount: number | null; currency: 'GBP' | 'USD' }) {
  const sym = currency === 'GBP' ? '£' : '$'
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gold-400/12 flex items-center justify-center">
        <Shield className="w-7 h-7 text-gold-400" />
      </div>
      {hasConfig ? (
        <>
          <p className="font-display text-xl text-ink-50">Your cycle starts Monday</p>
          <p className="text-sm text-ink-400 max-w-xs">
            {weeklyAmount != null
              ? `${sym}${weeklyAmount}/week goes on the line when your weekly cycle opens. Come back Monday morning to arm your first day.`
              : 'Your weekly stake cycle opens Monday morning.'}
          </p>
          <Link href="/home">
            <button className="mt-2 px-5 py-3 rounded-2xl surface text-sm text-ink-200 hover:bg-ink-700 transition-colors">
              Back to home
            </button>
          </Link>
        </>
      ) : (
        <>
          <p className="font-display text-xl text-ink-50">Set up your stake first</p>
          <p className="text-sm text-ink-400 max-w-xs">
            Put money on the line so your daily commitment has teeth. Takes a minute.
          </p>
          <Link href="/stake-setup">
            <button className="mt-2 px-5 py-3 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm glow-sm-gold hover:bg-gold-300 transition-colors">
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
        daysLeft: Math.max(0, 7 - cycle.daysCompleted - cycle.daysForfeited),
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

  return (
    <div
      className="flex flex-col mesh-bg-subtle relative overflow-hidden"
      style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.12) 0%, transparent 70%)' }}
      />
      {phase === 'evening-review' && (
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 w-64 h-64 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.12) 0%, transparent 70%)' }}
        />
      )}

      {/* Fixed top chrome */}
      <div className="shrink-0 safe-top">
        <NavBar circleName={circleName} />
        <DayHeader phase={phase} name={name} streakDays={streak} />
        {stakeForBar && <StakeBar stake={stakeForBar} isArmed={isArmed || phase === 'evening-review'} />}
      </div>

      {/* Content zone */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-gold-400 animate-spin" />
        </div>
      ) : !cycle ? (
        <NoStakeState
          hasConfig={!!state?.config.hasConfig}
          weeklyAmount={state?.config.weeklyAmount ?? null}
          currency={currency}
        />
      ) : phase === 'evening-review' ? (
        <div className="flex-1 min-h-0">
          <EveningReview voiceNote={todayVN} isArmed={isArmed} />
        </div>
      ) : phase === 'morning-armed' ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <ArmedCard vn={todayVN} dailySlice={cycle.dailySlice} currency={currency} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <VoiceRecorder
              onSubmit={onVoiceNoteSubmit}
              prompt={morningPrompt}
              stakeAmount={cycle.dailySlice}
              currency={currency}
            />
          </div>
        </div>
      )}
    </div>
  )
}
