'use client'

/**
 * Step 1 — Choose weekly stake amount.
 * Enforces £7/wk minimum (§9 decision 2).
 * Default £14/wk.
 *
 * MOCK DATA ONLY — no backend calls.
 */

import { useState } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { STAKE_CONFIG, dailySlice, annualCost } from '@/lib/mock/stake-setup'

interface StakeAmountStepProps {
  value: number
  onChange: (amount: number) => void
  onNext: () => void
}

export function StakeAmountStep({ value, onChange, onNext }: StakeAmountStepProps) {
  const [customInput, setCustomInput] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [touched, setTouched] = useState(false)

  const sym = STAKE_CONFIG.currencySymbol
  const daily = dailySlice(value)
  const annual = annualCost(value)
  const isBelowMin = value < STAKE_CONFIG.minWeekly
  const isDefault = value === STAKE_CONFIG.defaultWeekly

  const handlePreset = (amount: number) => {
    setIsCustom(false)
    setCustomInput('')
    onChange(amount)
    setTouched(true)
  }

  const handleCustomChange = (raw: string) => {
    setIsCustom(true)
    setCustomInput(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed)
    }
    setTouched(true)
  }

  const canProceed = !isBelowMin && value > 0

  return (
    <div className="flex flex-col gap-6">

      {/* Hero copy */}
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl text-ink-50 leading-tight">
          How much is on the line?
        </h2>
        <p className="text-sm text-ink-400 leading-relaxed">
          This is your money — not ours. You keep it when you follow through;
          it forfeits when you don't. The bigger the stake, the sharper the teeth.
        </p>
      </div>

      {/* Big amount display */}
      <div className="glass-gold rounded-2xl p-5 text-center space-y-1 border-gradient-gold">
        <p className="text-2xs font-semibold uppercase tracking-widest text-gold-400 mb-1">on the line each week</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="font-display text-5xl font-medium text-gold-300 tabular-nums">{sym}{value}</span>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className="text-xs text-ink-400">
            {sym}{daily.toFixed(0)}/day
          </span>
          <span className="w-1 h-1 rounded-full bg-ink-600" />
          <span className="text-xs text-ink-400">
            {sym}{annual} across a year
          </span>
        </div>
        {isDefault && (
          <p className="text-2xs text-gold-400/70 mt-1">Most people start here</p>
        )}
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Choose an amount</p>
        <div className="grid grid-cols-5 gap-2">
          {STAKE_CONFIG.presets.map((preset) => {
            const selected = !isCustom && value === preset
            return (
              <button
                key={preset}
                onClick={() => handlePreset(preset)}
                className={`py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 ${
                  selected
                    ? 'bg-gold-400 text-ink-900 glow-sm-gold'
                    : 'surface text-ink-200 hover:border-gold-400/30 hover:text-ink-50'
                }`}
              >
                {sym}{preset}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom input */}
      <div className="space-y-1.5">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Or enter your own</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-400">{sym}</span>
          <input
            type="number"
            min={STAKE_CONFIG.minWeekly}
            step={1}
            value={isCustom ? customInput : ''}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder={`${STAKE_CONFIG.minWeekly} minimum`}
            className={`w-full pl-8 pr-4 py-3 rounded-xl text-sm font-mono bg-ink-700 border transition-colors focus:outline-none ${
              isCustom && isBelowMin
                ? 'border-ember-400/60 focus:border-ember-400 text-ember-400'
                : isCustom
                ? 'border-gold-400/40 focus:border-gold-400 text-ink-50'
                : 'border-ink-600 focus:border-ink-400 text-ink-50'
            }`}
          />
          {isCustom && !isBelowMin && value > 0 && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xs text-sage-400">✓</span>
          )}
        </div>

        {/* Validation message */}
        {touched && isBelowMin && (
          <div className="flex items-center gap-1.5 mt-1">
            <AlertTriangle className="w-3 h-3 text-ember-400 shrink-0" />
            <p className="text-xs text-ember-400">
              Minimum is {sym}{STAKE_CONFIG.minWeekly}/week — the seriousness filter.
            </p>
          </div>
        )}
      </div>

      {/* What this means */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">What this means</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
            <p className="text-xs text-ink-200">
              Follow through every day → you keep all {sym}{value}. Plus a corporate donation fires for your chosen charity.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-ember-400 shrink-0 mt-0.5" />
            <p className="text-xs text-ink-200">
              Miss a day → that day's {sym}{daily.toFixed(0)} forfeits to the destination you pick next. No exceptions (except your one grace skip).
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-300 transition-all duration-200 active:scale-95 glow-gold"
      >
        Set {sym}{value}/week — continue
      </button>
    </div>
  )
}
