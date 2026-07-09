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
import { coachApi, type CoachProfile, type CoachClient, type CoachPulse } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { ClientRow, SectionHeader, segmentClients } from '@/components/coach/ClientRoster'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [clients, setClients] = useState<CoachClient[]>([])
  const [pulse, setPulse] = useState<CoachPulse | null>(null)
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
    // Pulse is additive — its failure never blocks the console.
    coachApi.getPulse().then(setPulse).catch(() => {})
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

  const { pending, inactive, active, atRisk, onTrack } = segmentClients(clients)

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
                Your welcome call lands in the next couple of minutes
                {user?.ivyCallNumber && (
                  <> from <span className="text-ink-100 font-medium whitespace-nowrap">{user.ivyCallNumber}</span> — save it as Ivy</>
                )}. Pick up and she&rsquo;ll walk you through how you two work together.
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

        {/* ── Group pulse — the book as one number ── */}
        {pulse && pulse.activeClients > 0 && pulse.rate !== null && (
          <div className="rounded-2xl surface p-4 mb-5 animate-fade-in">
            <div className="flex items-center justify-between mb-1">
              <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Group pulse</p>
              {pulse.circle && (
                <span className="text-2xs text-gold-400/80 font-medium truncate max-w-[50%]">
                  {pulse.circle.name} · {pulse.circle.size} in circle
                </span>
              )}
            </div>
            <div className="flex items-end gap-3">
              <p className="font-display text-4xl font-semibold text-ink-50 tabular-nums leading-none">
                {pulse.rate}<span className="text-xl text-ink-400">%</span>
              </p>
              <div className="pb-0.5">
                <p className="text-xs text-ink-300">of planned days kept this week</p>
                {pulse.prevRate !== null && pulse.prevRate !== pulse.rate && (
                  <p className={`text-2xs font-medium ${pulse.rate >= pulse.prevRate ? 'text-sage-400' : 'text-ember-400'}`}>
                    {pulse.rate >= pulse.prevRate ? '▲' : '▼'} {Math.abs(pulse.rate - pulse.prevRate)} vs last week
                  </p>
                )}
              </div>
            </div>
            {pulse.topPerformers.length > 0 && (
              <p className="text-2xs text-ink-400 mt-2">
                Carrying the group: <span className="text-ink-200">{pulse.topPerformers.join(', ')}</span>
              </p>
            )}
          </div>
        )}

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

        {/* Full segmented roster lives on /coach/clients (bottom nav) — the
            console only surfaces who needs the coach TODAY. */}
        {clients.length > 0 && (
          <Link
            href="/coach/clients"
            className="flex items-center justify-between px-4 py-3 rounded-2xl surface hover:border-ink-400/40 transition-colors mb-5"
          >
            <span className="flex items-center gap-2 text-sm text-ink-200 font-medium">
              <Users className="w-4 h-4 text-ink-400" /> All clients
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              {clients.length} <ChevronRight className="w-4 h-4" />
            </span>
          </Link>
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
