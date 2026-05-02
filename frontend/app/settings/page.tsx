'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName, getTierPrice } from '@/lib/permissions'
import { useCurrencyStore } from '@/lib/store/currency.store'
import api, { buddyApi } from '@/lib/api'
import type { UpdateProfileInput, AccountabilityBuddy } from '@/lib/types'
import { User, Phone, Clock, Target, CreditCard, Trash2, Download, CheckCircle2, AlertCircle, ChevronRight, Users } from 'lucide-react'

function SectionCard({ title, description, icon: Icon, children }: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl z-50 animate-fade-in ${
      type === 'success'
        ? 'bg-primary/10 border-primary/25 text-primary'
        : 'bg-destructive/10 border-destructive/25 text-destructive'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

const selectClass = "flex h-11 w-full rounded-lg border border-input bg-input px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"

const tierColors: Record<string, string> = {
  FREE: 'text-muted-foreground',
  PRO: 'text-primary',
  ELITE: 'text-blue-400',
  CONCIERGE: 'text-amber-400',
  B2B: 'text-primary',
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const currency = useCurrencyStore((state) => state.currency)
  const [, setCharities] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Accountability Buddy state
  const [buddy, setBuddy] = useState<AccountabilityBuddy | null>(null)
  const [buddyLoading, setBuddyLoading] = useState(true)
  const [buddyForm, setBuddyForm] = useState({ buddyName: '', buddyEmail: '', buddyPhone: '' })
  const [buddySaving, setBuddySaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [profileData, setProfileData] = useState<UpdateProfileInput>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    timezone: user?.timezone || 'Europe/London',
  })

  const [preferencesData, setPreferencesData] = useState({
    morningCallTime: user?.morningCallTime || '07:00',
    eveningCallTime: user?.eveningCallTime || '20:00',
    callFrequency: user?.callFrequency || 7,
    track: user?.track || 'fitness',
    goal: user?.goal || '',
  })

  useEffect(() => {
    api.donations.getCharities().then(setCharities).catch(console.error)
    buddyApi.get().then((b) => setBuddy(b ?? null)).catch(console.error).finally(() => setBuddyLoading(false))
  }, [])

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        timezone: user.timezone || 'Europe/London',
      })
      setPreferencesData({
        morningCallTime: user.morningCallTime || '07:00',
        eveningCallTime: user.eveningCallTime || '20:00',
        callFrequency: user.callFrequency || 7,
        track: user.track || 'fitness',
        goal: user.goal || '',
      })
    }
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const updated = await api.users.updateProfile(profileData)
      setUser(updated)
      showToast('Profile updated successfully')
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error')
    } finally { setIsLoading(false) }
  }

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const updated = await api.users.updateProfile(preferencesData)
      setUser(updated)
      showToast('Preferences saved')
    } catch (err: any) {
      showToast(err.message || 'Failed to update preferences', 'error')
    } finally { setIsLoading(false) }
  }

  const handleBuddySet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buddyForm.buddyName || (!buddyForm.buddyEmail && !buddyForm.buddyPhone)) {
      showToast('Name and at least one contact method are required', 'error')
      return
    }
    setBuddySaving(true)
    try {
      const saved = await buddyApi.set({
        buddyName: buddyForm.buddyName,
        buddyEmail: buddyForm.buddyEmail || undefined,
        buddyPhone: buddyForm.buddyPhone || undefined,
      })
      setBuddy(saved)
      showToast('Accountability buddy saved')
    } catch (err: any) {
      showToast(err.message || 'Failed to save buddy', 'error')
    } finally { setBuddySaving(false) }
  }

  const handleBuddyRemove = async () => {
    setBuddySaving(true)
    try {
      await buddyApi.remove()
      setBuddy(null)
      setBuddyForm({ buddyName: '', buddyEmail: '', buddyPhone: '' })
      showToast('Accountability buddy removed')
    } catch (err: any) {
      showToast(err.message || 'Failed to remove buddy', 'error')
    } finally { setBuddySaving(false) }
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      <div className="space-y-4">
        {/* Profile */}
        <SectionCard title="Profile" description="Your personal information" icon={User}>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="+44 20 1234 5678"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Timezone</label>
              <select className={selectClass} value={profileData.timezone} onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="America/New_York">New York (EST)</option>
                <option value="America/Los_Angeles">Los Angeles (PST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
              </select>
            </div>
            <Button type="submit" disabled={isLoading} size="sm">
              {isLoading ? 'Saving…' : 'Save Profile'}
            </Button>
          </form>
        </SectionCard>

        {/* Call Schedule */}
        <SectionCard title="Call Schedule" description="Configure your daily AI accountability calls" icon={Clock}>
          <form onSubmit={handlePreferencesUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Morning Call</label>
                <Input
                  type="time"
                  value={preferencesData.morningCallTime}
                  onChange={(e) => setPreferencesData({ ...preferencesData, morningCallTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Evening Call</label>
                <Input
                  type="time"
                  value={preferencesData.eveningCallTime}
                  onChange={(e) => setPreferencesData({ ...preferencesData, eveningCallTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Calls per Week</label>
              <select className={selectClass} value={preferencesData.callFrequency} onChange={(e) => setPreferencesData({ ...preferencesData, callFrequency: parseInt(e.target.value) })}>
                <option value="7">Daily (7 days)</option>
                <option value="5">Weekdays (5 days)</option>
                <option value="3">3 days per week</option>
                <option value="1">Once per week</option>
              </select>
            </div>
            <Button type="submit" disabled={isLoading} size="sm">
              {isLoading ? 'Saving…' : 'Save Schedule'}
            </Button>
          </form>
        </SectionCard>

        {/* Goals & Track */}
        <SectionCard title="Goals & Track" description="Define your wellness journey" icon={Target}>
          <form onSubmit={handlePreferencesUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Accountability Track</label>
              <select className={selectClass} value={preferencesData.track} onChange={(e) => setPreferencesData({ ...preferencesData, track: e.target.value })}>
                <option value="fitness">Fitness — movement, exercise, physical consistency</option>
                <option value="focus">Focus — deep work, learning, cognitive habits</option>
                <option value="sleep">Sleep — sleep hygiene, bedtime routines, recovery</option>
                <option value="balance">Balance — meditation, journaling, broader wellness</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your Goal</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                placeholder="e.g., Run a marathon by end of year"
                value={preferencesData.goal}
                onChange={(e) => setPreferencesData({ ...preferencesData, goal: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={isLoading} size="sm">
              {isLoading ? 'Saving…' : 'Save Goals'}
            </Button>
          </form>
        </SectionCard>

        {/* Subscription */}
        <SectionCard title="Subscription" description="Manage your plan and billing" icon={CreditCard}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
                <p className={`text-xl font-bold tracking-tight ${user ? tierColors[user.subscriptionTier] : ''}`}>
                  {user && getTierName(user.subscriptionTier)}
                </p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.subscriptionStatus}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {user && getTierPrice(user.subscriptionTier, currency)}
                </p>
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="mt-2">
                    {user?.subscriptionTier === 'CONCIERGE' ? 'View Plans' : 'Upgrade'}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {user && (user.subscriptionTier === 'FREE' || user.subscriptionTier === 'PRO') && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-sm font-semibold mb-2.5">
                  {user.subscriptionTier === 'FREE' ? 'Choose a plan to continue after your trial:' : 'Upgrade to Ivy Plus for:'}
                </p>
                <ul className="space-y-1.5 text-sm text-muted-foreground mb-4">
                  {(user.subscriptionTier === 'FREE'
                    ? [`${getTierPrice('PRO', currency)} — complete AI experience`, `Impact wallet included`, '14-day free trial, no card required']
                    : [`Larger impact wallet (${currency === 'USD' ? '$55' : '£45'}/month)`, 'Ivy Circles — peer group coaching sessions', 'Quarterly 1-on-1 with peer coach']
                  ).map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing">
                  <Button className="w-full" size="sm">
                    {user.subscriptionTier === 'FREE' ? 'Choose a plan' : 'Upgrade to Ivy Plus'}
                    <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Accountability Buddy */}
        <div id="buddy" className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Accountability Buddy</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Someone who gets a weekly digest of your progress — no login needed
              </p>
            </div>
          </div>
          <div className="p-5">
            {buddyLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-4 w-56" />
              </div>
            ) : buddy && buddy.isActive ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{buddy.buddyName}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Active</span>
                  </div>
                  {buddy.buddyEmail && (
                    <p className="text-xs text-muted-foreground">{buddy.buddyEmail}</p>
                  )}
                  {buddy.buddyPhone && (
                    <p className="text-xs text-muted-foreground">WhatsApp: {buddy.buddyPhone}</p>
                  )}
                  {buddy.lastDigestAt && (
                    <p className="text-xs text-muted-foreground">
                      Last digest: {new Date(buddy.lastDigestAt).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Every Sunday at 9am, {buddy.buddyName} receives your streak, workouts, donations, and any highlights.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                  onClick={handleBuddyRemove}
                  disabled={buddySaving}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  {buddySaving ? 'Removing…' : 'Remove buddy'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleBuddySet} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Nominate someone to receive a weekly digest of your progress.
                  Social accountability without surveillance.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Their Name</label>
                  <Input
                    placeholder="e.g., Alex Smith"
                    value={buddyForm.buddyName}
                    onChange={(e) => setBuddyForm({ ...buddyForm, buddyName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Their Email <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    type="email"
                    placeholder="alex@example.com"
                    value={buddyForm.buddyEmail}
                    onChange={(e) => setBuddyForm({ ...buddyForm, buddyEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Their WhatsApp <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    type="tel"
                    placeholder="+44 7700 900000"
                    value={buddyForm.buddyPhone}
                    onChange={(e) => setBuddyForm({ ...buddyForm, buddyPhone: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">At least one of email or WhatsApp is required.</p>
                <Button type="submit" size="sm" disabled={buddySaving}>
                  {buddySaving ? 'Saving…' : 'Add accountability buddy'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Account Actions */}
        <SectionCard title="Account" icon={Trash2}>
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-start" size="sm" disabled>
              <Download className="w-4 h-4 mr-2 text-muted-foreground" />
              Export My Data
            </Button>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5" size="sm" disabled>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </SectionCard>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
