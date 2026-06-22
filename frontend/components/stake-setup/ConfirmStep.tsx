'use client'

/**
 * Step 5 — Confirm & arm. Final summary before the stake goes live.
 *
 * Tapping "Arm" does two things:
 *   1. stakeApi.saveConfig(...) — persists the stake config, which makes the user
 *      eligible for the weekly openStakeCyclesForActiveUsers cron.
 *   2. paymentsApi.createCheckoutSession('PRO') — subscription checkout, which
 *      ALSO saves a reusable card to the Stripe customer (already-subscribed users
 *      skip this).
 *
 * The actual auth hold is NOT placed here. At the start of each week the backend
 * (stake.service.openStakeCycle) places an off-session manual-capture hold for
 * the weekly amount against that saved card. Only forfeited slices are captured
 * at settlement; the rest is released. Copy below must reflect that timing.
 */

import { useState } from 'react'
import { Shield, AlertTriangle, Clock, Heart } from 'lucide-react'
import { FORFEIT_OPTIONS, dailySlice } from '@/lib/mock/stake-setup'
import type { StakeSetupState } from '@/lib/mock/stake-setup'
import { activateStake } from '@/lib/stake'

interface ConfirmStepProps {
  state: StakeSetupState
  onConfirm: () => void
  onEdit: (step: 'stake-amount' | 'forfeit-mode' | 'success-charity' | 'disliked-charity' | 'arming-window') => void
}

function ConfirmRow({
  icon,
  label,
  value,
  onEdit,
  accent = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onEdit: () => void
  accent?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-ink-700/60 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xs text-ink-400 uppercase tracking-widest">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${accent ? 'text-gold-300' : 'text-ink-50'}`}>
          {value}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 text-2xs text-ink-400 hover:text-ink-200 transition-colors px-2 py-1 rounded-lg hover:bg-ink-700"
      >
        Edit
      </button>
    </div>
  )
}

export function ConfirmStep({ state, onConfirm, onEdit }: ConfirmStepProps) {
  const [confirming, setConfirming] = useState(false)

  const sym = '£'
  const daily = dailySlice(state.weeklyAmount)
  // Names are captured at selection time (ids are real DB ids saved to the config).
  const successCharityName = state.successCharityId ? state.successCharityName : null
  const dislikedCharityName = state.dislikedCharityId ? state.dislikedCharityName : null
  const forfeitOpt = FORFEIT_OPTIONS.find((o) => o.mode === state.forfeitMode)!

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      // Persists the stake config (eligibility for the weekly openStakeCycle cron)
      // and saves a reusable card via subscription checkout. See lib/stake.ts.
      const { redirected } = await activateStake(state)
      if (redirected) return  // navigating to Stripe Checkout — let it unload
    } catch {
      // saveConfig validation error — let the user fix it before retrying.
      setConfirming(false)
      return
    }
    setConfirming(false)
    onConfirm()
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Hero */}
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl text-ink-50 leading-tight">
          Your stake is set.<br />
          <span className="text-gradient-gold">Ready to arm?</span>
        </h2>
        <p className="text-sm text-ink-400 leading-relaxed">
          Review everything below, then we'll save your card and set your stake live.
          Your weekly hold is placed at the start of each week — nothing is charged
          unless you miss a day.
        </p>
      </div>

      {/* Summary card */}
      <div className="surface rounded-2xl px-4 pt-2 pb-1">
        <ConfirmRow
          icon={<span className="font-mono text-gold-300 text-sm font-semibold">{sym}{state.weeklyAmount}</span>}
          label="Weekly stake"
          value={`${sym}${state.weeklyAmount}/week · ${sym}${daily.toFixed(0)}/day`}
          onEdit={() => onEdit('stake-amount')}
          accent
        />
        <ConfirmRow
          icon={<AlertTriangle className="w-4 h-4 text-ember-400" />}
          label="Forfeit mode"
          value={`${forfeitOpt.label} — ${forfeitOpt.sublabel}`}
          onEdit={() => onEdit('forfeit-mode')}
        />
        {dislikedCharityName && (
          <ConfirmRow
            icon={<span className="text-sm">😬</span>}
            label="Anti-charity (Savage)"
            value={dislikedCharityName}
            onEdit={() => onEdit('disliked-charity')}
          />
        )}
        {successCharityName && (
          <ConfirmRow
            icon={<Heart className="w-4 h-4 text-sage-400" />}
            label="Success charity"
            value={successCharityName}
            onEdit={() => onEdit('success-charity')}
          />
        )}
        <ConfirmRow
          icon={<Clock className="w-4 h-4 text-periwinkle-400" />}
          label="Arming window"
          value={`${state.armingWindowStart} → deadline ${state.armingWindowEnd}`}
          onEdit={() => onEdit('arming-window')}
        />
      </div>

      {/* What happens now */}
      <div className="glass-gold rounded-2xl p-4 space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-widest text-gold-400">How your stake works</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-gold-400/15 flex items-center justify-center text-2xs font-bold text-gold-400 shrink-0 mt-0.5">1</div>
            <p className="text-xs text-ink-200">
              We save your card now — nothing is charged today.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-gold-400/15 flex items-center justify-center text-2xs font-bold text-gold-400 shrink-0 mt-0.5">2</div>
            <p className="text-xs text-ink-200">
              At the start of each week we place a hold for {sym}{state.weeklyAmount} — earmarked, not charged. You'll see it as a pending hold.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-400 shrink-0 mt-0.5">3</div>
            <p className="text-xs text-ink-200">
              Each day you arm (voice note before {state.armingWindowEnd}), that day's {sym}{daily.toFixed(0)} is safe.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-ember-400/12 flex items-center justify-center text-2xs font-bold text-ember-400 shrink-0 mt-0.5">4</div>
            <p className="text-xs text-ink-200">
              At week's end, only forfeited slices are captured. The rest is released back to you.
            </p>
          </div>
        </div>
      </div>

      {/* Grace skip notice */}
      <div className="surface rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
        <p className="text-xs text-ink-300 leading-relaxed">
          You have <span className="text-sage-400 font-medium">1 grace skip</span> per week — for illness or genuine emergencies.
          It suppresses one forfeit. Don't save it for laziness.
        </p>
      </div>

      {/* Arm CTA */}
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 disabled:opacity-60 hover:bg-gold-300 transition-all duration-200 active:scale-95 glow-gold relative overflow-hidden"
      >
        {confirming ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-ink-900/40 border-t-ink-900 animate-spin" />
            Setting up…
          </span>
        ) : (
          `Arm my stake — ${sym}${state.weeklyAmount}/week`
        )}
      </button>

      <p className="text-center text-2xs text-ink-400">
        Nothing is charged unless you miss a day. You can pause or cancel your stake at cycle end.
      </p>
    </div>
  )
}
