'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const AUTO_RENEW_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto-renew seasons',
    description: 'Automatically start a new 8-week season when the current one ends',
    recommended: true,
  },
  {
    id: 'manual',
    label: 'Manual renewal',
    description: 'Manually start each new season when you\'re ready',
    recommended: false,
  },
]

export function SeasonSetupStep() {
  const [startDate, setStartDate] = useState('')
  const [autoRenew, setAutoRenew] = useState('auto')

  // Calculate end date (8 weeks from start)
  const calculateEndDate = (start: string) => {
    if (!start) return ''
    const date = new Date(start)
    date.setDate(date.getDate() + 56) // 8 weeks = 56 days
    return date.toISOString().split('T')[0]
  }

  const endDate = calculateEndDate(startDate)

  // TODO: Save season configuration to API

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Ivy programs run in 8-week seasons. Configure when your first season starts and how renewals work.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
        <h3 className="font-semibold mb-2">What is a Season?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          A season is an 8-week program cycle where employees:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Complete workouts and AI coaching calls</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Track their transformation and earn charitable donations</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Work toward their personal wellness goals</span>
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-base font-semibold">
            Season 1 Start Date
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Choose when your first 8-week season begins. Monday is recommended.
          </p>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-base"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {startDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-900">Season 1 Schedule</p>
                <p className="text-sm text-green-800">
                  {new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' - '}
                  {new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="text-2xl">📅</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-base font-semibold">Season Renewal</Label>
        {AUTO_RENEW_OPTIONS.map((option) => (
          <Card
            key={option.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              autoRenew === option.id
                ? 'ring-2 ring-indigo-600 bg-indigo-50'
                : 'hover:bg-accent/50'
            }`}
            onClick={() => setAutoRenew(option.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{option.label}</p>
                    {option.recommended && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        Recommended
                      </span>
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800">
              You can pause or modify season settings anytime from your admin dashboard. Employees can join mid-season.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
