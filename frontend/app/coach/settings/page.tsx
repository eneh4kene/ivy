'use client'

import { useState, useEffect } from 'react'
import { coachApi, type CoachProfile } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Eye, EyeOff } from 'lucide-react'

export default function CoachSettingsPage() {
  const [profile, setProfile] = useState<Partial<CoachProfile>>({
    programmeName: '',
    coachingStyle: '',
    programmeNotes: '',
    whitelabelEnabled: false,
    brandName: '',
    brandLogoUrl: '',
    alertOnMissedCalls: 3,
    weeklyDigestEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    coachApi.getProfile()
      .then((p) => { if (p) setProfile(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!profile.programmeName?.trim()) {
      setToast('Programme name is required.'); return
    }
    setSaving(true)
    try {
      const updated = await coachApi.updateProfile(profile)
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setToast(e.response?.data?.error ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const inputClass = 'w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary'
  const labelClass = 'text-xs font-medium block mb-1.5'

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/coach" className="p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold">Coach settings</h1>
        </div>

        <div className="space-y-5">

          {/* Programme */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-semibold">Your programme</h2>

            <div>
              <label className={labelClass}>Programme name *</label>
              <input value={profile.programmeName ?? ''} onChange={(e) => setProfile({ ...profile, programmeName: e.target.value })}
                placeholder="e.g. 12-Week Fat Loss, Marathon Prep, Strength Foundation"
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Coaching style <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input value={profile.coachingStyle ?? ''} onChange={(e) => setProfile({ ...profile, coachingStyle: e.target.value })}
                placeholder="e.g. direct and data-driven, nurturing and long-term"
                className={inputClass} />
              <p className="text-xs text-muted-foreground mt-1">Ivy matches this register in all client calls.</p>
            </div>

            <div>
              <label className={labelClass}>General client notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea value={profile.programmeNotes ?? ''} onChange={(e) => setProfile({ ...profile, programmeNotes: e.target.value })}
                rows={3} placeholder="Anything Ivy should know about all your clients (e.g. 'All clients are training for obstacle races — celebrate mental toughness over aesthetics')"
                className={`${inputClass} resize-none`} />
            </div>
          </div>

          {/* Alerts */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h2 className="text-sm font-semibold">Alerts</h2>

            <div>
              <label className={labelClass}>Alert me when a client misses this many calls in a row</label>
              <div className="flex gap-2">
                {[2, 3, 5].map((n) => (
                  <button key={n} type="button"
                    onClick={() => setProfile({ ...profile, alertOnMissedCalls: n })}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      profile.alertOnMissedCalls === n
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setProfile({ ...profile, weeklyDigestEnabled: !profile.weeklyDigestEnabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${profile.weeklyDigestEnabled ? 'bg-primary' : 'bg-muted border border-border'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${profile.weeklyDigestEnabled ? 'translate-x-5' : ''}`} />
              </button>
              <div>
                <p className="text-sm">Weekly client digest</p>
                <p className="text-xs text-muted-foreground">Email every Monday with each client's week at a glance</p>
              </div>
            </div>
          </div>

          {/* White-label */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-0.5">My branding</h2>
              <p className="text-xs text-muted-foreground">When enabled, your clients see your brand name instead of Ivy in emails and the app. "Powered by Ivy" attribution stays on all communications.</p>
            </div>

            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => setProfile({ ...profile, whitelabelEnabled: !profile.whitelabelEnabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${profile.whitelabelEnabled ? 'bg-primary' : 'bg-muted border border-border'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${profile.whitelabelEnabled ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm">{profile.whitelabelEnabled ? 'Using my branding' : 'Using Ivy branding'}</span>
              {profile.whitelabelEnabled
                ? <Eye className="w-4 h-4 text-primary ml-auto" />
                : <EyeOff className="w-4 h-4 text-muted-foreground ml-auto" />}
            </div>

            {profile.whitelabelEnabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className={labelClass}>Brand name *</label>
                  <input value={profile.brandName ?? ''} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })}
                    placeholder="e.g. Marcus Fitness, Coach Sarah, FitLife Coaching"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Logo URL <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input value={profile.brandLogoUrl ?? ''} onChange={(e) => setProfile({ ...profile, brandLogoUrl: e.target.value })}
                    placeholder="https://your-logo.com/logo.png"
                    className={inputClass} />
                  <p className="text-xs text-muted-foreground mt-1">36px height recommended. Leave empty to use text brand name.</p>
                </div>

                {/* Preview */}
                {profile.brandName && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Email preview</p>
                    <div className="flex items-center gap-2">
                      {profile.brandLogoUrl
                        ? <img src={profile.brandLogoUrl} alt={profile.brandName} className="h-6 object-contain" />
                        : <span className="text-sm font-bold text-foreground">{profile.brandName}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Powered by Ivy · Privacy · Terms</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {toast && <p className="text-xs text-destructive">{toast}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved
              ? '✓ Saved'
              : <><Save className="w-4 h-4" /> Save settings</>}
          </button>
        </div>
      </div>
    </div>
  )
}
