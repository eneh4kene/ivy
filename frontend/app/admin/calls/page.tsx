'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'

type CallRecord = {
  id: string
  callType: string
  scheduledAt: string
  duration: number | null
  outcome: string | null
  sentiment: string | null
  transcript: string | null
  user: { id: string; firstName: string; lastName: string; email: string; track: string; goal: string }
  workoutFollowed: { activity: string; status: string } | null
}

const CALL_TYPE_LABELS: Record<string, string> = {
  MORNING_PLANNING: 'Morning',
  EVENING_REVIEW: 'Evening',
  RESCUE: 'Rescue',
  WEEKLY_PLANNING: 'Weekly',
  MONTHLY_CHECKIN: 'Monthly',
  ONBOARDING: 'Onboarding',
  SEASON_CLOSE: 'Season Close',
}

const SENTIMENT_CONFIG: Record<string, { label: string; className: string }> = {
  positive:   { label: 'Positive',   className: 'bg-green-100 text-green-700' },
  neutral:    { label: 'Neutral',    className: 'bg-gray-100 text-gray-600' },
  struggling: { label: 'Struggling', className: 'bg-red-100 text-red-700' },
}

function formatDuration(secs: number | null) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function TranscriptView({ transcript }: { transcript: string }) {
  const lines = transcript.split('\n').filter(Boolean)
  return (
    <div className="space-y-3 font-mono text-sm">
      {lines.map((line, i) => {
        const isAgent = /^(Agent|Ivy|AI):/i.test(line)
        const isUser = /^(User|Human|Caller):/i.test(line)
        const speaker = isAgent ? line.split(':')[0] : isUser ? line.split(':')[0] : null
        const content = speaker ? line.slice(speaker.length + 1).trim() : line

        return (
          <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 w-16 text-xs font-semibold pt-1 ${isAgent ? 'text-indigo-600' : isUser ? 'text-right text-gray-500' : 'text-gray-400'}`}>
              {speaker ?? ''}
            </div>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isAgent
                ? 'bg-indigo-50 text-gray-800 rounded-tl-sm'
                : isUser
                ? 'bg-gray-100 text-gray-800 rounded-tr-sm'
                : 'text-gray-400 italic'
            }`}>
              {content}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CallCard({ call }: { call: CallRecord }) {
  const [expanded, setExpanded] = useState(false)
  const sentiment = call.sentiment ? SENTIMENT_CONFIG[call.sentiment] : null
  const initials = `${call.user.firstName[0]}${call.user.lastName[0]}`

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Row */}
      <button
        className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials}
          </div>

          {/* Name + goal */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {call.user.firstName} {call.user.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{call.user.goal || call.user.track}</p>
          </div>

          {/* Call type */}
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 flex-shrink-0">
            {CALL_TYPE_LABELS[call.callType] ?? call.callType}
          </span>

          {/* Sentiment */}
          {sentiment && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${sentiment.className}`}>
              {sentiment.label}
            </span>
          )}

          {/* Workout followed */}
          <div className="flex-shrink-0 w-24 text-right">
            {call.workoutFollowed ? (
              <span className="text-xs text-green-600 font-medium">✓ Closed</span>
            ) : call.callType === 'MORNING_PLANNING' ? (
              <span className="text-xs text-orange-500">No close</span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          {/* Duration */}
          <div className="flex-shrink-0 w-12 text-right text-xs text-muted-foreground tabular-nums">
            {formatDuration(call.duration)}
          </div>

          {/* Date */}
          <div className="flex-shrink-0 text-xs text-muted-foreground w-24 text-right">
            {new Date(call.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded transcript */}
      {expanded && (
        <div className="border-t border-border">
          {/* Context bar */}
          <div className="px-4 py-3 bg-muted/30 flex flex-wrap gap-4 text-xs text-muted-foreground border-b border-border">
            <span><strong>Track:</strong> {call.user.track}</span>
            <span><strong>Goal:</strong> {call.user.goal || '—'}</span>
            <span><strong>Duration:</strong> {formatDuration(call.duration)}</span>
            <span><strong>Outcome:</strong> {call.outcome ?? '—'}</span>
            {call.workoutFollowed && (
              <span className="text-green-600"><strong>Workout:</strong> {call.workoutFollowed.activity} ({call.workoutFollowed.status.toLowerCase()})</span>
            )}
          </div>

          {/* Transcript */}
          <div className="p-6 max-h-[600px] overflow-y-auto">
            {call.transcript ? (
              <TranscriptView transcript={call.transcript} />
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                Transcript not yet available — Retell processes it asynchronously after the call ends.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CallsReviewPage() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState({ callType: '', sentiment: '' })
  const LIMIT = 20

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.getCalls({
        limit: LIMIT,
        offset,
        callType: filters.callType || undefined,
        sentiment: filters.sentiment || undefined,
      })
      setCalls(data.data ?? [])
      setTotal((data as any).meta?.total ?? 0)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load calls')
    } finally {
      setIsLoading(false)
    }
  }, [offset, filters])

  useEffect(() => { load() }, [load])

  const answeredCount = calls.filter(c => c.outcome !== 'no_answer').length
  const closedCount = calls.filter(c => c.callType === 'MORNING_PLANNING' && c.workoutFollowed).length
  const morningCount = calls.filter(c => c.callType === 'MORNING_PLANNING').length
  const strugglingCount = calls.filter(c => c.sentiment === 'struggling').length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Call Review</h1>
        <p className="text-muted-foreground text-sm">Read transcripts, spot patterns, understand what Ivy is doing in the wild.</p>
      </div>

      {/* Pulse metrics — snapshot of this page's results */}
      {!isLoading && calls.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Answer rate</p>
            <p className="text-2xl font-bold">{calls.length > 0 ? Math.round((answeredCount / calls.length) * 100) : 0}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Morning close rate</p>
            <p className="text-2xl font-bold">{morningCount > 0 ? Math.round((closedCount / morningCount) * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">workout logged same day</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Struggling signals</p>
            <p className="text-2xl font-bold">{strugglingCount}</p>
            <p className="text-xs text-muted-foreground">of {calls.length} calls</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Total reviewed</p>
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">completed calls</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          value={filters.callType}
          onChange={e => { setFilters(f => ({ ...f, callType: e.target.value })); setOffset(0) }}
        >
          <option value="">All call types</option>
          {Object.entries(CALL_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          value={filters.sentiment}
          onChange={e => { setFilters(f => ({ ...f, sentiment: e.target.value })); setOffset(0) }}
        >
          <option value="">All sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="struggling">Struggling</option>
        </select>

        {(filters.callType || filters.sentiment) && (
          <button
            className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground"
            onClick={() => { setFilters({ callType: '', sentiment: '' }); setOffset(0) }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Call list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-600">{error}</div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No completed calls yet.{filters.callType || filters.sentiment ? ' Try clearing filters.' : ''}
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map(call => <CallCard key={call.id} call={call} />)}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            >
              Previous
            </button>
            <button
              className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(o => o + LIMIT)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
