'use client'

/**
 * Shared client-roster pieces for the coach console (/coach) and the dedicated
 * clients page (/coach/clients): status derivation, the client row card, and
 * the section header. One source of truth so the two surfaces can't drift.
 */

import Link from 'next/link'
import { Flame, MessageCircle, ChevronRight } from 'lucide-react'
import type { CoachClient } from '@/lib/api'

/** Deterministic avatar hue from name string */
export function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return h % 360
}

export function getStatusMeta(client: CoachClient): {
  label: string
  dotClass: string
  textClass: string
  ringClass: string
} {
  if (!client.isOnboarded) {
    return { label: 'Awaiting signup', dotClass: 'bg-ink-600', textClass: 'text-ink-400', ringClass: 'border-ink-600' }
  }
  if (!client.isActive || client.subscriptionStatus !== 'active') {
    return { label: 'Ivy can\'t reach', dotClass: 'bg-ember-500', textClass: 'text-ember-400', ringClass: 'border-ember-500/30' }
  }
  if (client.needsAttention) {
    return { label: `${client.recentMissedCount} missed`, dotClass: 'bg-ember-400 pulse-ember', textClass: 'text-ember-400', ringClass: 'border-ember-500/30' }
  }
  return { label: 'On track', dotClass: 'bg-sage-400', textClass: 'text-sage-400', ringClass: 'border-sage-400/20' }
}

export function ClientRow({ client, index }: { client: CoachClient; index: number }) {
  const meta = getStatusMeta(client)
  const isPending = !client.isOnboarded
  const isInactive = client.isOnboarded && (!client.isActive || client.subscriptionStatus !== 'active')
  const lastCall = client.calls[0]
  const hue = nameHue(client.firstName + client.lastName)

  const sentimentColour: Record<string, string> = {
    positive: 'text-sage-400',
    neutral:  'text-ink-400',
    negative: 'text-ember-400',
  }

  return (
    <Link href={`/coach/clients/${client.id}`} className="block">
      <div
        className={`
          relative rounded-2xl surface overflow-hidden
          active:scale-[0.99] hover:border-ink-400/40 transition-all duration-150
          cursor-pointer group animate-fade-in
          ${isInactive ? 'opacity-50' : ''}
          ${client.needsAttention ? 'border-ember-500/30' : ''}
        `}
        style={{ animationDelay: `${index * 40}ms` }}
      >
        {/* Attention flag */}
        {client.needsAttention && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-ember-500/60 rounded-t-2xl" />
        )}

        <div className="px-4 py-3.5 flex items-center gap-3.5">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-ink-900 shrink-0"
            style={{ background: `hsl(${hue}, 52%, 56%)` }}
          >
            {client.firstName[0]}{client.lastName?.[0] ?? ''}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-ink-50 truncate">
                {client.firstName} {client.lastName}
              </p>
              {!isPending && !isInactive && client.currentStreak >= 7 && (
                <span className="flex items-center gap-0.5 text-2xs font-mono text-ember-400 shrink-0">
                  <Flame className="w-3 h-3" />{client.currentStreak}d
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {/* Status dot + label */}
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
                <span className={`text-2xs font-medium ${meta.textClass}`}>{meta.label}</span>
              </div>

              {/* Last call sentiment */}
              {!isPending && !isInactive && lastCall?.sentiment && (
                <>
                  <span className="text-2xs text-ink-600">·</span>
                  <span className={`text-2xs capitalize ${sentimentColour[lastCall.sentiment] ?? 'text-ink-400'}`}>
                    {lastCall.sentiment}
                  </span>
                </>
              )}

              {/* Track */}
              {!isPending && (
                <>
                  <span className="text-2xs text-ink-600">·</span>
                  <span className="text-2xs text-ink-400 capitalize truncate">{client.track}</span>
                </>
              )}

              {/* Telegram indicator */}
              {client.telegramChatId && (
                <MessageCircle className="w-3 h-3 text-[#229ED9] shrink-0 ml-auto" />
              )}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-ink-600 shrink-0 group-hover:text-ink-400 transition-colors" />
        </div>
      </div>
    </Link>
  )
}

export function SectionHeader({ label, count, accent }: { label: string; count: number; accent?: 'ember' | 'gold' | 'sage' }) {
  const colorClass = accent === 'ember'
    ? 'text-ember-400'
    : accent === 'gold'
    ? 'text-gold-400'
    : 'text-ink-400'

  return (
    <p className={`text-2xs font-semibold uppercase tracking-widest ${colorClass} mb-2.5 flex items-center gap-2`}>
      {label}
      <span className={`
        min-w-[18px] h-[18px] rounded-full text-center text-2xs leading-[18px] font-mono
        ${accent === 'ember' ? 'bg-ember-500/15 text-ember-400' : 'bg-ink-700 text-ink-400'}
      `}>
        {count}
      </span>
    </p>
  )
}

/** Segment a roster into the four coach-facing buckets. */
export function segmentClients(clients: CoachClient[]) {
  const pending  = clients.filter((c) => !c.isOnboarded)
  const inactive = clients.filter((c) => c.isOnboarded && (!c.isActive || c.subscriptionStatus !== 'active'))
  const active   = clients.filter((c) => c.isOnboarded && c.isActive && c.subscriptionStatus === 'active')
  const atRisk   = active.filter((c) => c.needsAttention)
  const onTrack  = active.filter((c) => !c.needsAttention)
  return { pending, inactive, active, atRisk, onTrack }
}
