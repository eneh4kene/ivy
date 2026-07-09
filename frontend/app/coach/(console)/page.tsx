'use client'

/**
 * /coach — Coach dashboard: client roster overview.
 *
 * Wired to real coachApi: getProfile, getClients, getInviteLink.
 * Clients are segmented into needs-attention / on-track / inactive / pending
 * from real CoachClient flags (needsAttention, isActive, subscriptionStatus,
 * isOnboarded). Invite link is the real shareable URL.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Settings, Flame, AlertTriangle, Users, Copy, Check,
  MessageCircle, ChevronRight, Link2, UserX, Shield,
  PhoneCall, Share2, X,
} from 'lucide-react'
import { coachApi, type CoachProfile, type CoachClient } from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic avatar hue from name string */
function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return h % 360
}

function getStatusMeta(client: CoachClient): {
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

// ─── Client row card ──────────────────────────────────────────────────────────

function ClientRow({ client, index }: { client: CoachClient; index: number }) {
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

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, accent }: { label: string; count: number; accent?: 'ember' | 'gold' | 'sage' }) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [clients, setClients] = useState<CoachClient[]>([])
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    // Fresh from first setup (?welcome=1): tell them Ivy is about to ring, so
    // the welcome call lands as a promise kept rather than an unknown number.
    const params = new URLSearchParams(window.location.search)
    if (params.get('welcome') === '1') {
      setShowWelcome(true)
      window.history.replaceState(null, '', '/coach')
    }
  }, [])

  useEffect(() => {
    Promise.all([
      coachApi.getProfile(),
      coachApi.getClients(),
      coachApi.getInviteLink(),
    ]).then(([p, c, link]) => {
      setProfile(p)
      setClients(c)
      setInviteUrl(link.url)
    }).catch((err) => {
      setLoadError(err.message ?? 'Failed to load coach data')
    })
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    // Native share sheet where the PWA has it (iOS/Android); copy elsewhere.
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.programmeName || 'Join my programme',
          text: 'Join my coaching programme — Ivy handles your daily accountability.',
          url: inviteUrl,
        })
        return
      } catch { /* user dismissed the sheet — nothing to do */ }
    } else {
      handleCopy()
    }
  }

  if (loadError) {
    return (
      <div className="min-h-dvh mesh-bg-subtle flex items-center justify-center px-6 text-center">
        <p className="text-sm text-ember-400">{loadError}</p>
      </div>
    )
  }

  if (!profile) {
    // Skeleton mirrors the real layout so the console appears to resolve,
    // not pop in — no full-screen spinner.
    return (
      <div className="min-h-dvh mesh-bg-subtle pb-safe-b">
        <div className="max-w-lg mx-auto px-4 animate-pulse">
          <div className="flex items-center justify-between pt-safe-t pt-6 pb-5">
            <div className="space-y-2">
              <div className="h-7 w-44 rounded-lg bg-ink-700/70" />
              <div className="h-3 w-24 rounded bg-ink-700/50" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-ink-700/70" />
          </div>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-xl bg-ink-700/40" />)}
          </div>
          <div className="h-[120px] rounded-2xl bg-ink-700/40 mb-6" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-[62px] rounded-2xl bg-ink-700/40" />)}
          </div>
        </div>
      </div>
    )
  }

  // Segment clients
  const pending    = clients.filter((c) => !c.isOnboarded)
  const inactive   = clients.filter((c) => c.isOnboarded && (!c.isActive || c.subscriptionStatus !== 'active'))
  const active     = clients.filter((c) => c.isOnboarded && c.isActive && c.subscriptionStatus === 'active')
  const atRisk     = active.filter((c) => c.needsAttention)
  const onTrack    = active.filter((c) => !c.needsAttention)

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-safe-b">
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between pt-safe-t pt-6 pb-5">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-50 leading-tight">
              {profile.programmeName}
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              {active.length} active client{active.length !== 1 ? 's' : ''}
              {profile.ponderCallEnabled && profile.ponderCallTime && (
                <span className="text-ink-500">
                  {' '}· ponder {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][profile.ponderCallDay ?? 1]} {profile.ponderCallTime}
                </span>
              )}
            </p>
          </div>
          <Link href="/coach/settings">
            <button
              className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors text-ink-400 hover:text-ink-200"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* ── Welcome-call banner (first arrival after setup) ── */}
        {showWelcome && (
          <div className="glass-gold rounded-2xl p-4 mb-5 flex items-start gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <PhoneCall className="w-4 h-4 text-gold-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-50 mb-0.5">Ivy&rsquo;s about to ring you</p>
              <p className="text-xs text-ink-300 leading-relaxed">
                Your welcome call lands in the next couple of minutes — pick up and
                she&rsquo;ll walk you through how you two work together.
              </p>
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="text-ink-500 hover:text-ink-300 transition-colors shrink-0 -mt-0.5 -mr-0.5 p-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Active',     value: active.length,              icon: Users,         accent: false },
            { label: 'On track',   value: onTrack.length,             icon: Shield,        accent: onTrack.length > 0 },
            { label: 'Attention',  value: atRisk.length,              icon: AlertTriangle, accent: atRisk.length > 0 },
            { label: 'Inactive',   value: inactive.length + pending.length, icon: UserX,   accent: false },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className={`rounded-xl p-3 text-center border transition-colors ${
                accent && value > 0
                  ? label === 'Attention'
                    ? 'bg-ember-500/8 border-ember-500/20'
                    : 'bg-gold-400/8 border-gold-400/20'
                  : 'surface'
              }`}
            >
              <p className={`font-display text-xl font-semibold tabular-nums ${
                accent && value > 0
                  ? label === 'Attention' ? 'text-ember-400' : 'text-gold-400'
                  : 'text-ink-50'
              }`}>
                {value}
              </p>
              <p className="text-2xs text-ink-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Invite link ── */}
        <div className="glass-gold rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-3.5 h-3.5 text-gold-400" />
            <p className="text-xs font-semibold text-ink-200">Your invite link</p>
          </div>
          <p className="text-xs text-ink-400 mb-3 leading-relaxed">
            Share anywhere — clients click to join your programme. Ivy handles their daily accountability.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 text-xs bg-ink-900/50 border border-ink-600 rounded-xl truncate text-ink-400 font-mono">
              {inviteUrl}
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl border border-gold-400/30 bg-gold-400/10 text-gold-400 text-xs font-medium hover:bg-gold-400/15 transition-colors flex items-center gap-1.5 shrink-0"
            >
              {copied
                ? <><Check className="w-3.5 h-3.5" /> Copied</>
                : <><Copy className="w-3.5 h-3.5" /> Copy</>
              }
            </button>
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-xl border border-gold-400/30 bg-gold-400/10 text-gold-400 hover:bg-gold-400/15 transition-colors flex items-center shrink-0"
              aria-label="Share invite link"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Clients needing attention ── */}
        {atRisk.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="Needs attention" count={atRisk.length} accent="ember" />
            <div className="space-y-2">
              {atRisk.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {/* ── On track ── */}
        {onTrack.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="On track" count={onTrack.length} />
            <div className="space-y-2">
              {onTrack.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {/* ── Inactive ── */}
        {inactive.length > 0 && (
          <div className="mb-5">
            <SectionHeader label="Ivy can't reach" count={inactive.length} />
            <div className="space-y-2">
              {inactive.map((c, i) => <ClientRow key={c.id} client={c} index={i} />)}
            </div>
          </div>
        )}

        {/* ── Pending ── */}
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
            <p className="text-xs text-ink-400 leading-relaxed max-w-xs mx-auto">
              Share your invite link above — clients click to join your programme and Ivy handles their daily accountability calls.
            </p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
