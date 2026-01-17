'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const CALL_FREQUENCIES = [
  { id: 'weekly', label: 'Weekly', description: 'Every week throughout your season', recommended: true },
  { id: 'biweekly', label: 'Bi-weekly', description: 'Every 2 weeks (4 calls per season)' },
  { id: 'monthly', label: 'Monthly', description: 'Once per month (2 calls per season)' },
]

const PREFERRED_DAYS = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
]

const PREFERRED_TIMES = [
  { id: 'morning', label: 'Morning (9-11 AM)' },
  { id: 'midday', label: 'Midday (12-2 PM)' },
  { id: 'afternoon', label: 'Afternoon (3-5 PM)' },
]

export function StrategyCallSchedulingStep() {
  const [frequency, setFrequency] = useState<string>('weekly')
  const [preferredDay, setPreferredDay] = useState<string | null>(null)
  const [preferredTime, setPreferredTime] = useState<string | null>(null)

  // TODO: Save preferences and schedule recurring calls

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Monthly strategy calls help you refine your approach, overcome obstacles, and stay aligned with your goals.
        </p>
      </div>

      <div>
        <Label className="text-base font-semibold mb-4 block">How often would you like strategy calls?</Label>
        <div className="space-y-3">
          {CALL_FREQUENCIES.map((freq) => (
            <Card
              key={freq.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                frequency === freq.id
                  ? 'ring-2 ring-indigo-600 bg-indigo-50'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setFrequency(freq.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{freq.label}</p>
                      {freq.recommended && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{freq.description}</p>
                  </div>
                  {frequency === freq.id && (
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-4 block">Preferred day of week</Label>
        <div className="grid grid-cols-5 gap-2">
          {PREFERRED_DAYS.map((day) => (
            <Card
              key={day.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                preferredDay === day.id
                  ? 'ring-2 ring-indigo-600 bg-indigo-50'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setPreferredDay(day.id)}
            >
              <CardContent className="p-3 text-center">
                <p className="text-sm font-medium">{day.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-4 block">Preferred time</Label>
        <div className="grid gap-3 md:grid-cols-3">
          {PREFERRED_TIMES.map((time) => (
            <Card
              key={time.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                preferredTime === time.id
                  ? 'ring-2 ring-indigo-600 bg-indigo-50'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setPreferredTime(time.id)}
            >
              <CardContent className="p-4 text-center">
                <p className="font-medium">{time.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {preferredDay && preferredTime && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">Preferences saved!</p>
              <p className="text-sm text-green-800">
                We'll schedule your {frequency} calls for {PREFERRED_DAYS.find(d => d.id === preferredDay)?.label}s in the {PREFERRED_TIMES.find(t => t.id === preferredTime)?.label.toLowerCase()}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
