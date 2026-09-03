'use client'

/**
 * /lab/pair — no-auth render harness for the pair-note affordance.
 *
 * The Circle tab is auth-gated and needs a live pairs game with a real
 * partner, which makes the composer effectively unreviewable before it ships.
 * This renders the same component against mock state, in every state it has.
 * Reference only; safe to delete.
 */

import { useState } from 'react'
import PartnerNote from '@/components/circles/PartnerNote'
import type { PeerPartner } from '@/lib/api'

const base: PeerPartner = {
  partnerId: 'u-sam',
  firstName: 'Sam',
  gameId: 'g1',
  gameName: 'Two by Two',
  closingInDays: null,
  contactBlocked: false,
  blockedByMe: false,
  sentToday: 0,
  dailyLimit: 3,
}

function Case({ label, partner }: { label: string; partner: PeerPartner }) {
  const [p, setP] = useState(partner)
  return (
    <div className="mb-6">
      <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-ink-500 mb-2">{label}</p>
      <div className="surface rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-sage-400">Active game</span>
        </div>
        <h2 className="font-display text-lg text-ink-50">Two by Two</h2>
        <p className="text-sm text-ink-400 mt-1">6 of you, paired up. A day banks for the room only when BOTH of a pair keep it.</p>
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-sm text-ink-50 font-semibold tabular-nums">11 <span className="text-ink-400 font-normal">of 20 paired days</span></p>
            <p className="text-2xs text-ink-400 tabular-nums">4 yours</p>
          </div>
          <div className="h-2 rounded-full bg-ink-900/70 border border-ink-700 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sage-500 to-sage-300" style={{ width: '55%' }} />
          </div>
          <p className="text-2xs text-ink-400 pt-2 leading-relaxed">
            You&rsquo;re with <span className="text-ink-100">Sam</span>. A day only counts when you both keep it.
          </p>
        </div>
        <PartnerNote partner={p} onChange={setP} />
      </div>
    </div>
  )
}

export default function LabPair() {
  return (
    <div className="theme-vine min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="font-display italic text-2xl text-ink-50 mb-6">Pair note — states</h1>
        <Case label="Ready to send" partner={base} />
        <Case label="Two of three spent" partner={{ ...base, sentToday: 2 }} />
        <Case label="Spent for today" partner={{ ...base, sentToday: 3 }} />
        <Case label="Blocked by me" partner={{ ...base, contactBlocked: true, blockedByMe: true }} />
        <Case label="Blocked by them" partner={{ ...base, contactBlocked: true, blockedByMe: false }} />
        <Case label="Sprint over — closing" partner={{ ...base, closingInDays: 4 }} />
        <Case label="Closing tomorrow" partner={{ ...base, closingInDays: 1, sentToday: 1 }} />
      </div>
    </div>
  )
}
