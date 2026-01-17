'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function GoalSettingStep() {
  const [primaryGoal, setPrimaryGoal] = useState('')
  const [whyItMatters, setWhyItMatters] = useState('')
  const [successLooksLike, setSuccessLooksLike] = useState('')

  // TODO: Save goals to API when component unmounts or on next

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Clear goals help Ivy provide better coaching. Your goals are completely private and only used to personalize your experience.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="primaryGoal" className="text-base font-semibold">
            What's your primary goal for the next 8 weeks?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Be specific. Instead of "get fit", try "run 3 miles without stopping" or "do 10 push-ups".
          </p>
          <Input
            id="primaryGoal"
            placeholder="e.g., Exercise 4 times per week consistently"
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whyItMatters" className="text-base font-semibold">
            Why does this goal matter to you?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Understanding your motivation helps Ivy keep you accountable during tough moments.
          </p>
          <Textarea
            id="whyItMatters"
            placeholder="e.g., I want to have more energy to play with my kids and set a good example for them..."
            value={whyItMatters}
            onChange={(e) => setWhyItMatters(e.target.value)}
            rows={4}
            className="text-base resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="successLooksLike" className="text-base font-semibold">
            How will you know you've succeeded?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Define success in concrete, measurable terms.
          </p>
          <Textarea
            id="successLooksLike"
            placeholder="e.g., I'll feel proud when I complete all 4 workouts per week for 6 out of 8 weeks..."
            value={successLooksLike}
            onChange={(e) => setSuccessLooksLike(e.target.value)}
            rows={4}
            className="text-base resize-none"
          />
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-8">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-indigo-900 mb-1">Ivy's approach to goals</p>
            <p className="text-sm text-indigo-800">
              Your AI coach will reference these goals during your calls, celebrate progress, and help you stay accountable. You can update them anytime from your dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
