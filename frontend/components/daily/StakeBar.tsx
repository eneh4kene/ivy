'use client'

import { Shield, AlertTriangle } from 'lucide-react'
import type { StakeStatus } from './types'

interface StakeBarProps {
  stake: StakeStatus
  isArmed: boolean
}

/** Compact stake-status strip at the top of the daily screen — the console readout at the top of the ritual. */
export function StakeBar({ stake, isArmed }: StakeBarProps) {
  const sym = stake.currency === 'GBP' ? '£' : '$'

  return (
    <div className="w-full px-4 pt-2 pb-3">
      <div className={`surface rounded-2xl px-4 py-3 flex items-center gap-3 ${isArmed ? 'border-sage-400/30' : 'border-ember-400/30'}`}>
        {/* icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
          isArmed ? 'bg-[#2dd4bf]/12' : 'bg-[#ff7a6b]/12'
        }`}>
          {isArmed
            ? <Shield className="w-4 h-4 text-sage-300" />
            : <AlertTriangle className="w-4 h-4 text-ember-400" />
          }
        </div>

        {/* stake info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-mono text-sm font-semibold text-ink-50 tracking-tight whitespace-nowrap">
              {sym}{stake.dailySlice} <span className="text-ink-400 font-normal text-2xs uppercase tracking-widest">on the line</span>
            </span>
            <span className="text-2xs text-ink-400 uppercase tracking-widest whitespace-nowrap truncate">
              · {stake.isFoundation ? `${sym}${stake.weeklyAmount} first run` : `${sym}${stake.weeklyAmount}/wk`}
            </span>
          </div>

          {/* week progress — LEVEL track */}
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
                    status === 'complete' ? 'w-5 h-1.5 bg-[#2dd4bf] shadow-[0_0_8px_rgba(198,255,68,.7)]' :
                    status === 'armed'   ? 'w-5 h-1.5 bg-[#46f0c8] shadow-[0_0_8px_rgba(39,232,255,.8)] animate-pulse' :
                    status === 'forfeit' ? 'w-5 h-1.5 bg-[#ff7a6b]/70 shadow-[0_0_6px_rgba(255,59,120,.5)]' :
                                          'w-3 h-1.5 bg-white/10'
                  }`}
                />
              )
            })}
            <span className="text-2xs text-ink-400 ml-1 uppercase tracking-wider whitespace-nowrap">
              {stake.daysLeft}d left
            </span>
          </div>
        </div>

        {/* armed badge */}
        {isArmed ? (
          <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-sage-300 px-2 py-0.5 rounded-lg bg-[#2dd4bf]/10 border border-[#2dd4bf]/30">
            Armed
          </span>
        ) : (
          <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-ember-400 px-2 py-0.5 rounded-lg bg-[#ff7a6b]/10 border border-[#ff7a6b]/30 animate-pulse">
            Unarmed
          </span>
        )}
      </div>
    </div>
  )
}
