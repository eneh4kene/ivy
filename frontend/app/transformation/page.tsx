'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { canAccessFeature } from '@/lib/permissions'
import { LockedFeature, LockedFeatureInline } from '@/components/locked-feature'
import { useAuthStore } from '@/lib/store/auth.store'
import api from '@/lib/api'
import type { TransformationScore, LifeMarker, CreateTransformationScoreInput, CreateLifeMarkerInput } from '@/lib/types'

export default function TransformationPage() {
  const user = useAuthStore((state) => state.user)
  const [scores, setScores] = useState<TransformationScore[]>([])
  const [lifeMarkers, setLifeMarkers] = useState<LifeMarker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [showMarkerModal, setShowMarkerModal] = useState(false)

  // Check feature access
  const canAccessScores = canAccessFeature(user, 'energyMoodScores')
  const canAccessHealthConfidence = canAccessFeature(user, 'healthConfidence')
  const canAccessLifeMarkers = canAccessFeature(user, 'lifeMarkers')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessScores, canAccessLifeMarkers])

  const fetchData = async () => {
    // Only fetch data if user has access to the features
    if (!canAccessScores) {
      setIsLoading(false)
      return
    }

    try {
      const scoresData = await api.stats.getTransformationScores()
      setScores(scoresData.scores || [])

      if (canAccessLifeMarkers) {
        const markersData = await api.stats.getLifeMarkers()
        setLifeMarkers(markersData)
      }
    } catch (error) {
      console.error('Failed to fetch transformation data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show locked feature if user doesn't have access to basic transformation tracking
  if (!canAccessScores) {
    return (
      <LockedFeature
        feature="energyMoodScores"
        featureName="Transformation Tracking"
        description="Track your personal growth with weekly energy and mood scores, health confidence tracking, and celebrate major life milestones."
      />
    )
  }

  const latestScore = scores[0]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transformation Journal</h1>
          <p className="text-muted-foreground">
            Track your personal growth and celebrate milestones
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowScoreModal(true)}
            disabled={!canAccessHealthConfidence}
          >
            Log Weekly Score
          </Button>
          {canAccessLifeMarkers ? (
            <Button variant="outline" onClick={() => setShowMarkerModal(true)}>
              Add Life Marker
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Add Life Marker (Elite+)
            </Button>
          )}
        </div>
      </div>

      {/* Latest Score */}
      {latestScore && (
        <Card className="mb-8 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle>Latest Transformation Score</CardTitle>
            <CardDescription>Week {latestScore.weekNumber}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-6 ${canAccessHealthConfidence ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Energy</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-purple-600">
                    {latestScore.energyScore || 0}
                  </span>
                  <span className="text-muted-foreground mb-1">/10</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Mood</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-pink-600">
                    {latestScore.moodScore || 0}
                  </span>
                  <span className="text-muted-foreground mb-1">/10</span>
                </div>
              </div>
              {canAccessHealthConfidence && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Health Confidence</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-indigo-600">
                      {latestScore.healthConfidence || 0}
                    </span>
                    <span className="text-muted-foreground mb-1">/10</span>
                  </div>
                </div>
              )}
            </div>
            {!canAccessHealthConfidence && (
              <div className="mt-4">
                <LockedFeatureInline
                  feature="healthConfidence"
                  featureName="Health Confidence Tracking"
                />
              </div>
            )}
            {latestScore.notes && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-purple-100">
                <p className="text-sm">{latestScore.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Transformation Scores History */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Scores</CardTitle>
            <CardDescription>
              Your transformation tracking history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scores.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-muted-foreground mb-4">No scores logged yet</p>
                <Button onClick={() => setShowScoreModal(true)}>
                  Log Your First Score
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {scores.map((score) => (
                  <div
                    key={score.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Week {score.weekNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(score.createdAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Energy</p>
                        <p className="font-medium">{score.energyScore || '-'}/10</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Mood</p>
                        <p className="font-medium">{score.moodScore || '-'}/10</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Health</p>
                        <p className="font-medium">{score.healthConfidence || '-'}/10</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Life Markers */}
        <Card>
          <CardHeader>
            <CardTitle>Life Markers</CardTitle>
            <CardDescription>
              Celebrate your wins and milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canAccessLifeMarkers ? (
              <LockedFeatureInline
                feature="lifeMarkers"
                featureName="Life Markers"
              />
            ) : lifeMarkers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <p className="text-muted-foreground mb-4">No markers added yet</p>
                <Button variant="outline" onClick={() => setShowMarkerModal(true)}>
                  Add Your First Marker
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lifeMarkers.map((marker) => (
                  <div
                    key={marker.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full mt-1 ${
                        marker.significance === 'major' ? 'bg-red-500' :
                        marker.significance === 'medium' ? 'bg-orange-500' :
                        'bg-green-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium mb-1">{marker.marker}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                            {marker.category}
                          </span>
                          <span>{formatDate(marker.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {showScoreModal && (
        <TransformationScoreModal
          onClose={() => setShowScoreModal(false)}
          onSuccess={() => {
            setShowScoreModal(false)
            fetchData()
          }}
        />
      )}

      {showMarkerModal && (
        <LifeMarkerModal
          onClose={() => setShowMarkerModal(false)}
          onSuccess={() => {
            setShowMarkerModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function TransformationScoreModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState<CreateTransformationScoreInput>({
    energyScore: undefined,
    moodScore: undefined,
    healthConfidence: undefined,
    notes: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.stats.createTransformationScore(formData)
      onSuccess()
    } catch (error) {
      console.error('Failed to create transformation score:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log Weekly Score</CardTitle>
          <CardDescription>
            Rate your energy, mood, and health confidence (1-10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="energy">Energy Score (1-10)</Label>
              <Input
                id="energy"
                type="number"
                min="1"
                max="10"
                value={formData.energyScore || ''}
                onChange={(e) => setFormData({ ...formData, energyScore: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mood">Mood Score (1-10)</Label>
              <Input
                id="mood"
                type="number"
                min="1"
                max="10"
                value={formData.moodScore || ''}
                onChange={(e) => setFormData({ ...formData, moodScore: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="health">Health Confidence (1-10)</Label>
              <Input
                id="health"
                type="number"
                min="1"
                max="10"
                value={formData.healthConfidence || ''}
                onChange={(e) => setFormData({ ...formData, healthConfidence: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="How are you feeling this week?"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Score'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function LifeMarkerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState<CreateLifeMarkerInput>({
    marker: '',
    category: 'physical',
    significance: 'medium',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.stats.createLifeMarker(formData)
      onSuccess()
    } catch (error) {
      console.error('Failed to create life marker:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add Life Marker</CardTitle>
          <CardDescription>
            Record a significant milestone or achievement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marker">What happened?</Label>
              <Input
                id="marker"
                placeholder="e.g., Ran my first 5K!"
                value={formData.marker}
                onChange={(e) => setFormData({ ...formData, marker: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
              >
                <option value="physical">Physical</option>
                <option value="mental">Mental</option>
                <option value="social">Social</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="significance">Significance</Label>
              <select
                id="significance"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.significance}
                onChange={(e) => setFormData({ ...formData, significance: e.target.value as any })}
              >
                <option value="small">Small Win</option>
                <option value="medium">Medium Achievement</option>
                <option value="major">Major Milestone</option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Marker'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
