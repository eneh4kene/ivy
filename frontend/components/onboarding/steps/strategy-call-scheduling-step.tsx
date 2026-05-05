'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { usersApi } from '@/lib/api'

const CALL_FREQUENCIES = [
  { id: 'daily', label: 'Daily', calls: 7 },
  { id: 'weekdays', label: 'Weekdays (Mon–Fri)', calls: 5 },
  { id: 'thrice', label: '3× per week', calls: 3 },
  { id: 'twice', label: '2× per week', calls: 2 },
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const PRESET_DAYS: Record<string, string[]> = {
  daily: DAYS,
  weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  thrice: ['monday', 'wednesday', 'friday'],
  twice: ['monday', 'thursday'],
}

export function StrategyCallSchedulingStep() {
  const [frequency, setFrequency] = useState<string>('twice')
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'thursday'])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async (days: string[], freq: string) => {
    setSaving(true)
    try {
      await usersApi.updateProfile({
        preferredDays: JSON.stringify(days),
        callFrequency: CALL_FREQUENCIES.find(f => f.id === freq)?.calls ?? 2,
      })
      setSaved(true)
    } catch {
      // non-blocking; user can still continue
    } finally {
      setSaving(false)
    }
  }

  const handleFrequencyChange = (freqId: string) => {
    const days = PRESET_DAYS[freqId] ?? []
    setFrequency(freqId)
    setSelectedDays(days)
    setSaved(false)
    save(days, freqId)
  }

  const toggleDay = (day: string) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day]
    setSelectedDays(next)
    setSaved(false)
    save(next, frequency)
  }

  // Save on mount with defaults
  useEffect(() => {
    save(selectedDays, frequency)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Choose which days Ivy should call you. You can always change this from your settings.
        </p>
      </div>

      <div>
        <Label className="text-base font-semibold mb-4 block">Call frequency</Label>
        <div className="grid grid-cols-2 gap-3">
          {CALL_FREQUENCIES.map((freq) => (
            <Card
              key={freq.id}
              className={`cursor-pointer transition-all hover:shadow-md ${frequency === freq.id ? 'ring-2 ring-indigo-600 bg-indigo-50' : 'hover:bg-accent/50'}`}
              onClick={() => handleFrequencyChange(freq.id)}
            >
              <CardContent className="p-4">
                <p className="font-medium">{freq.label}</p>
                <p className="text-sm text-muted-foreground">{freq.calls}× per week</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Call days</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectedDays.includes(day)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-background border-border hover:bg-accent/50'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      {selectedDays.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-900">
            {saved ? '✓ Preferences saved' : saving ? 'Saving…' : ''}
          </p>
          <p className="text-sm text-green-800">
            Ivy will call you on: {selectedDays.map(d => DAY_LABELS[d]).join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}
