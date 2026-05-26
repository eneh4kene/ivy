'use client'

import { useState, useEffect, useCallback } from 'react'
import { coachApi, type CoachClient, type CoachProfile } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import Link from 'next/link'
import {
  Users, AlertTriangle, TrendingUp, Plus, Loader2,
  ChevronRight, Settings, Flame, Phone, MessageCircle,
  Link2, RefreshCw, Check, Copy
} from 'lucide-react'

function StatusDot({ needsAttention, missed }: { needsAttention: boolean; missed: number }) {
  if (needsAttention) return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <AlertTriangle className="w-3 h-3" /> {missed} missed
    </span>
  )
  return <span className="text-xs text-emerald-400">On track</span>
}

export default function CoachDashboard() {
  const user = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [clients, setClients] = useState<CoachClient[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadInviteLink = useCallback(async () => {
    try {
      const { url } = await coachApi.getInviteLink()
      setInviteUrl(url)
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([coachApi.getProfile(), coachApi.getClients()])
      .then(([p, c]) => { setProfile(p); setClients(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
    loadInviteLink()
  }, [loadInviteLink])

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = async () => {
    if (!confirm('This will invalidate your current invite link. Anyone who had the old link won\'t be able to use it. Continue?')) return
    setResetting(true)
    try {
      const { url } = await coachApi.resetInviteLink()
      setInviteUrl(url)
    } catch {} finally { setResetting(false) }
  }

  const isClientActive = (c: CoachClient) =>
    c.isActive && c.isOnboarded && c.subscriptionStatus === 'active'

  const pending = clients.filter((c) => !c.isOnboarded)
  const inactive = clients.filter((c) => c.isOnboarded && (!c.isActive || c.subscriptionStatus !== 'active'))
  const active = clients.filter((c) => isClientActive(c))
  const atRisk = active.filter((c) => c.needsAttention)
  const onTrack = active.filter((c) => !c.needsAttention)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {profile?.brandName && profile.whitelabelEnabled
                ? profile.brandName
                : `${user?.firstName}'s dashboard`}
            </h1>
            {profile?.programmeName && (
              <p className="text-xs text-muted-foreground mt-0.5">{profile.programmeName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/coach/settings"
              className="p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Setup nudge if no profile */}
        {!profile && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <p className="text-sm font-medium text-amber-400 mb-1">Complete your coach profile</p>
            <p className="text-xs text-muted-foreground mb-3">Set your programme name and coaching style so Ivy knows how to represent you in client calls.</p>
            <Link href="/coach/settings"
              className="text-xs font-medium text-amber-400 hover:text-amber-300">
              Set up profile →
            </Link>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Active', value: active.length, icon: Users },
            { label: 'On track', value: onTrack.length, icon: TrendingUp },
            { label: 'Attention', value: atRisk.length, icon: AlertTriangle },
            { label: 'Inactive', value: inactive.length + pending.length, icon: Phone },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-3 rounded-xl border border-border bg-card text-center">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Invite link */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Your invite link</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this anywhere — WhatsApp, Teams, DM, wherever. Anyone who clicks it can join your programme.
          </p>
          {inviteUrl ? (
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 text-xs bg-muted/40 border border-border rounded-lg truncate text-muted-foreground font-mono">
                {inviteUrl}
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                title="Regenerate link (invalidates old one)"
                className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted/30 transition-colors text-muted-foreground shrink-0"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <div className="h-9 rounded-lg bg-muted/40 animate-pulse" />
          )}
        </div>

        {/* Clients needing attention */}
        {atRisk.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2.5">
              <AlertTriangle className="w-3 h-3 inline mr-1" />Needs attention
            </p>
            <div className="space-y-2">
              {atRisk.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          </div>
        )}

        {/* All clients */}
        {onTrack.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
              On track ({onTrack.length})
            </p>
            <div className="space-y-2">
              {onTrack.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          </div>
        )}

        {/* Inactive — subscriptions lapsed, Ivy can't follow up */}
        {inactive.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
              Ivy can't reach ({inactive.length})
            </p>
            <div className="space-y-2">
              {inactive.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          </div>
        )}

        {/* Pending — invited but haven't signed up yet */}
        {pending.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
              Awaiting signup ({pending.length})
            </p>
            <div className="space-y-2">
              {pending.map((c) => <ClientCard key={c.id} client={c} />)}
            </div>
          </div>
        )}

        {clients.length === 0 && !loading && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No clients yet</p>
            <p className="text-xs text-muted-foreground">Invite your first client above — Ivy handles their daily accountability calls.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientCard({ client }: { client: CoachClient }) {
  const lastCall = client.calls[0]
  const sentimentColour: Record<string, string> = {
    positive: 'text-emerald-400', neutral: 'text-muted-foreground', negative: 'text-red-400',
  }

  const isInactive = !client.isActive || client.subscriptionStatus !== 'active'
  const isPending = !client.isOnboarded

  const subStatusLabel: Record<string, string> = {
    past_due: 'Payment overdue',
    cancelled: 'Cancelled',
    paused: 'Paused',
    CANCELLING: 'Cancelling',
    PAST_DUE: 'Payment overdue',
    CANCELLED: 'Cancelled',
  }

  return (
    <Link href={`/coach/clients/${client.id}`}>
      <div className={`p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors cursor-pointer ${
        isPending ? 'border-border opacity-60' :
        isInactive ? 'border-border opacity-50' :
        client.needsAttention ? 'border-red-500/20 bg-red-500/3' : 'border-border'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
            {client.firstName[0]}{client.lastName?.[0] ?? ''}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{client.firstName} {client.lastName}</p>
              {isPending
                ? <span className="text-xs text-amber-400">Awaiting signup</span>
                : isInactive
                ? <span className="text-xs text-muted-foreground">{subStatusLabel[client.subscriptionStatus] ?? 'Inactive'} — Ivy can't reach</span>
                : <StatusDot needsAttention={client.needsAttention} missed={client.recentMissedCount} />}
            </div>
            {!isPending && !isInactive && (
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="w-3 h-3 text-amber-400" /> {client.currentStreak}d
                </span>
                {lastCall && (
                  <span className={`text-xs ${sentimentColour[lastCall.sentiment ?? 'neutral'] ?? 'text-muted-foreground'}`}>
                    Last: {lastCall.callType.toLowerCase().replace('_', ' ')}
                  </span>
                )}
                <span className="text-xs text-muted-foreground capitalize">{client.track}</span>
                <span title={client.telegramChatId ? 'Telegram connected' : 'Telegram not connected'}>
                  <MessageCircle className={`w-3 h-3 ${client.telegramChatId ? 'text-[#229ED9]' : 'text-muted-foreground/30'}`} />
                </span>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </Link>
  )
}
