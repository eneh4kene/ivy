'use client'

import { useState, useEffect, use } from 'react'
import { coachApi } from '@/lib/api'
import Link from 'next/link'
import {
  ArrowLeft, Flame, Phone, PhoneOff, Loader2,
  Save, BookOpen, TrendingUp, AlertTriangle
} from 'lucide-react'

const CALL_TYPE_LABEL: Record<string, string> = {
  MORNING_PLANNING: 'Morning', EVENING_REVIEW: 'Evening',
  RESCUE: 'Rescue', WEEKLY_PLANNING: 'Weekly', SEASON_CLOSE: 'Season close',
  MONTHLY_CHECKIN: 'Monthly', ONBOARDING: 'Onboarding',
}
const SENTIMENT_COLOUR: Record<string, string> = {
  positive: 'text-emerald-400', neutral: 'text-muted-foreground', negative: 'text-red-400',
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [tab, setTab] = useState<'calls' | 'insights' | 'notes'>('calls')

  useEffect(() => {
    coachApi.getClient(id)
      .then((c) => { setClient(c); setNotes(c.coachNotes ?? '') })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleSaveNotes = async () => {
    setNotesSaving(true)
    try {
      await coachApi.updateClientNotes(id, notes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (e) { console.error(e) }
    finally { setNotesSaving(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client not found.</div>

  const recentMissed = client.calls?.filter((c: any) => c.status === 'NO_ANSWER').length ?? 0
  const latestSentiment = client.calls?.[0]?.sentiment ?? null

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/coach" className="p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{client.firstName} {client.lastName}</h1>
            <p className="text-xs text-muted-foreground capitalize">{client.track} track · {client.goal}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-lg font-bold">{client.streaks?.currentStreak ?? 0}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Day streak</p>
          </div>
          <div className="p-3 rounded-xl border border-border bg-card text-center">
            <p className="text-lg font-bold">{client.calls?.length ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Total calls</p>
          </div>
          <div className={`p-3 rounded-xl border bg-card text-center ${recentMissed >= 2 ? 'border-red-500/20' : 'border-border'}`}>
            <p className={`text-lg font-bold ${recentMissed >= 2 ? 'text-red-400' : 'text-foreground'}`}>{recentMissed}</p>
            <p className="text-[10px] text-muted-foreground">Recent misses</p>
          </div>
        </div>

        {/* Latest call summary */}
        {client.calls?.[0]?.callSummary && (
          <div className="mb-5 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Latest — {CALL_TYPE_LABEL[client.calls[0].callType] ?? client.calls[0].callType}
              </p>
              {latestSentiment && (
                <span className={`text-xs ml-auto ${SENTIMENT_COLOUR[latestSentiment] ?? ''}`}>
                  {latestSentiment}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{client.calls[0].callSummary}</p>
          </div>
        )}

        {/* Long-term memories */}
        {client.callMemories?.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2.5">What Ivy remembers</p>
            <ul className="space-y-1.5">
              {client.callMemories.slice(0, 5).map((m: any) => (
                <li key={m.id} className="text-xs text-foreground/70 flex items-start gap-2">
                  <span className="text-primary mt-0.5">·</span> {m.content}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-muted/30 rounded-xl">
          {(['calls', 'notes', 'insights'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>{t}</button>
          ))}
        </div>

        {/* Calls tab */}
        {tab === 'calls' && (
          <div className="space-y-2.5">
            {client.calls?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No calls yet.</p>
            )}
            {client.calls?.map((call: any) => (
              <div key={call.id} className={`p-4 rounded-xl border bg-card ${
                call.status === 'NO_ANSWER' ? 'border-border opacity-60' : 'border-border'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {call.status === 'NO_ANSWER'
                      ? <PhoneOff className="w-3.5 h-3.5 text-muted-foreground" />
                      : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
                    <span className="text-sm font-medium">
                      {CALL_TYPE_LABEL[call.callType] ?? call.callType}
                    </span>
                    {call.status === 'NO_ANSWER' && (
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">missed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {call.sentiment && (
                      <span className={`text-xs ${SENTIMENT_COLOUR[call.sentiment] ?? ''}`}>{call.sentiment}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(call.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                {call.callSummary && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{call.callSummary}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Coach notes tab */}
        {tab === 'notes' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-foreground/80 mb-1">Your notes for Ivy</p>
              <p className="text-xs text-muted-foreground mb-3">
                Ivy reads these before every call with {client.firstName}. Write what you'd tell a colleague covering your client — injuries, sensitivities, what to probe, what to celebrate.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder={`e.g. Emma has a knee injury — never suggest running. Responds well to data framing ("you were 80% consistent last month"). Working toward her first half-marathon in October.`}
                className="w-full px-3 py-3 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {notesSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : notesSaved
                ? <span className="text-emerald-300">✓ Saved</span>
                : <><Save className="w-4 h-4" /> Save notes</>}
            </button>
          </div>
        )}

        {/* Insights tab */}
        {tab === 'insights' && (
          <div className="space-y-3">
            {client.calls?.filter((c: any) => c.callInsights).slice(0, 5).map((call: any) => {
              const insights = call.callInsights as Record<string, any>
              return (
                <div key={call.id} className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {CALL_TYPE_LABEL[call.callType]} — {new Date(call.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  {insights.key_insight && <p className="text-sm mb-1.5">💡 {insights.key_insight}</p>}
                  {insights.follow_up && <p className="text-xs text-muted-foreground">Follow up: {insights.follow_up}</p>}
                  {insights.red_flag && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {insights.red_flag}
                    </p>
                  )}
                </div>
              )
            })}
            {!client.calls?.some((c: any) => c.callInsights) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Insights appear after calls complete.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
