'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'

const TRACKS = [
  {
    id: 'fitness',
    name: 'Fitness',
    icon: '💪',
    description: 'Build strength, endurance, and physical vitality',
    focus: 'Physical health and athletic performance',
    workouts: 'Strength training, cardio, flexibility',
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: '🎯',
    description: 'Sharpen mental clarity and productivity',
    focus: 'Cognitive performance and concentration',
    workouts: 'Meditation, breathwork, mental exercises',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    icon: '😴',
    description: 'Optimize rest and recovery for peak performance',
    focus: 'Sleep quality and restorative practices',
    workouts: 'Wind-down routines, sleep hygiene, relaxation',
  },
  {
    id: 'balance',
    name: 'Balance',
    icon: '⚖️',
    description: 'Harmonize work, life, and personal wellbeing',
    focus: 'Holistic wellness and life integration',
    workouts: 'Yoga, mindfulness, stress management',
  },
]

export function TrackSelectionStep() {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)

  // TODO: Save selection to API when component unmounts or on next

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Choose the wellness area you want to focus on for the next 8 weeks. Don't worry—you can change this later or explore other tracks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TRACKS.map((track) => (
          <Card
            key={track.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTrack === track.id
                ? 'ring-2 ring-indigo-600 bg-indigo-50'
                : 'hover:bg-accent/50'
            }`}
            onClick={() => setSelectedTrack(track.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{track.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{track.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {track.description}
                  </p>
                  <div className="space-y-2">
                    <div className="text-xs">
                      <span className="font-medium">Focus:</span>{' '}
                      <span className="text-muted-foreground">{track.focus}</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">Workouts:</span>{' '}
                      <span className="text-muted-foreground">{track.workouts}</span>
                    </div>
                  </div>
                </div>
                {selectedTrack === track.id && (
                  <svg className="w-6 h-6 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTrack && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">Great choice!</p>
              <p className="text-sm text-green-800">
                Your {TRACKS.find(t => t.id === selectedTrack)?.name} track is selected. You'll receive personalized workouts and AI coaching calls tailored to this focus.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
