'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { Phone, MessageSquare, Shuffle } from 'lucide-react'
import type { CommStyle } from '@/lib/types'

const VIBES = [
  {
    id: 'ADAPTIVE' as CommStyle,
    label: 'Let Ivy learn',
    description: 'Calls by default — adapts from there',
    sub: 'Recommended',
    icon: Shuffle,
  },
  {
    id: 'CALLS' as CommStyle,
    label: 'Always call',
    description: "I'm fine picking up — always ring me",
    sub: null,
    icon: Phone,
  },
  {
    id: 'TEXTS' as CommStyle,
    label: 'Texts first',
    description: "I'd rather not talk on the phone",
    sub: null,
    icon: MessageSquare,
  },
]

const MORNING_SLOTS = [
  { id: '06:00', label: '6:00 AM', icon: '🌅' },
  { id: '07:00', label: '7:00 AM', icon: '☀️' },
  { id: '08:00', label: '8:00 AM', icon: '🌤️' },
  { id: '09:00', label: '9:00 AM', icon: '🌞' },
]

const EVENING_SLOTS = [
  { id: '18:00', label: '6:00 PM', icon: '🌆' },
  { id: '19:00', label: '7:00 PM', icon: '🌇' },
  { id: '20:00', label: '8:00 PM', icon: '🌙' },
  { id: '21:00', label: '9:00 PM', icon: '🌃' },
]

interface PreferencesStepProps {
  onPhoneReady?: (ready: boolean) => void
}

export function PreferencesStep({ onPhoneReady }: PreferencesStepProps) {
  const user = useAuthStore((state) => state.user)
  const [vibe, setVibe] = useState<CommStyle | null>(null)
  const [morningSlot, setMorningSlot] = useState<string | null>(null)
  const [eveningSlot, setEveningSlot] = useState<string | null>(null)
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [phoneSaved, setPhoneSaved] = useState(!!user?.phone)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    if (user?.phone) {
      setPhone(user.phone)
      setPhoneSaved(true)
      onPhoneReady?.(true)
    }
  }, [user?.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoneSave = async () => {
    const cleaned = phone.trim().replace(/\s/g, '')
    if (!cleaned) {
      setPhoneError('Phone number is required — this is how Ivy calls you')
      setPhoneSaved(false)
      onPhoneReady?.(false)
      return
    }
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      setPhoneError('Include your country code (e.g. +447700900000 or +12125551234)')
      setPhoneSaved(false)
      onPhoneReady?.(false)
      return
    }
    setPhoneSaving(true)
    setPhoneError('')
    try {
      await usersApi.updateProfile({ phone: cleaned })
      setPhoneSaved(true)
      onPhoneReady?.(true)
    } catch {
      setPhoneError('Failed to save — please try again')
      setPhoneSaved(false)
      onPhoneReady?.(false)
    } finally {
      setPhoneSaving(false)
    }
  }

  const handleVibeSelect = async (vibeId: CommStyle) => {
    setVibe(vibeId)
    try {
      await usersApi.updateProfile({ commStyle: vibeId })
    } catch (e) {
      console.error('Failed to save communication style:', e)
    }
  }

  const handleMorningSlot = async (slotId: string) => {
    setMorningSlot(slotId)
    try {
      await usersApi.updateProfile({ morningCallTime: slotId })
    } catch (e) {
      console.error('Failed to save morning call time:', e)
    }
  }

  const handleEveningSlot = async (slotId: string) => {
    setEveningSlot(slotId)
    try {
      await usersApi.updateProfile({ eveningCallTime: slotId })
    } catch (e) {
      console.error('Failed to save evening call time:', e)
    }
  }

  return (
    <div className="space-y-10">

      {/* Phone number */}
      <div>
        <Label className="text-base font-semibold mb-1 block">
          What's your phone number?
        </Label>
        <p className="text-sm text-muted-foreground mb-3">
          Ivy calls you here each day. Include your country code.
        </p>
        <Input
          type="tel"
          placeholder="+44 7700 900000"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            if (phoneSaved) { setPhoneSaved(false); onPhoneReady?.(false) }
            if (phoneError) setPhoneError('')
          }}
          onBlur={handlePhoneSave}
          className={phoneError ? 'border-red-500' : phoneSaved ? 'border-emerald-500' : ''}
        />
        {phoneSaving && <p className="text-xs text-muted-foreground mt-1.5">Saving…</p>}
        {phoneError && <p className="text-xs text-red-500 mt-1.5">{phoneError}</p>}
        {phoneSaved && !phoneSaving && <p className="text-xs text-emerald-600 mt-1.5">✓ Saved</p>}
      </div>

      {/* Vibe check */}
      <div>
        <Label className="text-base font-semibold mb-1 block">
          How would you like Ivy to reach you?
        </Label>
        <p className="text-sm text-muted-foreground mb-5">
          This is a starting point — Ivy will adapt based on what actually works.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {VIBES.map((v) => {
            const Icon = v.icon
            const selected = vibe === v.id
            return (
              <div
                key={v.id}
                onClick={() => handleVibeSelect(v.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selected
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-border/80 hover:bg-accent/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{v.label}</p>
                    {v.sub && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        {v.sub}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                </div>
                {selected && <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Morning call time */}
      <div className="border-t border-border pt-8">
        <Label className="text-base font-semibold mb-1 block">
          Morning check-in time
        </Label>
        <p className="text-sm text-muted-foreground mb-5">
          When Ivy calls to plan your day.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {MORNING_SLOTS.map((slot) => (
            <div
              key={slot.id}
              onClick={() => handleMorningSlot(slot.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                morningSlot === slot.id
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border hover:border-border/80 hover:bg-accent/30'
              }`}
            >
              <span className="text-xl">{slot.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{slot.label}</p>
              </div>
              {morningSlot === slot.id && (
                <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Evening call time */}
      <div>
        <Label className="text-base font-semibold mb-1 block">
          Evening check-in time
        </Label>
        <p className="text-sm text-muted-foreground mb-5">
          When Ivy calls to see how it went.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {EVENING_SLOTS.map((slot) => (
            <div
              key={slot.id}
              onClick={() => handleEveningSlot(slot.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                eveningSlot === slot.id
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border hover:border-border/80 hover:bg-accent/30'
              }`}
            >
              <span className="text-xl">{slot.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{slot.label}</p>
              </div>
              {eveningSlot === slot.id && (
                <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
