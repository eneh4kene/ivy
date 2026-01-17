'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface LifeMarker {
  id: string
  name: string
  description: string
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

  const addMarker = (name: string, description: string = '') => {
    if (!name.trim()) return

    const newMarker: LifeMarker = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
    }

    setMarkers([...markers, newMarker])
    setNewMarkerName('')
    setNewMarkerDescription('')
  }

  const removeMarker = (id: string) => {
    setMarkers(markers.filter(m => m.id !== id))
  }

  // TODO: Save life markers to API

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
        <p className="text-sm font-medium">Examples:</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTED_MARKERS.map((marker, index) => (
            <Button
              key={index}
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

      {/* Custom Marker Input */}
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

      {/* Added Markers */}
      {markers.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Your life markers ({markers.length}/5)</Label>
          {markers.map((marker) => (
            <Card key={marker.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{marker.name}</p>
                    {marker.description && (
                      <p className="text-sm text-muted-foreground mt-1">{marker.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMarker(marker.id)}
                    className="flex-shrink-0"
                  >
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
            You've reached the maximum of 5 life markers. You can edit these anytime from your dashboard.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800">
              Ivy will check in on these markers during your AI calls and human review sessions, helping you maintain balance across all areas of your life.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
