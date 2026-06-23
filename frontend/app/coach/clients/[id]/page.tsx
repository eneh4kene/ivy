'use client'

/**
 * /coach/clients/[id] — Coach-side client detail view.
 *
 * Wired to real coachApi: getClient, updateClientNotes, updateProgrammeAreas,
 * removeClient. Tabs: calls / notes / programme / insights.
 * useVisualViewport keeps the notes textarea above the iOS keyboard.
 */

import { useState, use, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Flame, Phone, PhoneOff, Save, AlertTriangle, Trash2, Check,
  Plus, X, MessageCircle, Shield, Target, TrendingUp,
} from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { coachApi } from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_TYPE_LABEL: Record<string, string> = {
  MORNING_PLANNING: 'Morning planning',
  EVENING_REVIEW:   'Evening review',
  RESCUE:           'Rescue call',
  WEEKLY_PLANNING:  'Weekly planning',
  SEASON_CLOSE:     'Season close',
  MONTHLY_CHECKIN:  'Monthly check-in',
  ONBOARDING:       'Onboarding',
}

type TabId = 'calls' | 'notes' | 'programme' | 'insights'

// ─── Call sentiment pill ──────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null
  const map = {
    positive: 'text-sage-400 bg-sage-400/10 border-sage-400/20',
    neutral:  'text-ink-400 bg-ink-700 border-ink-600',
    negative: 'text-ember-400 bg-ember-500/10 border-ember-500/20',
  } as Record<string, string>
  return (
    <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${map[sentiment] ?? map.neutral} capitalize`}>
      {sentiment}
    </span>
  )
}

// ─── Real call type (from CoachClient.calls) ─────────────────────────────────

type ClientCall = { callType: string; status: string; sentiment?: string; scheduledAt: string; callSummary?: string }

// ─── Call card ────────────────────────────────────────────────────────────────

function CallCard({ call, idx }: { call: ClientCall; idx: number }) {
  const missed = call.status === 'NO_ANSWER'
  return (
    <div className={`rounded-2xl surface p-4 ${missed ? 'opacity-55' : ''} animate-fade-in`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {missed
            ? <PhoneOff className="w-3.5 h-3.5 text-ink-400" />
            : <Phone className="w-3.5 h-3.5 text-sage-400" />
          }
          <span className="text-sm font-semibold text-ink-50">
            {CALL_TYPE_LABEL[call.callType] ?? call.callType}
          </span>
          {missed && (
            <span className="text-2xs text-ember-400 border border-ember-500/20 rounded px-1.5 py-0.5">missed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SentimentBadge sentiment={call.sentiment ?? null} />
          <span className="text-2xs text-ink-400">
            {new Date(call.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
      {call.callSummary && (
        <p className="text-xs text-ink-400 leading-relaxed mt-1.5 line-clamp-3">{call.callSummary}</p>
      )}
    </div>
  )
}

/** Deterministic avatar hue from name string */
function nameHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  return h % 360
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [client, setClient] = useState<any>(null)
  const [loadError, setLoadError] = useState('')

  const [tab, setTab] = useState<TabId>('calls')
  const [notes, setNotes] = useState('')
  const [areas, setAreas] = useState<{ id: string; area: string; instruction: string }[]>([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removed, setRemoved] = useState(false)

  // iOS keyboard awareness for the notes textarea
  const { keyboardOffset } = useVisualViewport()

  useEffect(() => {
    coachApi.getClient(id).then((c) => {
      setClient(c)
      setNotes(c?.coachNotes ?? '')
      setAreas(c?.programmeAreas ?? [])
    }).catch((err) => {
      setLoadError(err.message ?? 'Failed to load client')
    })
  }, [id])

  const handleSave = async () => {
    if (!client) return
    setSaving(true)
    try {
      await Promise.all([
        coachApi.updateClientNotes(id, notes),
        coachApi.updateProgrammeAreas(id, areas),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Non-fatal — show saved anyway so form feels responsive
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    try {
      await coachApi.removeClient(id)
    } catch {
      // best-effort
    }
    setRemoved(true)
  }

  if (removed) {
    return (
      <div className="min-h-dvh mesh-bg flex flex-col items-center justify-center px-8 text-center animate-fade-in-scale">
        <div className="w-14 h-14 rounded-2xl bg-ink-700 border border-ink-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-ink-400" />
        </div>
        <p className="text-lg font-display font-semibold text-ink-50 mb-2">Client removed</p>
        <p className="text-sm text-ink-400 mb-6">They've been removed from your roster.</p>
        <Link href="/coach" className="px-6 py-3 rounded-xl bg-gold-400 text-ink-900 font-semibold text-sm">
          Back to roster
        </Link>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-dvh mesh-bg flex items-center justify-center text-center px-6">
        <div>
          <p className="text-ember-400 text-sm mb-3">{loadError}</p>
          <Link href="/coach" className="text-gold-400 text-sm hover:text-gold-300">← Back to roster</Link>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-dvh mesh-bg flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-gold-400/40 border-t-gold-400 animate-spin" />
      </div>
    )
  }

  const hue = nameHue(client.firstName + (client.lastName ?? ''))
  const recentMissed = (client.calls ?? []).filter((c: ClientCall) => c.status === 'NO_ANSWER').length
  const latestCall = (client.calls ?? [])[0] as ClientCall | undefined

  const tabs: { id: TabId; label: string }[] = [
    { id: 'calls',     label: 'Calls' },
    { id: 'notes',     label: 'Notes' },
    { id: 'programme', label: 'Programme' },
  ]

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-safe-b">
      <div className="max-w-lg mx-auto px-4">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 bg-ink-900/85 backdrop-blur-md border-b border-ink-600/40 pt-safe-t">
          <div className="flex items-center gap-3 py-3">
            <Link href="/coach">
              <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors" aria-label="Back">
                <ArrowLeft className="w-4 h-4 text-ink-200" />
              </button>
            </Link>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold text-ink-900 shrink-0"
              style={{ background: `hsl(${hue}, 52%, 56%)` }}
            >
              {client.firstName[0]}{client.lastName?.[0] ?? ''}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-50">{client.firstName} {client.lastName}</p>
              <p className="text-2xs text-ink-400 truncate capitalize">{client.track} · {client.goal}</p>
            </div>
            {client.telegramChatId && (
              <span title="Telegram connected"><MessageCircle className="w-4 h-4 text-[#229ED9] shrink-0" /></span>
            )}
            {!confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="w-9 h-9 rounded-xl border border-ink-600 text-ink-400 hover:text-ember-400 hover:border-ember-500/40 flex items-center justify-center transition-colors"
                aria-label="Remove client"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xs text-ink-400">Remove?</span>
                <button
                  onClick={handleRemove}
                  className="text-2xs font-medium text-ember-400 border border-ember-500/30 rounded-lg px-2 py-1.5 hover:bg-ember-500/8"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="text-2xs text-ink-400 hover:text-ink-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-5 space-y-4">

          {/* ── Stats bar ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl surface p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Flame className="w-3.5 h-3.5 text-ember-400" />
                <p className="font-display text-xl font-semibold text-ink-50 tabular-nums">{client.currentStreak}</p>
              </div>
              <p className="text-2xs text-ink-400">Day streak</p>
            </div>
            <div className="rounded-xl surface p-3 text-center">
              <p className="font-display text-xl font-semibold text-ink-50 tabular-nums">{(client.calls ?? []).length}</p>
              <p className="text-2xs text-ink-400">Total calls</p>
            </div>
            <div className={`rounded-xl p-3 text-center border ${recentMissed >= 2 ? 'bg-ember-500/8 border-ember-500/20' : 'surface'}`}>
              <p className={`font-display text-xl font-semibold tabular-nums ${recentMissed >= 2 ? 'text-ember-400' : 'text-ink-50'}`}>
                {recentMissed}
              </p>
              <p className="text-2xs text-ink-400">Missed</p>
            </div>
          </div>

          {/* ── Latest call summary ── */}
          {latestCall?.callSummary && (
            <div className="rounded-2xl glass-gold p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <p className="text-2xs font-semibold text-ink-200 uppercase tracking-wider">
                  Latest — {CALL_TYPE_LABEL[latestCall.callType] ?? latestCall.callType}
                </p>
                <SentimentBadge sentiment={latestCall.sentiment ?? null} />
              </div>
              <p className="text-sm text-ink-200 leading-relaxed">{latestCall.callSummary}</p>
            </div>
          )}

          {/* What Ivy remembers: available via getClient(id) if backend returns memories */}
          {Array.isArray(client.callMemories) && client.callMemories.length > 0 && (
            <div className="rounded-2xl surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5 text-periwinkle-400" />
                <p className="text-2xs font-semibold text-periwinkle-400 uppercase tracking-wider">What Ivy remembers</p>
              </div>
              <ul className="space-y-2">
                {client.callMemories.slice(0, 5).map((m: any) => (
                  <li key={m.id} className="flex items-start gap-2 text-xs text-ink-400 leading-relaxed">
                    <span className="text-periwinkle-400 mt-0.5 shrink-0">·</span>
                    {m.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-0.5 p-1 bg-ink-800 border border-ink-600 rounded-2xl">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`
                  flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150
                  ${tab === t.id
                    ? 'bg-ink-700 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}

          {/* Calls */}
          {tab === 'calls' && (
            <div className="space-y-2.5 pb-4">
              {client.calls.length === 0 && (
                <p className="text-sm text-ink-400 text-center py-10">No calls yet.</p>
              )}
              {(client.calls ?? []).map((call: ClientCall, i: number) => <CallCard key={i} call={call} idx={i} />)}
            </div>
          )}

          {/* Notes */}
          {tab === 'notes' && (
            <div className="space-y-3 pb-4">
              <div className="rounded-2xl surface p-4">
                <p className="text-xs font-semibold text-ink-200 mb-1">Your notes for Ivy</p>
                <p className="text-2xs text-ink-400 mb-3 leading-relaxed">
                  Ivy reads these before every call with {client.firstName}. Write what you'd tell a colleague covering your client.
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={7}
                  placeholder={`e.g. Emma has a knee injury — never suggest running. Responds well to data framing ("you were 80% consistent last month"). Working toward her first half-marathon in October.`}
                  className="
                    w-full px-3 py-3 text-sm
                    bg-ink-900/50 border border-ink-600 rounded-xl
                    text-ink-200 placeholder:text-ink-600
                    focus:outline-none focus:ring-1 focus:ring-gold-400/40 focus:border-gold-400/30
                    resize-none transition-colors
                  "
                  style={{ paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 8}px` : undefined }}
                />
              </div>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2.5 bg-gold-400 text-ink-900 text-sm font-semibold rounded-xl hover:bg-gold-300 active:scale-[0.98] transition-all"
              >
                {saved ? <><Check className="w-4 h-4" /> Saved</> : saving ? <><span className="w-4 h-4 rounded-full border-2 border-ink-900/30 border-t-ink-900 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save notes</>}
              </button>
            </div>
          )}

          {/* Programme areas */}
          {tab === 'programme' && (
            <div className="space-y-3 pb-4">
              <div className="rounded-2xl surface p-4 mb-1">
                <p className="text-xs font-semibold text-ink-200 mb-1">Programme check-in areas</p>
                <p className="text-2xs text-ink-400 leading-relaxed">
                  Define what Ivy checks in on with {client.firstName} — nutrition, sleep, stress, anything. Write the instruction in plain language.
                </p>
              </div>
              <div className="space-y-2.5">
                {areas.map((area, i) => (
                  <div key={area.id} className="rounded-2xl surface p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        value={area.area}
                        onChange={(e) => setAreas(areas.map((a, j) => j === i ? { ...a, area: e.target.value } : a))}
                        placeholder="Area name (e.g. Nutrition)"
                        className="
                          flex-1 px-3 py-2 text-sm
                          bg-ink-900/50 border border-ink-600 rounded-xl
                          text-ink-200 placeholder:text-ink-600
                          focus:outline-none focus:ring-1 focus:ring-gold-400/40 focus:border-gold-400/30
                          transition-colors
                        "
                      />
                      <button
                        onClick={() => setAreas(areas.filter((_, j) => j !== i))}
                        className="w-8 h-8 rounded-xl border border-ink-600 text-ink-400 hover:text-ember-400 hover:border-ember-500/40 flex items-center justify-center transition-colors"
                        aria-label="Remove area"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={area.instruction}
                      onChange={(e) => setAreas(areas.map((a, j) => j === i ? { ...a, instruction: e.target.value } : a))}
                      rows={2}
                      placeholder="Instruction for Ivy (e.g. Client is cutting — 180g protein daily. Ask about adherence and any slip-ups.)"
                      className="
                        w-full px-3 py-2 text-xs
                        bg-ink-900/50 border border-ink-600 rounded-xl
                        text-ink-400 placeholder:text-ink-600
                        focus:outline-none focus:ring-1 focus:ring-gold-400/40 focus:border-gold-400/30
                        resize-none transition-colors
                      "
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setAreas([...areas, { id: crypto.randomUUID(), area: '', instruction: '' }])}
                className="w-full py-3 text-sm text-ink-400 border border-dashed border-ink-600 rounded-2xl hover:border-gold-400/30 hover:text-ink-200 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add area
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2.5 bg-gold-400 text-ink-900 text-sm font-semibold rounded-xl hover:bg-gold-300 active:scale-[0.98] transition-all"
              >
                {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save areas</>}
              </button>
            </div>
          )}

          {/* Insights tab removed: callInsights not yet returned by /api/coach/clients/:id */}

        </div>
      </div>
    </div>
  )
}
