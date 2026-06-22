'use client'

/**
 * ExpressConfirmStep — the one-tap entry point to stake setup ("default-on").
 *
 * Most users don't need five screens of choices. We pre-fill smart defaults
 * (£14/week, Middle mode, arm by 09:30) and let them activate in a single tap.
 * Two valves keep it from feeling forced:
 *   • "Start at the £7 minimum instead" — the cheapest real stake, not a skip.
 *   • "Customise" — opens the full wizard for anyone who wants the dials.
 *   • "Not now" — defers the gate for this session (re-nudged on home later).
 *
 * Activation reuses the same saveConfig + card-on-file flow as ConfirmStep.
 */

import { useState } from 'react'
import { Sparkles, AlertTriangle, Clock, Shield } from 'lucide-react'
import { DEFAULT_STAKE_SETUP, STAKE_CONFIG, dailySlice } from '@/lib/mock/stake-setup'
import type { StakeSetupState } from '@/lib/mock/stake-setup'
import { activateStake } from '@/lib/stake'

interface ExpressConfirmStepProps {
  /** Called after activation succeeds without a redirect (card already on file). */
  onActivated: () => void
  /** Open the full multi-step wizard. */
  onCustomise: () => void
  /** Defer the gate for this session and leave setup. */
  onDefer: () => void
}

const sym = STAKE_CONFIG.currencySymbol

export function ExpressConfirmStep({ onActivated, onCustomise, onDefer }: ExpressConfirmStepProps) {
  const [busy, setBusy] = useState<null | 'default' | 'min'>(null)

  // Smart defaults — Middle mode forfeits to a vetted house charity, so we leave
  // the success charity unset (the backend default handles it). The user can pick
  // their own via "Customise".
  const defaults: StakeSetupState = DEFAULT_STAKE_SETUP
  const minState: StakeSetupState = { ...DEFAULT_STAKE_SETUP, weeklyAmount: STAKE_CONFIG.minWeekly }

  const handleActivate = async (which: 'default' | 'min') => {
    if (busy) return
    setBusy(which)
    try {
      const { redirected } = await activateStake(which === 'min' ? minState : defaults)
      if (redirected) return  // navigating to Stripe Checkout — let it unload
    } catch {
      setBusy(null)
      return
    }
    setBusy(null)
    onActivated()
  }

  const dailyDefault = dailySlice(defaults.weeklyAmount)

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Hero */}
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gold-400/10 border border-gold-400/25 flex items-center justify-center glow-gold">
          <Sparkles className="w-5 h-5 text-gold-300" />
        </div>
        <h2 className="font-display text-2xl text-ink-50 leading-tight">
          Put real skin in the game.
        </h2>
        <p className="text-sm text-ink-400 leading-relaxed">
          People who stake money show up far more often. We've set sensible defaults —
          activate in one tap, or tune every dial. Nothing is charged unless you miss a day.
        </p>
      </div>

      {/* Smart-default summary */}
      <div className="surface rounded-2xl px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
            <span className="font-mono text-gold-300 text-sm font-semibold">{sym}{defaults.weeklyAmount}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xs text-ink-400 uppercase tracking-widest">Weekly stake</p>
            <p className="text-sm font-medium text-gold-300 mt-0.5">
              {sym}{defaults.weeklyAmount}/week · {sym}{dailyDefault.toFixed(0)}/day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-ember-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xs text-ink-400 uppercase tracking-widest">Forfeit mode</p>
            <p className="text-sm font-medium text-ink-50 mt-0.5">Middle — goes to a vetted house charity</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-periwinkle-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xs text-ink-400 uppercase tracking-widest">Arming window</p>
            <p className="text-sm font-medium text-ink-50 mt-0.5">
              {defaults.armingWindowStart} → deadline {defaults.armingWindowEnd}
            </p>
          </div>
        </div>
      </div>

      {/* Grace reassurance */}
      <div className="surface rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
        <p className="text-xs text-ink-300 leading-relaxed">
          We save your card now — nothing today. Each week we place a hold for {sym}{defaults.weeklyAmount};
          only days you miss are captured. You get <span className="text-sage-400 font-medium">1 grace skip</span> a week.
        </p>
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => handleActivate('default')}
        disabled={busy !== null}
        className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 disabled:opacity-60 hover:bg-gold-300 transition-all duration-200 active:scale-95 glow-gold"
      >
        {busy === 'default' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-ink-900/40 border-t-ink-900 animate-spin" />
            Setting up…
          </span>
        ) : (
          `Activate my stake — ${sym}${defaults.weeklyAmount}/week`
        )}
      </button>

      {/* £7 minimum valve */}
      <button
        onClick={() => handleActivate('min')}
        disabled={busy !== null}
        className="w-full py-3 rounded-2xl text-sm text-ink-200 surface hover:bg-ink-700 transition-all disabled:opacity-60"
      >
        {busy === 'min' ? 'Setting up…' : `Start at the ${sym}${STAKE_CONFIG.minWeekly} minimum instead`}
      </button>

      {/* Customise + defer */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <button
          onClick={onCustomise}
          disabled={busy !== null}
          className="text-2xs text-ink-300 hover:text-ink-100 transition-colors disabled:opacity-60"
        >
          Customise every dial
        </button>
        <span className="text-ink-700">·</span>
        <button
          onClick={onDefer}
          disabled={busy !== null}
          className="text-2xs text-ink-500 hover:text-ink-300 transition-colors disabled:opacity-60"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
