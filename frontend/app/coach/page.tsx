'use client'

import { useState, useEffect } from 'react'
import { coachApi, type CoachClient, type CoachProfile } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import Link from 'next/link'
import {
  Users, AlertTriangle, TrendingUp, Plus, Loader2,
  ChevronRight, Settings, Flame, Phone, MessageCircle
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
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    Promise.all([coachApi.getProfile(), coachApi.getClients()])
      .then(([p, c]) => { setProfile(p); setClients(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    try {
      const result = await coachApi.inviteClient(inviteEmail.trim())
      setInviteMsg(result.status === 'linked'
        ? `${inviteEmail} linked to your account.`
        : `Invite sent to ${inviteEmail}.`)
      setInviteEmail('')
      const updated = await coachApi.getClients()
      setClients(updated)
    } catch (e: any) {
      setInviteMsg(e.response?.data?.error ?? 'Failed to invite client.')
    } finally { setInviting(false) }
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

        {/* Invite */}
        <div className="mb-6">
          {!showInvite ? (
            <button onClick={() => setShowInvite(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-muted-foreground hover:text-foreground">
              <Plus className="w-4 h-4" /> Invite a client
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <p className="text-sm font-medium">Invite a client</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  placeholder="client@email.com"
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send invite'}
                </button>
                <button onClick={() => { setShowInvite(false); setInviteEmail(''); setInviteMsg('') }}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">
                  Cancel
                </button>
              </div>
              {inviteMsg && <p className="text-xs text-muted-foreground">{inviteMsg}</p>}
              <p className="text-xs text-muted-foreground">
                They'll receive a magic link. Once they complete onboarding, Ivy starts their daily calls automatically.
              </p>
            </div>
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
