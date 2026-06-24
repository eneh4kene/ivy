'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { canAccessFeature } from '@/lib/permissions'
import { LockedFeature, LockedFeatureInline } from '@/components/locked-feature'
import { useAuthStore } from '@/lib/store/auth.store'
import api from '@/lib/api'
import type { TransformationScore, LifeMarker, CreateTransformationScoreInput, CreateLifeMarkerInput } from '@/lib/types'
import { TrendingUp, Star, Plus, X, Zap, Heart, Shield, Calendar } from 'lucide-react'

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = (value / 10) * 100
  const r = 28
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{value || '—'}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

const significanceConfig = {
  major: { label: 'Major Milestone', color: 'text-ember-400', dot: 'bg-ember-400', bg: 'bg-ember-400/10 border-ember-400/20' },
  medium: { label: 'Achievement', color: 'text-gold-400', dot: 'bg-gold-400', bg: 'bg-gold-400/10 border-gold-400/20' },
  small: { label: 'Small Win', color: 'text-primary', dot: 'bg-primary', bg: 'bg-primary/10 border-primary/20' },
}

export default function TransformationPage() {
  const user = useAuthStore((state) => state.user)
  const [scores, setScores] = useState<TransformationScore[]>([])
  const [lifeMarkers, setLifeMarkers] = useState<LifeMarker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [showMarkerModal, setShowMarkerModal] = useState(false)

  const canAccessScores = canAccessFeature(user, 'energyMoodScores')
  const canAccessHealthConfidence = canAccessFeature(user, 'healthConfidence')
  const canAccessLifeMarkers = canAccessFeature(user, 'lifeMarkers')

  useEffect(() => {
    if (!canAccessScores) { setIsLoading(false); return }
    Promise.all([
      api.stats.getTransformationScores(),
      canAccessLifeMarkers ? api.stats.getLifeMarkers() : Promise.resolve([]),
    ]).then(([s, m]) => {
      setScores(s.scores || [])
      setLifeMarkers(m)
    }).catch(console.error)
      .finally(() => setIsLoading(false))
  }, [canAccessScores, canAccessLifeMarkers])

  if (!canAccessScores) {
    return (
      <LockedFeature
        feature="energyMoodScores"
        featureName="Transformation Tracking"
        description="Track personal growth with weekly energy and mood scores, health confidence tracking, and life milestones."
      />
    )
  }

  const latest = scores[0]

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Transformation Journal</h1>
          <p className="text-muted-foreground text-sm">Track your personal growth and milestones</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowScoreModal(true)} disabled={!canAccessHealthConfidence} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Log Score
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkerModal(true)}
            disabled={!canAccessLifeMarkers}
          >
            <Star className="w-3.5 h-3.5 mr-1.5" />
            Life Marker
          </Button>
        </div>
      </div>

      {/* Latest score card */}
      {latest && !isLoading && (
        <div className="relative rounded-2xl border border-periwinkle-400/20 bg-periwinkle-400/5 p-6 sm:p-8 mb-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-periwinkle-400/8 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold">Latest Score</h2>
                <p className="text-xs text-muted-foreground">Week {latest.weekNumber}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-periwinkle-400" />
            </div>
            <div className={`grid gap-8 ${canAccessHealthConfidence ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <ScoreRing value={latest.energyScore || 0} label="Energy" color="#f59e0b" />
              <ScoreRing value={latest.moodScore || 0} label="Mood" color="#a78bfa" />
              {canAccessHealthConfidence && (
                <ScoreRing value={latest.healthConfidence || 0} label="Health" color="#4ade80" />
              )}
            </div>
            {!canAccessHealthConfidence && (
              <div className="mt-5">
                <LockedFeatureInline feature="healthConfidence" featureName="Health Confidence Tracking" />
              </div>
            )}
            {latest.notes && (
              <div className="mt-5 p-4 rounded-xl bg-background/40 border border-border/50">
                <p className="text-sm text-muted-foreground italic">"{latest.notes}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-8 mb-6">
          <div className="animate-pulse flex gap-8 justify-center">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-muted" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Weekly scores history */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Weekly Scores</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your tracking history</p>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse p-4 rounded-xl border border-border">
                    <div className="h-4 bg-muted rounded w-24 mb-2" />
                    <div className="grid grid-cols-3 gap-3">
                      {[...Array(3)].map((_, j) => <div key={j} className="h-8 bg-muted rounded" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : scores.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-sm mb-1">No scores logged</p>
                <p className="text-xs text-muted-foreground mb-4">Start tracking your weekly progress</p>
                <Button size="sm" onClick={() => setShowScoreModal(true)}>
                  Log first score
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scores.map((score) => (
                  <div key={score.id} className="p-4 rounded-xl border border-border hover:border-border/80 hover:bg-accent/20 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Week {score.weekNumber}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(score.createdAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Energy', val: score.energyScore, color: 'text-gold-400' },
                        { label: 'Mood', val: score.moodScore, color: 'text-periwinkle-400' },
                        { label: 'Health', val: score.healthConfidence, color: 'text-primary' },
                      ].map((s) => (
                        <div key={s.label} className="bg-muted/40 rounded-lg p-2">
                          <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.val || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Life Markers */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Life Markers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Celebrate your wins</p>
            </div>
            <Star className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="p-4">
            {!canAccessLifeMarkers ? (
              <div className="py-8">
                <LockedFeatureInline feature="lifeMarkers" featureName="Life Markers" />
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse p-4 rounded-xl border border-border space-y-2">
                    <div className="h-4 bg-muted rounded w-40" />
                    <div className="h-3 bg-muted rounded w-24" />
                  </div>
                ))}
              </div>
            ) : lifeMarkers.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Star className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-sm mb-1">No markers yet</p>
                <p className="text-xs text-muted-foreground mb-4">Record significant milestones</p>
                <Button size="sm" variant="outline" onClick={() => setShowMarkerModal(true)}>
                  Add first marker
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lifeMarkers.map((marker) => {
                  const sig = significanceConfig[marker.significance as keyof typeof significanceConfig] || significanceConfig.medium
                  return (
                    <div key={marker.id} className={`p-4 rounded-xl border transition-all hover:opacity-90 ${sig.bg}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${sig.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1.5">{marker.marker}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-medium px-2 py-0.5 rounded-md bg-background/40 ${sig.color}`}>
                              {sig.label}
                            </span>
                            <span className="text-muted-foreground capitalize">{marker.category}</span>
                            <span className="text-muted-foreground">{formatDate(marker.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showScoreModal && (
        <ScoreModal
          onClose={() => setShowScoreModal(false)}
          onSuccess={() => { setShowScoreModal(false); window.location.reload() }}
        />
      )}
      {showMarkerModal && (
        <MarkerModal
          onClose={() => setShowMarkerModal(false)}
          onSuccess={() => { setShowMarkerModal(false); window.location.reload() }}
        />
      )}
    </div>
  )
}

function ScoreModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState<CreateTransformationScoreInput>({
    energyScore: undefined, moodScore: undefined, healthConfidence: undefined, notes: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.stats.createTransformationScore(formData)
      onSuccess()
    } catch (error) { console.error(error) }
    finally { setIsLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-lg tracking-tight">Log Weekly Score</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Rate your week from 1–10</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { key: 'energyScore', label: 'Energy Score', icon: Zap, color: 'text-gold-400' },
            { key: 'moodScore', label: 'Mood Score', icon: Heart, color: 'text-periwinkle-400' },
            { key: 'healthConfidence', label: 'Health Confidence', icon: Shield, color: 'text-primary' },
          ].map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="space-y-1.5">
              <label className={`text-sm font-medium flex items-center gap-1.5 ${color}`}>
                <Icon className="w-3.5 h-3.5" />{label} (1–10)
              </label>
              <Input
                type="number" min="1" max="10"
                value={(formData as any)[key] || ''}
                onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value) || undefined })}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              placeholder="How are you feeling this week?"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save Score'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MarkerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState<CreateLifeMarkerInput>({
    marker: '', category: 'physical', significance: 'medium',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.stats.createLifeMarker(formData)
      onSuccess()
    } catch (error) { console.error(error) }
    finally { setIsLoading(false) }
  }

  const selectClass = "flex h-11 w-full rounded-lg border border-input bg-input px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-lg tracking-tight">Add Life Marker</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Record a milestone or achievement</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What happened? *</label>
            <Input
              placeholder="e.g., Ran my first 5K!"
              value={formData.marker}
              onChange={(e) => setFormData({ ...formData, marker: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <select className={selectClass} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}>
                <option value="physical">Physical</option>
                <option value="mental">Mental</option>
                <option value="social">Social</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Significance</label>
              <select className={selectClass} value={formData.significance} onChange={(e) => setFormData({ ...formData, significance: e.target.value as any })}>
                <option value="small">Small Win</option>
                <option value="medium">Achievement</option>
                <option value="major">Major Milestone</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Adding…' : 'Add Marker'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
