'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { usersApi } from '@/lib/api'

const CALL_TIMES = [
  { id: 'morning', label: 'Morning', time: '7:00 AM - 9:00 AM', icon: '🌅' },
  { id: 'midday', label: 'Midday', time: '12:00 PM - 2:00 PM', icon: '☀️' },
  { id: 'afternoon', label: 'Afternoon', time: '4:00 PM - 6:00 PM', icon: '🌤️' },
  { id: 'evening', label: 'Evening', time: '7:00 PM - 9:00 PM', icon: '🌙' },
]

const NOTIFICATION_PREFERENCES = [
  { id: 'workout-reminders', label: 'Workout reminders', description: 'Get notified about upcoming workouts' },
  { id: 'call-reminders', label: 'Call reminders', description: 'Reminders before AI coaching calls' },
  { id: 'weekly-summary', label: 'Weekly summary', description: 'Your progress recap every Sunday' },
  { id: 'donation-updates', label: 'Donation updates', description: 'See your charitable impact' },
]

const CALL_TIME_MAP: Record<string, { morning: string; evening: string }> = {
  morning: { morning: '07:00', evening: '09:00' },
  midday: { morning: '12:00', evening: '14:00' },
  afternoon: { morning: '16:00', evening: '18:00' },
  evening: { morning: '19:00', evening: '21:00' },
}

export function PreferencesStep() {
  const [preferredCallTime, setPreferredCallTime] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<string[]>(['workout-reminders', 'call-reminders', 'weekly-summary'])

  const toggleNotification = (id: string) => {
    setNotifications(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    )
  }

  const handleCallTimeSelect = async (timeId: string) => {
    setPreferredCallTime(timeId)
    const times = CALL_TIME_MAP[timeId]
    if (times) {
      try {
        await usersApi.updateProfile({
          morningCallTime: times.morning,
          eveningCallTime: times.evening,
        })
      } catch (e) {
        console.error('Failed to save preferences:', e)
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Label className="text-base font-semibold mb-4 block">
          When do you prefer to take your AI coaching calls?
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Calls are 7-15 minutes. Choose a time that fits your schedule.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {CALL_TIMES.map((timeSlot) => (
            <Card
              key={timeSlot.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                preferredCallTime === timeSlot.id
                  ? 'ring-2 ring-indigo-600 bg-indigo-50'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => handleCallTimeSelect(timeSlot.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{timeSlot.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{timeSlot.label}</p>
                    <p className="text-sm text-muted-foreground">{timeSlot.time}</p>
                  </div>
                  {preferredCallTime === timeSlot.id && (
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t pt-8">
        <Label className="text-base font-semibold mb-4 block">
          Notification preferences
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Customize how Ivy keeps you informed and accountable.
        </p>
        <div className="space-y-3">
          {NOTIFICATION_PREFERENCES.map((pref) => (
            <div
              key={pref.id}
              className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleNotification(pref.id)}
            >
              <div className="pt-0.5">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  notifications.includes(pref.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300'
                }`}>
                  {notifications.includes(pref.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <p className="font-medium">{pref.label}</p>
                <p className="text-sm text-muted-foreground">{pref.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800">
              You can update these preferences anytime from your settings page.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
