'use client'

/**
 * StakeSetupScreen — stake onboarding ("default-on + one-tap").
 *
 * Entry is the ExpressConfirmStep one-tap landing with smart defaults (£14/wk,
 * Middle, arm by 09:30) plus a £7-minimum valve and a "Not now" defer. Tapping
 * "Customise" drops into the full multi-step wizard below.
 *
 * Wizard steps (§2, §3, §9 of docs/product-pricing-rework.md):
 *   1. Choose weekly stake (≥ £7/wk min, default £14)
 *   2. Pick forfeit mode (MIDDLE / SAVAGE)
 *   3. Success charity (who benefits when you show up)
 *   4. Disliked charity — SAVAGE only (anti-charity)
 *   5. Arming window (HH:MM deadline)
 *   6. Confirm — saves stake config + saves a card via subscription checkout.
 *      The weekly auth hold is placed by the backend at the start of each cycle
 *      (stake.service.openStakeCycle), not on this screen.
 */

import { useState, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import Link from 'next/link'

import { StakeAmountStep }    from './StakeAmountStep'
import { ForfeitModeStep }    from './ForfeitModeStep'
import { CharitySelectStep }  from './CharitySelectStep'
import { ArmingWindowStep }   from './ArmingWindowStep'
import { ConfirmStep }        from './ConfirmStep'
import { ExpressConfirmStep } from './ExpressConfirmStep'
import { deferStakeGate }     from '@/lib/stake'

import {
  DEFAULT_STAKE_SETUP,
  getStepsForMode,
  type StakeSetupStep,
  type StakeSetupState,
} from '@/lib/mock/stake-setup'

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ steps, currentIndex }: { steps: StakeSetupStep[]; currentIndex: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < currentIndex
              ? 'w-4 h-1.5 bg-gold-400'
              : i === currentIndex
              ? 'w-5 h-1.5 bg-gold-400 pulse-gold'
              : 'w-1.5 h-1.5 bg-ink-600'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ state }: { state: StakeSetupState }) {
  const sym = '£'
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-8 px-6 text-center page-enter-scale mesh-bg">
      {/* Glow orbs */}
      <div
        className="pointer-events-none fixed -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.18) 0%, transparent 70%)' }}
      />

      <div className="space-y-2">
        {/* Trophy glyph */}
        <div className="w-20 h-20 mx-auto rounded-full bg-gold-400/10 border border-gold-400/25 flex items-center justify-center glow-gold mb-4">
          <span className="text-3xl">🏆</span>
        </div>
        <h2 className="font-display text-3xl text-ink-50">Stake armed.</h2>
        <p className="text-sm text-ink-400 leading-relaxed max-w-xs mx-auto">
          {sym}{state.weeklyAmount} is authorised. Your morning prompt arrives at {state.armingWindowStart}.
          Show up every day and you keep it all.
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        <span className="glass-gold rounded-xl px-3 py-1.5 text-xs text-gold-300 font-mono">
          {sym}{state.weeklyAmount}/wk on the line
        </span>
        <span className="glass rounded-xl px-3 py-1.5 text-xs text-ink-200">
          {state.forfeitMode === 'SAVAGE' ? '😬 Savage mode' : '🏠 Middle mode'}
        </span>
        <span className="glass rounded-xl px-3 py-1.5 text-xs text-ink-200 font-mono">
          Arm by {state.armingWindowEnd}
        </span>
      </div>

      {/* CTA */}
      <div className="space-y-3 w-full max-w-xs">
        <Link href="/daily">
          <button className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-95">
            Go to today's daily loop
          </button>
        </Link>
        <Link href="/circles">
          <button className="w-full py-3 rounded-2xl text-sm text-ink-300 surface hover:bg-ink-700 transition-all">
            See your Circle
          </button>
        </Link>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function StakeSetupScreen() {
  const router = useRouter()
  // 'express' is the default-on one-tap landing; 'wizard' is the full step flow,
  // opened only when the user taps "Customise".
  const [mode, setMode] = useState<'express' | 'wizard'>('express')
  const [formState, setFormState] = useState<StakeSetupState>(DEFAULT_STAKE_SETUP)
  const [stepHistory, setStepHistory] = useState<StakeSetupStep[]>(['stake-amount'])
  const [done, setDone] = useState(false)

  const { height: viewportH } = useVisualViewport()

  const handleDefer = useCallback(() => {
    // "Not now" — don't trap the user in a redirect loop; remember the defer for
    // this session (home shows a re-nudge instead) and return to the dashboard.
    deferStakeGate()
    router.push('/dashboard')
  }, [router])

  const steps = getStepsForMode(formState.forfeitMode)
  const currentStep = stepHistory[stepHistory.length - 1]
  const currentIndex = steps.indexOf(currentStep)

  const goNext = useCallback(() => {
    const nextIdx = steps.indexOf(currentStep) + 1
    if (nextIdx < steps.length) {
      setStepHistory((prev) => [...prev, steps[nextIdx]])
    }
  }, [currentStep, steps])

  const goBack = useCallback(() => {
    if (stepHistory.length > 1) {
      setStepHistory((prev) => prev.slice(0, -1))
    }
  }, [stepHistory])

  const jumpTo = useCallback((step: StakeSetupStep) => {
    setStepHistory((prev) => {
      const idx = prev.indexOf(step)
      if (idx !== -1) return prev.slice(0, idx + 1)
      return [...prev, step]
    })
  }, [])

  // When forfeit mode changes, rebuild steps and reset history from that point
  const handleForfeitModeChange = (mode: typeof formState.forfeitMode) => {
    setFormState((s) => ({ ...s, forfeitMode: mode, dislikedCharityId: null }))
  }

  if (done) return <DoneScreen state={formState} />

  // ── Default-on one-tap landing ──
  if (mode === 'express') {
    return (
      <div
        className="flex flex-col mesh-bg-subtle overflow-hidden"
        style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
      >
        <div
          className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.1) 0%, transparent 70%)' }}
        />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain safe-top">
          <div className="px-4 pb-10">
            <ExpressConfirmStep
              onActivated={() => setDone(true)}
              onCustomise={() => setMode('wizard')}
              onDefer={handleDefer}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col mesh-bg-subtle overflow-hidden"
      style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
    >
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-35"
        style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.1) 0%, transparent 70%)' }}
      />

      {/* ── Fixed top chrome ── */}
      <div className="shrink-0 safe-top">
        <div className="flex items-center gap-3 px-4 pt-3 pb-4">
          {stepHistory.length > 1 ? (
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          ) : (
            <button
              onClick={() => setMode('express')}
              className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          )}
          <div className="flex-1 flex items-center justify-center">
            <ProgressDots steps={steps} currentIndex={currentIndex} />
          </div>
          <div className="w-9 h-9 flex items-center justify-center">
            <span className="text-2xs text-ink-400 font-mono">
              {currentIndex + 1}/{steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-10 pt-2">
          <div className="page-enter" key={currentStep}>
            {currentStep === 'stake-amount' && (
              <StakeAmountStep
                value={formState.weeklyAmount}
                onChange={(v) => setFormState((s) => ({ ...s, weeklyAmount: v }))}
                onNext={goNext}
              />
            )}

            {currentStep === 'forfeit-mode' && (
              <ForfeitModeStep
                value={formState.forfeitMode}
                onChange={handleForfeitModeChange}
                onNext={goNext}
              />
            )}

            {currentStep === 'success-charity' && (
              <CharitySelectStep
                mode="success"
                value={formState.successCharityId}
                onChange={(id) => setFormState((s) => ({ ...s, successCharityId: id }))}
                onNext={goNext}
              />
            )}

            {currentStep === 'disliked-charity' && (
              <CharitySelectStep
                mode="savage"
                value={formState.dislikedCharityId}
                onChange={(id) => setFormState((s) => ({ ...s, dislikedCharityId: id }))}
                onNext={goNext}
              />
            )}

            {currentStep === 'arming-window' && (
              <ArmingWindowStep
                windowStart={formState.armingWindowStart}
                windowEnd={formState.armingWindowEnd}
                onChangeStart={(v) => setFormState((s) => ({ ...s, armingWindowStart: v }))}
                onChangeEnd={(v) => setFormState((s) => ({ ...s, armingWindowEnd: v }))}
                onNext={goNext}
              />
            )}

            {currentStep === 'confirm' && (
              <ConfirmStep
                state={formState}
                onConfirm={() => setDone(true)}
                onEdit={jumpTo}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
