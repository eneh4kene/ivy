'use client'

/**
 * /coach/clients — the full roster, segmented (needs attention / on track /
 * can't reach / awaiting signup). The console shows the headline; this is the
 * working list. Row cards link into the client detail (programme editor,
 * calls, notes, insights).
 */

import { useState, useEffect } from 'react'
import { Users, Share2, Copy, Check } from 'lucide-react'
import { coachApi, type CoachClient } from '@/lib/api'
import { ClientRow, SectionHeader, segmentClients } from '@/components/coach/ClientRoster'

export default function CoachClientsPage() {
  const [clients, setClients] = useState<CoachClient[] | null>(null)
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([coachApi.getClients(), coachApi.getInviteLink()])
      .then(([c, link]) => {
        setClients(c)
        setInviteUrl(link.url)
      })
      .catch((err) => setLoadError(err.message ?? 'Failed to load clients'))
  }, [])

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my programme', url: inviteUrl })
        return
      } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-dvh mesh-bg-subtle flex items-center justify-center px-6 text-center">
        <p className="text-sm text-ember-400">{loadError}</p>
      </div>
    )
  }

  if (!clients) {
    return (
      <div className="min-h-dvh mesh-bg-subtle">
        <div className="max-w-lg mx-auto px-4 animate-pulse">
          <div className="pt-safe-t pt-6 pb-5">
            <div className="h-7 w-32 rounded-lg bg-ink-700/70" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[62px] rounded-2xl bg-ink-700/40" />)}
          </div>
        </div>
      </div>
    )
  }

  const { pending, inactive, atRisk, onTrack, active } = segmentClients(clients)

  return (
    <div className="min-h-dvh mesh-bg-subtle">
      <div className="max-w-lg mx-auto px-4">

        <div className="flex items-center justify-between pt-safe-t pt-6 pb-5">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-50 leading-tight">Clients</h1>
            <p className="text-xs text-ink-400 mt-0.5">
              {active.length} active · {clients.length} total
            </p>
          </div>
          <button
            onClick={shareInvite}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gold-400/30 bg-gold-400/10 text-gold-400 text-xs font-medium hover:bg-gold-400/15 transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Invite</>}
          </button>
        </div>

        {atRisk.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="Needs attention" count={atRisk.length} accent="ember" />
            <div className="space-y-2">
              {atRisk.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {onTrack.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="On track" count={onTrack.length} />
            <div className="space-y-2">
              {onTrack.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {inactive.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="Ivy can't reach" count={inactive.length} />
            <div className="space-y-2">
              {inactive.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="Awaiting signup" count={pending.length} />
            <div className="space-y-2">
              {pending.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {clients.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-ink-700 border border-ink-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-ink-400" />
            </div>
            <p className="text-sm font-semibold text-ink-200 mb-1">No clients yet</p>
            <p className="text-xs text-ink-400 leading-relaxed max-w-xs mx-auto mb-5">
              Share your invite link — clients join your programme in one tap and
              Ivy starts working them the same day.
            </p>
            <button
              onClick={shareInvite}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-400 text-ink-900 text-xs font-semibold hover:bg-gold-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Share invite link
            </button>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
