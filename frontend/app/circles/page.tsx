'use client'

import { useState, useEffect, useCallback } from 'react'
import { circlesApi, circleGamesApi } from '@/lib/api'
import { Trophy, Zap, Users, Plus, ChevronRight, Pause, CheckCircle2, Loader2, Sparkles, Calendar, X } from 'lucide-react'
import { gameSuggestionsApi, type GameSuggestion } from '@/lib/api'
import Link from 'next/link'

interface CircleMember { userId: string; role: string; user: { id: string; firstName: string } }
interface Circle {
  id: string; name: string; track: string; tier: string
  seasonTheme?: string; size: number; maxSize: number; isActive: boolean
  members: CircleMember[]
}
interface Game {
  id: string; name: string; description?: string; templateType: string
  status: string; state: Record<string, any>; ivyInstruction: string
  events: { id: string; eventType: string; note?: string; createdAt: string }[]
}
interface Session {
  id: string; sprintNumber: number | null; scheduledAt: string
  conductedAt: string | null; status: string
  collectivePledge: string | null; highlights: string | null
  participantUserIds: string
}

const TEMPLATE_ICONS: Record<string, string> = {
  relay: '🏃', points_race: '🏆', collective: '🤝', custom: '✨',
}
const STATUS_COLOUR: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  completed: 'text-muted-foreground bg-muted/30 border-border',
}

type Tab = 'games' | 'sessions'

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([])
  const [fullCircle, setFullCircle] = useState<Circle | null>(null)
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [tab, setTab] = useState<Tab>('games')
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [closingSession, setClosingSession] = useState<Session | null>(null)

  useEffect(() => {
    circlesApi.getMy()
      .then((data) => {
        const typed = data as unknown as Circle[]
        setCircles(typed)
        if (typed.length > 0) setSelectedCircleId(typed[0].id)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedCircleId) return
    // Fetch full circle (with members) for attendance checklist
    circlesApi.get(selectedCircleId)
      .then((c) => setFullCircle(c as unknown as Circle))
      .catch(console.error)
    // Games
    setGamesLoading(true)
    circleGamesApi.listGames(selectedCircleId)
      .then((data) => setGames(data as unknown as Game[]))
      .catch(console.error)
      .finally(() => setGamesLoading(false))
    // Sessions
    setSessionsLoading(true)
    circlesApi.getSessions(selectedCircleId)
      .then((data) => setSessions(data as unknown as Session[]))
      .catch(console.error)
      .finally(() => setSessionsLoading(false))
  }, [selectedCircleId])

  const handlePause = async (gameId: string) => {
    await circleGamesApi.pauseGame(gameId)
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, status: 'paused' } : g))
  }
  const handleEnd = async (gameId: string) => {
    await circleGamesApi.endGame(gameId)
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, status: 'completed' } : g))
  }
  const handleSessionClosed = useCallback((updated: Session) => {
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    setClosingSession(null)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (circles.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No circle yet</h2>
          <p className="text-sm text-muted-foreground mb-6">Circles are available on Ivy Plus and above.</p>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const pendingSessions = sessions.filter((s) => s.status === 'scheduled')
  const pastSessions = sessions.filter((s) => s.status === 'completed')

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Your Circle</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {circles.find((c) => c.id === selectedCircleId)?.name}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        {/* Circle selector */}
        {circles.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {circles.map((c) => (
              <button key={c.id} onClick={() => setSelectedCircleId(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedCircleId === c.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Session alert — upcoming session banner */}
        {pendingSessions.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">
                Sprint {pendingSessions[0].sprintNumber} session scheduled
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(pendingSessions[0].scheduledAt).toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'short',
                })}
              </p>
            </div>
            <button
              onClick={() => { setClosingSession(pendingSessions[0]); setTab('sessions') }}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 shrink-0"
            >
              Close it →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-muted/30 rounded-xl">
          {(['games', 'sessions'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── GAMES TAB ── */}
        {tab === 'games' && (
          <>
            {/* Active game widget */}
            {!gamesLoading && games.filter((g) => g.status === 'active').length > 0 && (
              <div className="mb-5 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Active game</span>
                </div>
                {games.filter((g) => g.status === 'active').map((g) => (
                  <div key={g.id}>
                    <p className="text-sm font-semibold">{TEMPLATE_ICONS[g.templateType]} {g.name}</p>
                    {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handlePause(g.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
                        <Pause className="w-3 h-3" /> Pause
                      </button>
                      <button onClick={() => handleEnd(g.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
                        <CheckCircle2 className="w-3 h-3" /> End game
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedCircleId && (
              <button onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 mb-5 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4" /> Start a new game
              </button>
            )}

            {gamesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No games yet</p>
                <p className="text-xs text-muted-foreground">Start a game above — Ivy will run it for your circle.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">All games</p>
                {games.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{TEMPLATE_ICONS[g.templateType]} {g.name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLOUR[g.status] ?? STATUS_COLOUR.completed}`}>
                            {g.status}
                          </span>
                        </div>
                        {g.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>}
                        {g.events.length > 0 && g.events[0].note && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-1">"{g.events[0].note}"</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SESSIONS TAB ── */}
        {tab === 'sessions' && (
          <>
            {sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No sessions yet</p>
                <p className="text-xs text-muted-foreground">Sessions are scheduled automatically at the end of each sprint.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending */}
                {pendingSessions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">To close</p>
                    <div className="space-y-2.5">
                      {pendingSessions.map((s) => (
                        <div key={s.id} className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">Sprint {s.sprintNumber} session</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(s.scheduledAt).toLocaleDateString('en-GB', {
                                  weekday: 'short', day: 'numeric', month: 'short',
                                })}
                              </p>
                            </div>
                            <button
                              onClick={() => setClosingSession(s)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 text-amber-400 text-xs font-medium hover:bg-amber-400/25 transition-colors border border-amber-500/20"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Close session
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past */}
                {pastSessions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Past sessions</p>
                    <div className="space-y-2.5">
                      {pastSessions.map((s) => {
                        let attendees: string[] = []
                        try { attendees = JSON.parse(s.participantUserIds) } catch { attendees = [] }
                        return (
                          <div key={s.id} className="p-4 rounded-xl border border-border bg-card">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <p className="text-sm font-semibold">Sprint {s.sprintNumber} session</p>
                                <p className="text-xs text-muted-foreground">
                                  {s.conductedAt
                                    ? new Date(s.conductedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                                    : '—'}
                                  {attendees.length > 0 && ` · ${attendees.length} attended`}
                                </p>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground">done</span>
                            </div>
                            {s.collectivePledge && (
                              <p className="text-xs text-foreground/80 italic">"{s.collectivePledge}"</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create game modal */}
      {showCreate && selectedCircleId && (
        <CreateGameModal
          circleId={selectedCircleId}
          circleTrack={circles.find((c) => c.id === selectedCircleId)?.track}
          onClose={() => setShowCreate(false)}
          onCreated={(game) => { setGames((prev) => [game, ...prev]); setShowCreate(false) }}
        />
      )}

      {/* Close session modal */}
      {closingSession && fullCircle && (
        <CloseSessionModal
          session={closingSession}
          members={fullCircle.members}
          onClose={() => setClosingSession(null)}
          onClosed={handleSessionClosed}
        />
      )}
    </div>
  )
}

// ─── Close session modal ──────────────────────────────────────────────────────

function CloseSessionModal({ session, members, onClose, onClosed }: {
  session: Session
  members: CircleMember[]
  onClose: () => void
  onClosed: (updated: Session) => void
}) {
  const [attendees, setAttendees] = useState<Set<string>>(
    new Set(members.map((m) => m.userId)) // default: everyone attended
  )
  const [pledge, setPledge] = useState('')
  const [highlights, setHighlights] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAttendee = (userId: string) => {
    setAttendees((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  const handleClose = async () => {
    if (!pledge.trim()) { setError('Add the group pledge before closing.'); return }
    setSaving(true); setError('')
    try {
      const updated = await circlesApi.completeSession(session.id, {
        collectivePledge: pledge.trim(),
        highlights: highlights.trim() || undefined,
        participantUserIds: Array.from(attendees),
      })
      onClosed(updated as unknown as Session)
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message ?? 'Something went wrong')
    } finally { setSaving(false) }
  }

  const absentCount = members.length - attendees.size

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Close Sprint {session.sprintNumber} session</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Log who came and what the group committed to</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Attendance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Who showed up?</label>
              <span className="text-xs text-muted-foreground">
                {attendees.size}/{members.length} present
                {absentCount > 0 && <span className="text-amber-400 ml-1">· {absentCount} will get a catch-up call</span>}
              </span>
            </div>
            <div className="space-y-1.5">
              {members.map((m) => {
                const present = attendees.has(m.userId)
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleAttendee(m.userId)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                      present
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      present ? 'border-emerald-500 bg-emerald-500' : 'border-border'
                    }`}>
                      {present && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium">{m.user.firstName}</span>
                    {m.role === 'facilitator' && (
                      <span className="text-[10px] text-muted-foreground ml-auto">facilitator</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Collective pledge */}
          <div>
            <label className="text-xs font-medium block mb-1.5">Group pledge for next sprint</label>
            <textarea
              value={pledge}
              onChange={(e) => setPledge(e.target.value)}
              rows={3}
              placeholder="e.g. We all hit 4 sessions a week and check in on each other every Sunday"
              autoFocus
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Highlights */}
          <div>
            <label className="text-xs font-medium block mb-1">Session highlights <span className="text-muted-foreground font-normal">(optional)</span></label>
            <p className="text-xs text-muted-foreground mb-1.5">Key moments Ivy can reference in individual calls</p>
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={2}
              placeholder="e.g. Marcus hit a 30-day streak. Sarah is back after her injury."
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {absentCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400">
              {absentCount} member{absentCount > 1 ? 's' : ''} not present — Ivy will cover the session and group pledge in their next call.
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleClose} disabled={saving || !pledge.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Close session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create game modal ────────────────────────────────────────────────────────

interface Template {
  type: string; name: string; description: string
  defaultRules: Record<string, any>; defaultInstruction: string
}

function CreateGameModal({ circleId, circleTrack, onClose, onCreated }: {
  circleId: string
  circleTrack?: string
  onClose: () => void
  onCreated: (game: Game) => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [suggestions, setSuggestions] = useState<GameSuggestion[]>([])
  const [step, setStep] = useState<'pick' | 'details'>('pick')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ivyInstruction, setIvyInstruction] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      circleGamesApi.getTemplates(),
      gameSuggestionsApi.listPublished(circleTrack),
    ]).then(([t, s]) => {
      setTemplates(t as unknown as Template[])
      setSuggestions(s)
    }).catch(console.error)
  }, [circleTrack])

  const pickSuggestion = (s: GameSuggestion) => {
    setSelectedSuggestionId(s.id)
    setSelectedTemplate(null)
    setName(s.title); setDescription(s.description); setIvyInstruction(s.ivyInstruction)
    setStep('details')
  }

  const pickTemplate = (t: Template) => {
    setSelectedSuggestionId(undefined)
    setSelectedTemplate(t)
    setName(t.name); setDescription(''); setIvyInstruction(t.defaultInstruction)
    setStep('details')
  }

  const handleCreate = async () => {
    if (!name.trim() || !ivyInstruction.trim()) { setError('Name and Ivy instruction are required.'); return }
    setSaving(true); setError('')
    try {
      const game = await circleGamesApi.createGame(circleId, {
        name: name.trim(),
        description: description.trim() || undefined,
        templateType: selectedTemplate?.type ?? 'custom',
        ivyInstruction: ivyInstruction.trim(),
        suggestionId: selectedSuggestionId,
      })
      onCreated(game as unknown as Game)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{step === 'pick' ? 'Start a game' : 'Set up the game'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {step === 'pick' && (
          <div className="space-y-5">
            {suggestions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Suggested by Ivy</p>
                </div>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button key={s.id} onClick={() => pickSuggestion(s)}
                      className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-colors">
                      <span className="text-xl leading-none mt-0.5">{TEMPLATE_ICONS[s.templateType] ?? '✨'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                        {s.usageCount > 0 && (
                          <p className="text-[10px] text-amber-400/70 mt-1">Used by {s.usageCount} circle{s.usageCount === 1 ? '' : 's'}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">Start from scratch</p>
              <div className="space-y-2">
                {templates.length === 0 && <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />}
                {templates.map((t) => (
                  <button key={t.type} onClick={() => pickTemplate(t)}
                    className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <span className="text-xl leading-none mt-0.5">{TEMPLATE_ICONS[t.type] ?? '🎮'}</span>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <button onClick={() => setStep('pick')} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1.5">Game name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sprint 3 Relay"
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="One line for your circle members"
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Ivy's instruction</label>
              <p className="text-xs text-muted-foreground mb-2">Tell Ivy how to run this game in plain language.</p>
              <textarea value={ivyInstruction} onChange={(e) => setIvyInstruction(e.target.value)}
                rows={6}
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none" />
              <p className="text-[10px] text-muted-foreground mt-1">You can edit this anytime.</p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button onClick={handleCreate} disabled={saving || !name.trim() || !ivyInstruction.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Start game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
