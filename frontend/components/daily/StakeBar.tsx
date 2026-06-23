'use client'

import { Shield, AlertTriangle } from 'lucide-react'
import type { StakeStatus } from './types'

interface StakeBarProps {
  stake: StakeStatus
  isArmed: boolean
}

/** Compact stake-status strip at the top of the daily screen. */
export function StakeBar({ stake, isArmed }: StakeBarProps) {
  const pctComplete = (stake.daysCompleted / (stake.daysLeft + stake.daysCompleted + stake.daysForfeited)) * 100

  const sym = stake.currency === 'GBP' ? '£' : '$'

  return (
    <div className="w-full px-4 pt-2 pb-3">
      <div className="glass-gold rounded-2xl px-4 py-3 flex items-center gap-3">
        {/* icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
          isArmed
            ? 'bg-sage-400/15'
            : 'bg-ember-400/15'
        }`}>
          {isArmed
            ? <Shield className="w-4 h-4 text-sage-400" />
            : <AlertTriangle className="w-4 h-4 text-ember-400" />
          }
        </div>

        {/* stake info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-mono text-sm font-medium text-gold-300 tracking-tight">
              {sym}{stake.dailySlice} today
            </span>
            <span className="text-2xs text-ink-400 uppercase tracking-widest">
              · {sym}{stake.weeklyAmount}/wk on the line
            </span>
          </div>

          {/* week progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: stake.daysCompleted + stake.daysLeft + stake.daysForfeited }, (_, i) => {
              const status = i < stake.daysCompleted
                ? 'complete'
                : i < stake.daysCompleted + (isArmed ? 1 : 0)
                ? 'armed'
                : i < stake.daysCompleted + stake.daysForfeited + (isArmed ? 1 : 0)
                ? 'forfeit'
                : 'pending'
              return (
                <span
                  key={i}
                  className={`inline-block rounded-full transition-all duration-300 ${
                    status === 'complete' ? 'w-5 h-1.5 bg-sage-400' :
                    status === 'armed'   ? 'w-5 h-1.5 bg-gold-400 animate-pulse' :
                    status === 'forfeit' ? 'w-5 h-1.5 bg-ember-500/70' :
                                          'w-3 h-1.5 bg-ink-600'
                  }`}
                />
              )
            })}
            <span className="text-2xs text-ink-400 ml-1">
              {stake.daysLeft}d left
            </span>
          </div>
        </div>

        {/* armed badge */}
        {isArmed && (
          <span className="shrink-0 text-2xs font-semibold uppercase tracking-widest text-sage-400 px-2 py-0.5 rounded-lg bg-sage-400/10 border border-sage-400/20">
            Armed
          </span>
        )}
        {!isArmed && (
          <span className="shrink-0 text-2xs font-semibold uppercase tracking-widest text-ember-400 px-2 py-0.5 rounded-lg bg-ember-400/10 border border-ember-400/20 animate-pulse">
            Unarmed
          </span>
        )}
      </div>
    </div>
  )
}
