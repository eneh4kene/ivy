'use client'

/**
 * /showcase — a NO-AUTH visual preview of the arcade daily loop with the
 * LivingForm hero. Renders the real components (StakeBar, VoiceRecorder,
 * EveningReview, LivingForm) with representative mock data so the screens can be
 * seen and felt without signing in. Touches nothing in the auth or API layer.
 * Safe to delete anytime.
 */

import { useState, useCallback } from 'react'
import { ArrowLeft, Users, Flame, BarChart2 } from 'lucide-react'
import { LivingForm, hashSeed, type LivingState } from '@/components/daily/LivingForm'
import { StakeBar } from '@/components/daily/StakeBar'
import { VoiceRecorder } from '@/components/daily/VoiceRecorder'
import { EveningReview } from '@/components/daily/EveningReview'
import type { StakeStatus } from '@/components/daily/types'

type Tab = 'morning' | 'armed' | 'evening' | 'seed'
const SEED = hashSeed('showcase-kene')

const stake: StakeStatus = {
  weeklyAmount: 42, dailySlice: 6, currency: 'GBP',
  daysLeft: 3, daysCompleted: 4, daysForfeited: 1, isFoundation: false,
}
const DAYS_KEPT = 12
const DAYS_FORFEITED = 1

/* ── shared chrome (mirrors DailyLoopScreen) ──────────────────────────────── */
function Chrome({ title, sub, armed }: { title: string; sub: string; armed: boolean }) {
  return (
    <div className="shrink-0 safe-top">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button className="w-9 h-9 rounded-xl glass-arcade flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white/80" />
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-arcade panel-cyan">
          <Users className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-2xs font-bold text-neon-cyan uppercase tracking-wider">Dawn Risers</span>
          <span className="neon-dot lime anim-breathe" />
        </div>
      </div>
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-baseline gap-3">
          <div className="min-w-0">
            <p className="text-2xs font-bold uppercase tracking-[0.22em] text-neon-cyan">Thursday</p>
            <h1 className="font-mono text-2xl font-semibold text-white tracking-tight uppercase mt-0.5">{title}</h1>
            <p className="text-sm text-white/45 mt-1">{sub}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0 glass-arcade rounded-xl px-2.5 py-1.5">
            <Flame className="w-3.5 h-3.5 text-neon-amber" />
            <span className="font-mono text-sm font-bold text-neon-amber tabular-nums led">×12</span>
          </div>
        </div>
      </div>
      <StakeBar stake={stake} isArmed={armed} />
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col arcade-screen relative overflow-hidden h-[780px] max-w-md mx-auto">
      {children}
    </div>
  )
}

/* ── Morning (interactive: record → bloom reacts to your voice) ────────────── */
function Morning() {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const onLevel = useCallback((l: number) => setLevel(l), [])
  const liveState: LivingState = recording ? 'speaking' : 'asleep'
  return (
    <Screen>
      <Chrome title="Morning · Kene" sub="25 June · Arm your day" armed={false} />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="relative flex-1 min-h-0">
          <LivingForm className="absolute inset-0" daysKept={DAYS_KEPT} daysForfeited={DAYS_FORFEITED}
            state={liveState} intensity={level} seed={SEED} />
        </div>
        <div className="shrink-0 px-4 pb-6">
          <VoiceRecorder
            onSubmit={() => {}}
            prompt="Your £6 is on the line. What's the one thing you're taking on today — say it out loud."
            stakeAmount={6}
            currency="GBP"
            onRecordingChange={setRecording}
            onLevel={onLevel}
          />
          <p className="text-center text-2xs text-white/35 mt-2 uppercase tracking-[0.18em]">
            demo · hold the mic and speak — the bloom reacts to your voice
          </p>
        </div>
      </div>
    </Screen>
  )
}

function Armed() {
  const sym = '£'
  return (
    <Screen>
      <Chrome title="Armed · Kene" sub="25 June · Evening reflection later" armed />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="relative shrink-0 h-[30vh] min-h-[180px]">
          <LivingForm className="absolute inset-0" daysKept={DAYS_KEPT} daysForfeited={DAYS_FORFEITED}
            state="armed" seed={SEED} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 space-y-4 pb-4">
          <div className="glass-arcade panel-cyan rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="neon-dot anim-breathe" />
              <span className="text-2xs font-bold uppercase tracking-widest text-neon-cyan">This morning you said</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed italic">
              &ldquo;I&apos;m finishing the redesign handoff before lunch — no meetings until it&apos;s shipped.&rdquo;
            </p>
          </div>
          <div className="glass-arcade rounded-2xl p-4">
            <p className="text-sm text-white/80 leading-relaxed">
              Ivy has your commitment, and your <span className="text-neon-lime led">{sym}6</span> is safe as long as you
              follow through. This evening she&rsquo;ll reflect with you over a short call.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl glass-arcade text-sm text-white/80">
              <Users className="w-4 h-4 text-neon-cyan" /> Circle
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl glass-arcade text-sm text-white/80">
              <BarChart2 className="w-4 h-4 text-neon-lime" /> Home
            </button>
          </div>
        </div>
      </div>
    </Screen>
  )
}

function Evening() {
  return (
    <Screen>
      <Chrome title="Evening · Kene" sub="Time to close out your day with Ivy" armed />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="relative shrink-0 h-[24vh] min-h-[150px]">
          <LivingForm className="absolute inset-0" daysKept={DAYS_KEPT} daysForfeited={DAYS_FORFEITED}
            state="bloom" palette="dusk" seed={SEED} detail={0.85} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <EveningReview
            isArmed
            voiceNote={{
              id: 'demo', duration: 23,
              transcript: "I'm finishing the redesign handoff before lunch — no meetings until it's shipped.",
              recordedAt: new Date(),
            }}
          />
        </div>
      </div>
    </Screen>
  )
}

function Seed() {
  return (
    <Screen>
      <Chrome title="Morning · Kene" sub="25 June · Arm your day" armed={false} />
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center gap-2">
        <div className="w-full max-w-[300px] h-[280px]">
          <LivingForm daysKept={0} state="asleep" seed={SEED} />
        </div>
        <h2 className="font-mono text-xl font-semibold uppercase tracking-tight text-white">Plant your stake to begin</h2>
        <p className="text-sm text-white/50 max-w-xs leading-relaxed">
          Put your own money on the line so your daily word has teeth. Then watch it grow.
        </p>
        <button className="relative overflow-hidden mt-3 px-6 py-3 rounded-2xl btn-arcade text-sm uppercase">
          <span className="arcade-sheen" /> Set up my stake
        </button>
      </div>
    </Screen>
  )
}

/* ── Page shell with tab switcher ─────────────────────────────────────────── */
export default function Showcase() {
  const [tab, setTab] = useState<Tab>('morning')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'morning', label: 'Morning' },
    { id: 'armed', label: 'Armed' },
    { id: 'evening', label: 'Evening' },
    { id: 'seed', label: 'New user' },
  ]
  return (
    <div className="theme-arcade min-h-[100dvh] py-6">
      {tab === 'morning' && <Morning />}
      {tab === 'armed' && <Armed />}
      {tab === 'evening' && <Evening />}
      {tab === 'seed' && <Seed />}

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 rounded-full glass-arcade">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-wider transition-colors ${
              tab === t.id ? 'bg-[#27e8ff] text-[#04050a]' : 'text-white/60 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
