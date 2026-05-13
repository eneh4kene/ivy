'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usersApi } from '@/lib/api'

export function GoalSettingStep() {
  const [goal, setGoal] = useState('')
  const [giftFrame, setGiftFrame] = useState('')
  const [minimumMode, setMinimumMode] = useState('')

  const saveGoals = async () => {
    if (!goal.trim()) return
    try {
      await usersApi.updateProfile({
        goal: goal.trim(),
        giftFrame: giftFrame.trim() || undefined,
        minimumMode: minimumMode.trim() || undefined,
      })
    } catch (e) {
      console.error('Failed to save goals:', e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          These three answers shape every call Ivy makes. Be honest — the more specific you are, the better Ivy can support you.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="goal" className="text-base font-semibold">
            What's your goal for the next 12 weeks?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Be specific. "Run 5k without stopping" lands better than "get fit."
          </p>
          <Input
            id="goal"
            placeholder="e.g., Run 5k without stopping, meditate every morning, be in bed by 10:30pm"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={saveGoals}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="giftFrame" className="text-base font-semibold">
            Who are you doing this for — or what changes if you get there?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Ivy uses this on hard days when you're about to give up. "My kids" or "I want energy back" both work.
          </p>
          <Input
            id="giftFrame"
            placeholder="e.g., My kids, my partner, myself — I want to feel like myself again"
            value={giftFrame}
            onChange={(e) => setGiftFrame(e.target.value)}
            onBlur={saveGoals}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minimumMode" className="text-base font-semibold">
            What's the minimum you'd accept on a terrible day?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            This is your floor — it still counts, it still earns the donation. Be realistic about what's always possible.
          </p>
          <Input
            id="minimumMode"
            placeholder="e.g., A 10-minute walk, one chapter, 5 minutes of breathing"
            value={minimumMode}
            onChange={(e) => setMinimumMode(e.target.value)}
            onBlur={saveGoals}
            className="text-base"
          />
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-8">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-indigo-900 mb-1">How Ivy uses these</p>
            <p className="text-sm text-indigo-800">
              Your goal shapes the daily check-ins. The gift frame comes up in rescue calls when you're close to skipping. The minimum is what Ivy offers when "all or nothing" isn't working.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
