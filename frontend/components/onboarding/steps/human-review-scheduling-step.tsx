'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const AVAILABLE_SLOTS = [
  { id: '1', day: 'Monday', date: 'Jan 22', time: '10:00 AM', coach: 'Sarah M.' },
  { id: '2', day: 'Tuesday', date: 'Jan 23', time: '2:00 PM', coach: 'James T.' },
  { id: '3', day: 'Wednesday', date: 'Jan 24', time: '11:00 AM', coach: 'Maya L.' },
  { id: '4', day: 'Thursday', date: 'Jan 25', time: '3:00 PM', coach: 'David K.' },
  { id: '5', day: 'Friday', date: 'Jan 26', time: '9:00 AM', coach: 'Sarah M.' },
]

export function HumanReviewSchedulingStep() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // TODO: Connect to actual scheduling system and coach availability

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          As a Concierge member, you get human coaching sessions where an expert reviews your progress and provides personalized guidance.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
        <h3 className="font-semibold mb-2">What to Expect</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>30-minute video call with a certified wellness coach</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Review your transformation scores, workout consistency, and AI call insights</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Get personalized recommendations to optimize your approach</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Adjust goals and track preferences based on your progress</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mb-4">Select Your First Session</h3>
        <div className="space-y-3">
          {AVAILABLE_SLOTS.map((slot) => (
            <Card
              key={slot.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedSlot === slot.id
                  ? 'ring-2 ring-indigo-600 bg-indigo-50'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => setSelectedSlot(slot.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{slot.day}</p>
                      <p className="font-bold text-lg">{slot.date}</p>
                    </div>
                    <div className="h-12 w-px bg-border" />
                    <div>
                      <p className="font-medium">{slot.time}</p>
                      <p className="text-sm text-muted-foreground">with {slot.coach}</p>
                    </div>
                  </div>
                  {selectedSlot === slot.id && (
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

      {selectedSlot && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">Session selected!</p>
              <p className="text-sm text-green-800">
                You'll receive a calendar invite with video call details shortly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
