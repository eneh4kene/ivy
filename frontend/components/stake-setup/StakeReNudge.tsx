'use client'

/**
 * StakeReNudge — persistent re-nudge for a paid user who deferred the stake gate.
 *
 * Behavioural framing: name what a missed day would have cost to make the
 * abstraction concrete ("Today would've cost £2. Make it real?"). Tapping it
 * returns to /stake-setup. Shown by useStakeGate consumers when showNudge is true.
 */

import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { STAKE_CONFIG, dailySlice } from '@/lib/mock/stake-setup'

function sym(currency: string) {
  return currency === 'GBP' ? '£' : '$'
}

export function StakeReNudge({ currency }: { currency: string }) {
  const daily = dailySlice(STAKE_CONFIG.defaultWeekly)
  return (
    <Link href="/stake-setup" className="block">
      <div className="glass-gold rounded-2xl p-4 flex items-center gap-3 hover:bg-gold-400/10 transition-colors active:scale-[0.99]">
        <div className="w-10 h-10 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-gold-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-50">
            Today would've cost {sym(currency)}{daily.toFixed(0)}. Make it real?
          </p>
          <p className="text-2xs text-ink-400 mt-0.5">
            Set a stake — nothing charged unless you miss a day.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-gold-300 shrink-0" />
      </div>
    </Link>
  )
}
