'use client'

import { useState, useEffect } from 'react'
import { circlesApi, circleGamesApi } from '@/lib/api'
import { Trophy, Zap, Users, Plus, ChevronRight, Pause, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { gameSuggestionsApi, type GameSuggestion } from '@/lib/api'
import Link from 'next/link'

interface Circle { id: string; name: string; track: string; size: number; maxSize: number }
interface Game {
  id: string; name: string; description?: string; templateType: string
  status: string; state: Record<string, any>; ivyInstruction: string
  events: { id: string; eventType: string; note?: string; createdAt: string }[]
}

const TEMPLATE_ICONS: Record<string, string> = {
  relay: '🏃',
  points_race: '🏆',
  collective: '🤝',
  custom: '✨',
}

const STATUS_COLOUR: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  completed: 'text-muted-foreground bg-muted/30 border-border',
}

export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [gamesLoading, setGamesLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    circlesApi.getMy()
      .then((data) => {
        setCircles(data as unknown as Circle[])
        if (data.length > 0) setSelectedCircleId((data[0] as unknown as Circle).id)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedCircleId) return
    setGamesLoading(true)
    circleGamesApi.listGames(selectedCircleId)
      .then((data) => setGames(data as unknown as Game[]))
      .catch(console.error)
      .finally(() => setGamesLoading(false))
  }, [selectedCircleId])

  const handlePause = async (gameId: string) => {
    await circleGamesApi.pauseGame(gameId)
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, status: 'paused' } : g))
  }

  const handleEnd = async (gameId: string) => {
    await circleGamesApi.endGame(gameId)
    setGames((prev) => prev.map((g) => g.id === gameId ? { ...g, status: 'completed' } : g))
  }

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
          <p className="text-sm text-muted-foreground mb-6">Circles are available on Ivy Plus and above. Ask your coach to set one up.</p>
          <Link href="/dashboard" className="text-sm text-primary hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const selectedCircle = circles.find((c) => c.id === selectedCircleId)

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Your Circle</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Games your group is playing with Ivy</p>
          </div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
        </div>

        {/* Circle selector (if in multiple) */}
        {circles.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {circles.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCircleId(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedCircleId === c.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Active game widget */}
        {!gamesLoading && games.filter((g) => g.status === 'active').length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Active game</span>
            </div>
            {games.filter((g) => g.status === 'active').map((g) => (
              <div key={g.id}>
                <p className="text-sm font-semibold">{TEMPLATE_ICONS[g.templateType]} {g.name}</p>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handlePause(g.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <Pause className="w-3 h-3" /> Pause
                  </button>
                  <button
                    onClick={() => handleEnd(g.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" /> End game
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create game button */}
        {selectedCircleId && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 mb-6 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4" /> Start a new game
          </button>
        )}

        {/* Games list */}
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
      </div>

      {/* Create game modal */}
      {showCreate && selectedCircleId && (
        <CreateGameModal
          circleId={selectedCircleId}
          circleTrack={selectedCircle?.track}
          onClose={() => setShowCreate(false)}
          onCreated={(game) => {
            setGames((prev) => [game, ...prev])
            setShowCreate(false)
          }}
        />
      )}
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
    setName(s.title)
    setDescription(s.description)
    setIvyInstruction(s.ivyInstruction)
    setStep('details')
  }

  const pickTemplate = (t: Template) => {
    setSelectedSuggestionId(undefined)
    setSelectedTemplate(t)
    setName(t.name)
    setDescription('')
    setIvyInstruction(t.defaultInstruction)
    setStep('details')
  }

  const handleCreate = async () => {
    if (!name.trim() || !ivyInstruction.trim()) {
      setError('Name and Ivy instruction are required.')
      return
    }
    setSaving(true)
    setError('')
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">
            {step === 'pick' ? 'Start a game' : 'Set up the game'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {step === 'pick' && (
          <div className="space-y-5">
            {/* Suggestions from Ivy */}
            {suggestions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Suggested by Ivy</p>
                </div>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button key={s.id} onClick={() => pickSuggestion(s)}
                      className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/8 transition-colors">
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

            {/* Blank templates */}
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
            <button onClick={() => setStep('pick')}
              className="text-xs text-muted-foreground hover:text-foreground">
              ← Back
            </button>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1.5">Game name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sprint 3 Relay"
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One line for your circle members"
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Ivy's instruction</label>
              <p className="text-xs text-muted-foreground mb-2">
                Tell Ivy — in plain language — how to run this game. She reads this every call and handles it naturally.
              </p>
              <textarea
                value={ivyInstruction}
                onChange={(e) => setIvyInstruction(e.target.value)}
                rows={6}
                placeholder="e.g. 'When someone completes their workout, they pass the baton to the next person in order. Celebrate the pass, remind the new holder they have 24 hours. If they miss, deduct a life and pass anyway.'"
                className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">You can edit this anytime. The template above pre-fills a starting point.</p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !ivyInstruction.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Start game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
