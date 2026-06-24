'use client'

import { Shield, AlertTriangle } from 'lucide-react'
import type { StakeStatus } from './types'

interface StakeBarProps {
  stake: StakeStatus
  isArmed: boolean
}

/** Compact stake-status strip at the top of the daily screen — arcade HUD. */
export function StakeBar({ stake, isArmed }: StakeBarProps) {
  const sym = stake.currency === 'GBP' ? '£' : '$'

  return (
    <div className="w-full px-4 pt-2 pb-3">
      <div className={`glass-arcade rounded-2xl px-4 py-3 flex items-center gap-3 ${isArmed ? 'panel-lime' : 'panel-mag'}`}>
        {/* icon */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
          isArmed ? 'bg-[#c6ff44]/12' : 'bg-[#ff3b78]/12'
        }`}>
          {isArmed
            ? <Shield className="w-4 h-4 text-neon-lime" />
            : <AlertTriangle className="w-4 h-4 text-neon-mag" />
          }
        </div>

        {/* stake info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-mono text-sm font-semibold text-white led tracking-tight">
              {sym}{stake.dailySlice} <span className="text-hud font-normal text-2xs uppercase tracking-widest">on the line</span>
            </span>
            <span className="text-2xs text-hud uppercase tracking-widest">
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
                    status === 'complete' ? 'w-5 h-1.5 bg-[#c6ff44] shadow-[0_0_8px_rgba(198,255,68,.7)]' :
                    status === 'armed'   ? 'w-5 h-1.5 bg-[#27e8ff] shadow-[0_0_8px_rgba(39,232,255,.8)] anim-blink' :
                    status === 'forfeit' ? 'w-5 h-1.5 bg-[#ff3b78]/70 shadow-[0_0_6px_rgba(255,59,120,.5)]' :
                                          'w-3 h-1.5 bg-white/10'
                  }`}
                />
              )
            })}
            <span className="text-2xs text-hud ml-1 uppercase tracking-wider">
              {stake.daysLeft}d left
            </span>
          </div>
        </div>

        {/* armed badge */}
        {isArmed ? (
          <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-neon-lime px-2 py-0.5 rounded-lg bg-[#c6ff44]/10 border border-[#c6ff44]/30">
            Armed
          </span>
        ) : (
          <span className="shrink-0 text-2xs font-bold uppercase tracking-widest text-neon-mag px-2 py-0.5 rounded-lg bg-[#ff3b78]/10 border border-[#ff3b78]/30 anim-blink">
            Unarmed
          </span>
        )}
      </div>
    </div>
  )
}
