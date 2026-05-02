'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { usersApi } from '@/lib/api'
import { Phone, MessageSquare, Sparkles } from 'lucide-react'

const COMM_STYLES = [
  {
    id: 'ADAPTIVE',
    label: 'Let Ivy decide',
    description: 'Ivy reads the moment — calls when it matters, texts when it fits. Recommended.',
    icon: Sparkles,
    recommended: true,
  },
  {
    id: 'CALLS',
    label: 'I prefer calls',
    description: "Ivy calls you every day. Voice creates a stronger commitment loop — harder to lie out loud than to tap a button.",
    icon: Phone,
    recommended: false,
  },
  {
    id: 'TEXTS',
    label: 'I prefer texts',
    description: "Ivy checks in over WhatsApp. She may occasionally ask to call for bigger moments — you can always say no.",
    icon: MessageSquare,
    recommended: false,
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
  const [commStyle, setCommStyle] = useState<string>('ADAPTIVE')
  const [preferredCallTime, setPreferredCallTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCommStyleSelect = async (styleId: string) => {
    setCommStyle(styleId)
    setSaving(true)
    try {
      await usersApi.updateProfile({ commStyle: styleId as any })
    } catch (e) {
      console.error('Failed to save comm style:', e)
    } finally {
      setSaving(false)
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

  const showCallTimePicker = commStyle === 'CALLS' || commStyle === 'ADAPTIVE'

  return (
    <div className="space-y-8">

      {/* Comm style */}
      <div>
        <Label className="text-base font-semibold mb-1 block">
          How do you want Ivy to reach you?
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          You can change this at any time in settings.
        </p>
        <div className="space-y-3">
          {COMM_STYLES.map((style) => {
            const Icon = style.icon
            const selected = commStyle === style.id
            return (
              <div
                key={style.id}
                onClick={() => handleCommStyleSelect(style.id)}
                className={`relative flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selected
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-border/80 hover:bg-accent/30'
                }`}
              >
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  selected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{style.label}</span>
                    {style.recommended && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {style.description}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-all ${
                  selected ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
                }`} />
              </div>
            )
          })}
        </div>

        {commStyle === 'TEXTS' && (
          <div className="mt-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
            Most users find that saying a commitment out loud makes it 3× more likely they'll follow through — something about your own voice makes it real. Ivy will occasionally ask if she can call for bigger moments. You can always say no.
          </div>
        )}
      </div>

      {/* Call time picker — only for CALLS and ADAPTIVE */}
      {showCallTimePicker && (
        <div className="border-t border-border pt-8">
          <Label className="text-base font-semibold mb-1 block">
            When do you want Ivy to call?
          </Label>
          <p className="text-sm text-muted-foreground mb-4">
            Morning call sets your commitment. Evening call closes the loop.
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
      )}

    </div>
  )
}
