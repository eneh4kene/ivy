'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Target, Plus, Sparkles, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { seasonsApi } from '@/lib/api'
import type { Season, Sprint } from '@/lib/types'

const statusColors: Record<string, string> = {
  ACTIVE: 'text-primary bg-primary/10 border-primary/20',
  CLOSING: 'text-gold-400 bg-gold-400/10 border-gold-400/20',
  CLOSED: 'text-muted-foreground bg-muted/30 border-border',
}

const sprintStatusColors: Record<string, string> = {
  ACTIVE: 'bg-primary',
  COMPLETED: 'bg-muted-foreground',
}

function SprintBar({ sprint, current }: { sprint: Sprint; current: boolean }) {
  const start = new Date(sprint.startDate)
  const end = new Date(sprint.endDate)
  const now = new Date()
  const progress = sprint.status === 'COMPLETED' ? 100
    : sprint.status === 'ACTIVE' ? Math.min(100, Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100))
    : 0

  return (
    <div className={`p-3 rounded-lg border ${current ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">Sprint {sprint.number}</span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[sprint.status]}`}>
          {sprint.status}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${sprintStatusColors[sprint.status] ?? 'bg-muted-foreground'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </p>
    </div>
  )
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newGoal, setNewGoal] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    seasonsApi.getAll()
      .then(setSeasons)
      .catch(() => setSeasons([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newGoal.trim()) return
    setCreating(true)
    try {
      const season = await seasonsApi.create({ goal: newGoal, title: newTitle || undefined })
      setSeasons(prev => [season!, ...prev])
      setShowForm(false)
      setNewGoal('')
      setNewTitle('')
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const activeSeason = seasons.find(s => s.status === 'ACTIVE')

  return (
    <div className="max-w-3xl mx-auto px-4 pt-safe-t py-8">
      {/* ── Nav ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/home">
          <button
            className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-ink-200" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight leading-tight">Seasons</h1>
          <p className="text-muted-foreground text-sm mt-0.5">12-week transformation arcs · 3 sprints each</p>
        </div>
        {!activeSeason && (
          <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> New Season
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 p-5 rounded-xl border border-primary/20 bg-primary/5">
          <h3 className="font-semibold mb-4">Start a New Season</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Season Name (optional)</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Operation Ironman"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">12-Week Goal *</label>
              <input
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="e.g. Complete a half marathon"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating || !newGoal.trim()}>
                {creating ? 'Creating...' : 'Start Season'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse" />)}
        </div>
      ) : seasons.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="mb-4">No seasons yet. Start your first 12-week arc.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Start First Season
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {seasons.map(season => (
            <div key={season.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Season {season.number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[season.status]}`}>
                      {season.status}
                    </span>
                  </div>
                  {season.title && <p className="font-semibold">{season.title}</p>}
                  <p className={`text-sm ${season.title ? 'text-muted-foreground' : 'font-semibold'}`}>{season.goal}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{new Date(season.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  <p>to {new Date(season.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                </div>
              </div>

              {season.sprints.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {season.sprints.map(sprint => {
                    const now = new Date()
                    const isCurrent = sprint.status === 'ACTIVE' && new Date(sprint.startDate) <= now && new Date(sprint.endDate) >= now
                    return <SprintBar key={sprint.id} sprint={sprint} current={isCurrent} />
                  })}
                </div>
              )}

              {season.arcSummary && (
                <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-periwinkle-400" />
                    <span className="text-xs font-medium">Season Close Summary</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{season.arcSummary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
