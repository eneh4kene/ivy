'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { seasonsApi } from '@/lib/api'

const AUTO_RENEW_OPTIONS = [
  { id: 'auto', label: 'Auto-renew seasons', description: 'Automatically start a new season when the current one ends', recommended: true },
  { id: 'manual', label: 'Manual renewal', description: "Manually start each new season when you're ready" },
]

export function SeasonSetupStep() {
  const [startDate, setStartDate] = useState('')
  const [autoRenew, setAutoRenew] = useState('auto')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateEndDate = (start: string) => {
    if (!start) return ''
    const date = new Date(start)
    date.setDate(date.getDate() + 84) // 12 weeks = 84 days
    return date.toISOString().split('T')[0]
  }

  const endDate = calculateEndDate(startDate)

  const handleSave = async () => {
    if (!startDate) { setError('Please select a start date'); return }
    setSaving(true)
    setError(null)
    try {
      await seasonsApi.create({
        goal: 'Season 1',
        startDate,
      })
      setSaved(true)
    } catch (err: any) {
      // Season may already exist — not a hard failure
      if (err.response?.status === 409 || err.message?.includes('already')) {
        setSaved(true)
      } else {
        setError(err.message ?? 'Failed to create season')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Ivy programs run in 12-week seasons, split into three 4-week sprints. Configure when your first season starts.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-base font-semibold">Season 1 Start Date</Label>
          <p className="text-sm text-muted-foreground">Choose when your first 12-week season begins. Monday is recommended.</p>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setSaved(false) }}
            className="text-base"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {startDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">Season 1 Schedule</p>
            <p className="text-sm text-green-800">
              {new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' — '}
              {new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs text-green-700 mt-1">3 sprints of 4 weeks each</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Season Renewal</Label>
        {AUTO_RENEW_OPTIONS.map((option) => (
          <Card
            key={option.id}
            className={`cursor-pointer transition-all hover:shadow-md ${autoRenew === option.id ? 'ring-2 ring-indigo-600 bg-indigo-50' : 'hover:bg-accent/50'}`}
            onClick={() => setAutoRenew(option.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{option.label}</p>
                    {option.recommended && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">Recommended</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                {autoRenew === option.id && (
                  <svg className="w-6 h-6 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSave} disabled={saving || !startDate} className="w-full">
        {saving ? 'Saving…' : saved ? '✓ Season created' : 'Create Season'}
      </Button>
    </div>
  )
}
