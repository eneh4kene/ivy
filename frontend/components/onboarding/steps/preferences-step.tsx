'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { usersApi } from '@/lib/api'
import { Phone, MessageSquare } from 'lucide-react'

const VIBES = [
  {
    id: 'CALLS',
    label: 'Caller',
    description: "I'm fine picking up",
    icon: Phone,
  },
  {
    id: 'TEXTS',
    label: 'Texter',
    description: "I'd rather not talk on the phone",
    icon: MessageSquare,
  },
]

const CALL_TIMES = [
  { id: 'morning', label: 'Morning', time: '7:00 – 9:00 AM', icon: '🌅' },
  { id: 'midday', label: 'Midday', time: '12:00 – 2:00 PM', icon: '☀️' },
  { id: 'afternoon', label: 'Afternoon', time: '4:00 – 6:00 PM', icon: '🌤️' },
  { id: 'evening', label: 'Evening', time: '7:00 – 9:00 PM', icon: '🌙' },
]

const CALL_TIME_MAP: Record<string, { morning: string; evening: string }> = {
  morning: { morning: '07:00', evening: '09:00' },
  midday: { morning: '12:00', evening: '14:00' },
  afternoon: { morning: '16:00', evening: '18:00' },
  evening: { morning: '19:00', evening: '21:00' },
}

export function PreferencesStep() {
  const [vibe, setVibe] = useState<string | null>(null)
  const [preferredCallTime, setPreferredCallTime] = useState<string | null>(null)

  const handleVibeSelect = async (vibeId: string) => {
    setVibe(vibeId)
    try {
      // Both start on ADAPTIVE — vibe just sets Ivy's initial posture
      await usersApi.updateProfile({ commStyle: 'ADAPTIVE' })
    } catch (e) {
      console.error('Failed to save vibe:', e)
    }
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
        console.error('Failed to save call time:', e)
      }
    }
  }

  return (
    <div className="space-y-10">

      {/* Vibe check */}
      <div>
        <Label className="text-base font-semibold mb-1 block">
          Are you more of a caller or a texter?
        </Label>
        <p className="text-sm text-muted-foreground mb-5">
          Ivy adapts either way — this just helps her know where to start.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {VIBES.map((v) => {
            const Icon = v.icon
            const selected = vibe === v.id
            return (
              <div
                key={v.id}
                onClick={() => handleVibeSelect(v.id)}
                className={`flex flex-col items-center gap-3 p-5 rounded-xl border cursor-pointer transition-all ${
                  selected
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-border/80 hover:bg-accent/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">{v.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Call time — shown for everyone, framed around when Ivy checks in */}
      <div className="border-t border-border pt-8">
        <Label className="text-base font-semibold mb-1 block">
          When works best for your check-ins?
        </Label>
        <p className="text-sm text-muted-foreground mb-5">
          Morning sets your commitment. Evening closes the loop.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {CALL_TIMES.map((timeSlot) => (
            <div
              key={timeSlot.id}
              onClick={() => handleCallTimeSelect(timeSlot.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                preferredCallTime === timeSlot.id
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border hover:border-border/80 hover:bg-accent/30'
              }`}
            >
              <span className="text-xl">{timeSlot.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{timeSlot.label}</p>
                <p className="text-xs text-muted-foreground">{timeSlot.time}</p>
              </div>
              {preferredCallTime === timeSlot.id && (
                <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
