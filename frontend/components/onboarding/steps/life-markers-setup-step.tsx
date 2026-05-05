'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { statsApi } from '@/lib/api'

interface LifeMarker {
  id: string
  name: string
  description: string
  saved: boolean
}

const SUGGESTED_MARKERS = [
  { name: 'Quality time with family', icon: '👨‍👩‍👧‍👦' },
  { name: 'Career progress', icon: '💼' },
  { name: 'Financial security', icon: '💰' },
  { name: 'Creative pursuits', icon: '🎨' },
  { name: 'Spiritual practice', icon: '🧘' },
  { name: 'Social connections', icon: '🤝' },
]

export function LifeMarkersSetupStep() {
  const [markers, setMarkers] = useState<LifeMarker[]>([])
  const [newMarkerName, setNewMarkerName] = useState('')
  const [newMarkerDescription, setNewMarkerDescription] = useState('')

  const addMarker = async (name: string, description: string = '') => {
    if (!name.trim()) return

    const tempId = Date.now().toString()
    const newMarker: LifeMarker = { id: tempId, name: name.trim(), description: description.trim(), saved: false }
    setMarkers(prev => [...prev, newMarker])
    setNewMarkerName('')
    setNewMarkerDescription('')

    try {
      await statsApi.createLifeMarker({
        marker: name.trim(),
        category: 'mental',
        significance: 'medium',
      })
      setMarkers(prev => prev.map(m => m.id === tempId ? { ...m, saved: true } : m))
    } catch {
      setMarkers(prev => prev.filter(m => m.id !== tempId))
    }
  }

  const removeMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Life markers help you track what truly matters beyond traditional wellness metrics. Define up to 5 personal markers you want to improve.
        </p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="font-semibold mb-3">What are Life Markers?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Life markers are the non-quantifiable aspects of your life that matter most to you. They could be relationships, career satisfaction, creativity, or anything else that contributes to your overall wellbeing.
        </p>
        <p className="text-sm font-medium">Suggestions:</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTED_MARKERS.map((marker) => (
            <Button
              key={marker.name}
              variant="outline"
              size="sm"
              onClick={() => addMarker(marker.name)}
              disabled={markers.length >= 5 || markers.some(m => m.name === marker.name)}
            >
              {marker.icon} {marker.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Add a custom life marker</Label>
        <div className="space-y-2">
          <Input
            placeholder="e.g., Reading more books"
            value={newMarkerName}
            onChange={(e) => setNewMarkerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMarker(newMarkerName, newMarkerDescription)}
          />
          <Input
            placeholder="Why this matters to you (optional)"
            value={newMarkerDescription}
            onChange={(e) => setNewMarkerDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMarker(newMarkerName, newMarkerDescription)}
          />
          <Button
            onClick={() => addMarker(newMarkerName, newMarkerDescription)}
            disabled={!newMarkerName.trim() || markers.length >= 5}
            className="w-full"
          >
            Add Life Marker
          </Button>
        </div>
      </div>

      {markers.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Your life markers ({markers.length}/5)</Label>
          {markers.map((marker) => (
            <Card key={marker.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{marker.name}</p>
                      {marker.saved && <span className="text-xs text-green-600">✓ saved</span>}
                    </div>
                    {marker.description && (
                      <p className="text-sm text-muted-foreground mt-1">{marker.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeMarker(marker.id)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {markers.length >= 5 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            You&apos;ve reached the maximum of 5 life markers. You can edit these anytime from your dashboard.
          </p>
        </div>
      )}
    </div>
  )
}
