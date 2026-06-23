'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName, getTierPrice } from '@/lib/permissions'
import { useCurrencyStore } from '@/lib/store/currency.store'
import api, { buddyApi, donationsApi } from '@/lib/api'
import type { UpdateProfileInput, AccountabilityBuddy } from '@/lib/types'
import { User, Phone, Clock, Target, CreditCard, Trash2, Download, CheckCircle2, AlertCircle, ChevronRight, Users, Bell, BellOff, Heart, Loader2, ShieldCheck, MessageCircle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

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

  const { permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  // Charity state
  const [userCharities, setUserCharities] = useState<any[]>([])
  const [allCharities, setAllCharities] = useState<any[]>([])
  const [charitiesLoading, setCharitiesLoading] = useState(true)
  const [charitySaving, setCharitySaving] = useState(false)
  const tierCharityLimit: Record<string, number> = { FREE: 2, PRO: 2, ELITE: 3, CONCIERGE: 999 }
  const charityLimit = tierCharityLimit[user?.subscriptionTier ?? 'PRO'] ?? 2

  // Accountability Buddy state
  const [buddy, setBuddy] = useState<AccountabilityBuddy | null>(null)
  const [buddyLoading, setBuddyLoading] = useState(true)
  const [buddyForm, setBuddyForm] = useState({ buddyName: '', buddyEmail: '', buddyPhone: '' })
  const [buddySaving, setBuddySaving] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    timezone: user?.timezone || 'Europe/London',
  })

  // Phone verification flow state
  const [phoneStep, setPhoneStep] = useState<'idle' | 'enter' | 'code'>('idle')
  const [newPhone, setNewPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifying, setPhoneVerifying] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  const [preferencesData, setPreferencesData] = useState({
    morningCallTime: user?.morningCallTime || '07:00',
    eveningCallTime: user?.eveningCallTime || '20:00',
    callFrequency: user?.callFrequency || 7,
    track: user?.track || 'fitness',
    goal: user?.goal || '',
    minimumMode: user?.minimumMode || '',
    giftFrame: user?.giftFrame || '',
  })
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false)
  const [leavingCoach, setLeavingCoach] = useState(false)

  useEffect(() => {
    buddyApi.get().then((b) => setBuddy(b ?? null)).catch(console.error).finally(() => setBuddyLoading(false))
    Promise.all([
      donationsApi.getUserCharities(),
      donationsApi.getCharities({ region: user?.region ?? 'GB', track: user?.track }),
    ]).then(([mine, all]) => {
      setUserCharities(mine.map((uc: any) => uc.charityId))
      setAllCharities(all)
    }).catch(console.error).finally(() => setCharitiesLoading(false))
  }, [])

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        timezone: user.timezone || 'Europe/London',
      })
      setPreferencesData({
        morningCallTime: user.morningCallTime || '07:00',
        eveningCallTime: user.eveningCallTime || '20:00',
        callFrequency: user.callFrequency || 7,
        track: user.track || 'fitness',
        goal: user.goal || '',
        minimumMode: user.minimumMode || '',
        giftFrame: user.giftFrame || '',
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

  const handleRequestOtp = async () => {
    setPhoneError('')
    setPhoneSending(true)
    try {
      await api.users.requestPhoneOtp(newPhone)
      setPhoneStep('code')
    } catch (err: any) {
      setPhoneError(err.response?.data?.error || err.message || 'Failed to send code')
    } finally { setPhoneSending(false) }
  }

  const handleVerifyOtp = async () => {
    setPhoneError('')
    setPhoneVerifying(true)
    try {
      const verified = await api.users.verifyPhoneOtp(otpCode)
      setUser({ ...user!, phone: verified })
      setPhoneStep('idle')
      setNewPhone('')
      setOtpCode('')
      showToast('Phone number updated')
    } catch (err: any) {
      setPhoneError(err.response?.data?.error || err.message || 'Incorrect code')
    } finally { setPhoneVerifying(false) }
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

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      await api.users.deleteAccount()
      // Clear auth and redirect — account is gone
      window.location.href = '/'
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error')
      setDeletingAccount(false)
      setDeleteConfirmOpen(false)
    }
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
      {/* Header — hidden on mobile, where the layout shows a back-to-home bar */}
      <div className="mb-8 animate-fade-in hidden md:block">
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
            {/* Phone — handled separately with OTP verification */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Phone Number
              </label>

              {phoneStep === 'idle' && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                  {user?.phone ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-sm text-foreground">{user.phone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('enter'); setPhoneError('') }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Change
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground flex-1">No phone number set</span>
                      <button
                        type="button"
                        onClick={() => { setPhoneStep('enter'); setPhoneError('') }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Add number
                      </button>
                    </>
                  )}
                </div>
              )}

              {phoneStep === 'enter' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="+447911123456"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={phoneSending || !newPhone.trim()}
                      onClick={handleRequestOtp}
                    >
                      {phoneSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send code'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setPhoneStep('idle'); setNewPhone(''); setPhoneError('') }}
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Include your country code, e.g. +447911123456</p>
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>
              )}

              {phoneStep === 'code' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to <strong>{newPhone}</strong></p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 tracking-widest text-center"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={phoneVerifying || otpCode.length < 6}
                      onClick={handleVerifyOtp}
                    >
                      {phoneVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setPhoneStep('enter'); setOtpCode(''); setPhoneError('') }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Wrong number
                    </button>
                    <button
                      type="button"
                      disabled={phoneSending}
                      onClick={handleRequestOtp}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      Resend code
                    </button>
                  </div>
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>
              )}
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
        <SectionCard title="Goals & Track" description="Your accountability track and what you're working toward" icon={Target}>
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Minimum acceptable on a bad day</label>
              <p className="text-xs text-muted-foreground">Ivy offers this when you're about to give up — make it realistic.</p>
              <Input
                placeholder="e.g., A 10-minute walk, one chapter, 5 minutes of breathing"
                value={preferencesData.minimumMode}
                onChange={(e) => setPreferencesData({ ...preferencesData, minimumMode: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Who you're doing this for</label>
              <p className="text-xs text-muted-foreground">Ivy uses this in rescue calls. "My kids", "myself", "I want energy back" — be honest.</p>
              <Input
                placeholder="e.g., My kids, my partner, myself"
                value={preferencesData.giftFrame}
                onChange={(e) => setPreferencesData({ ...preferencesData, giftFrame: e.target.value })}
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
                    View plans
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {user?.subscriptionTier === 'FREE' && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-sm font-semibold mb-1">Start your commitment</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Pick a plan to set your weekly stake and begin your accountability cycle.
                </p>
                <Link href="/pricing">
                  <Button className="w-full" size="sm">
                    Choose a plan
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

        {/* Push Notifications */}
        {permission !== 'unsupported' && (
          <SectionCard
            title="Notifications"
            description="Push alerts on this device — streak warnings, missed calls, baton drops"
            icon={Bell}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isSubscribed ? 'Notifications on' : 'Notifications off'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {permission === 'denied'
                    ? 'Blocked in browser — enable in your device settings'
                    : isSubscribed
                    ? 'You\'ll be notified on this device'
                    : 'Enable to get streak warnings and call reminders'}
                </p>
              </div>
              <Button
                size="sm"
                variant={isSubscribed ? 'outline' : 'default'}
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={pushLoading || permission === 'denied'}
                className={isSubscribed ? '' : 'bg-emerald-500 hover:bg-emerald-600 text-black'}
              >
                {pushLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isSubscribed ? (
                  <><BellOff className="w-3.5 h-3.5 mr-1.5" />Turn off</>
                ) : (
                  <><Bell className="w-3.5 h-3.5 mr-1.5" />Turn on</>
                )}
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Telegram */}
        <SectionCard
          title="Telegram"
          description="Chat with Ivy on Telegram — reply any time, send voice notes"
          icon={MessageCircle}
        >
          {user?.telegramChatId ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">Connected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ivy will message you here alongside your calls</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={telegramDisconnecting}
                onClick={async () => {
                  setTelegramDisconnecting(true)
                  try {
                    await api.users.disconnectTelegram()
                    setUser({ ...user, telegramChatId: null })
                    showToast('Telegram disconnected')
                  } catch {
                    showToast('Failed to disconnect Telegram', 'error')
                  } finally {
                    setTelegramDisconnecting(false)
                  }
                }}
              >
                {telegramDisconnecting
                  ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Not connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tap to open Telegram and link your account</p>
              </div>
              <Button
                size="sm"
                className="bg-[#229ED9] hover:bg-[#1a8bbf] text-white"
                onClick={() => window.open(
                  `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'ivykeeps_bot'}?start=${user?.id}`,
                  '_blank'
                )}
              >
                Connect Telegram
              </Button>
            </div>
          )}
        </SectionCard>

        {/* Charity */}
        <SectionCard title="Your Cause" description={`Choose up to ${charityLimit === 999 ? 'unlimited' : charityLimit} ${charityLimit === 1 ? 'cause' : 'causes'} — a forfeited stake is split equally between them`} icon={Heart}>
          {charitiesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {allCharities.map((charity: any) => {
                const selected = userCharities.includes(charity.id)
                const atLimit = userCharities.length >= charityLimit && !selected
                return (
                  <div
                    key={charity.id}
                    onClick={async () => {
                      if (atLimit) return
                      const next = selected
                        ? userCharities.filter((id: string) => id !== charity.id)
                        : [...userCharities, charity.id]
                      setUserCharities(next)
                      setCharitySaving(true)
                      try { await donationsApi.setUserCharities(next) } catch {}
                      setCharitySaving(false)
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selected ? 'border-emerald-500 bg-emerald-500/5' : atLimit ? 'border-border opacity-40 cursor-not-allowed' : 'border-border hover:bg-accent/20'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{charity.name}</p>
                      <p className="text-xs text-emerald-400">{charity.impactPerPound}</p>
                    </div>
                    {selected && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                )
              })}
              {charitySaving && <p className="text-xs text-muted-foreground text-center">Saving...</p>}
            </div>
          )}
        </SectionCard>

        {/* Coach programme — shown when user is in a programme or has a pending invite */}
        {(user?.coachId || user?.pendingCoachId) && (
          <SectionCard title="Coach Programme" description="Your accountability programme" icon={Users}>
            {user.coachId ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">
                    {user.coach?.coachProfile?.brandName ?? user.coach?.coachProfile?.programmeName ?? `${user.coach?.firstName}'s programme`}
                  </p>
                  {user.coachLinkedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Joined {new Date(user.coachLinkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={leavingCoach}
                  className="text-destructive hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                  onClick={async () => {
                    if (!confirm('Leave this programme? Your calls will stop and you may lose access depending on your subscription.')) return
                    setLeavingCoach(true)
                    try {
                      await api.users.leaveCoach()
                      setUser({ ...user, coachId: null, coachLinkedAt: null, coach: null })
                      showToast('You have left the programme')
                    } catch {
                      showToast('Failed to leave programme', 'error')
                    } finally { setLeavingCoach(false) }
                  }}
                >
                  {leavingCoach
                    ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                    : null}
                  Leave programme
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-amber-400">Invite pending</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.pendingCoach?.coachProfile?.brandName ?? user.pendingCoach?.firstName ?? 'A coach'} has invited you to their programme
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    try {
                      const updated = await api.users.acceptCoachInvite()
                      setUser(updated)
                      showToast('Joined the programme')
                    } catch { showToast('Failed to accept invite', 'error') }
                  }}>Accept</Button>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      await api.users.leaveCoach()
                      setUser({ ...user, pendingCoachId: null, pendingCoach: null })
                      showToast('Invite declined')
                    } catch { showToast('Failed to decline', 'error') }
                  }}>Decline</Button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* Account Actions */}
        <SectionCard title="Account" icon={Trash2}>
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => window.open('/api/users/me/export', '_blank')}>
              <Download className="w-4 h-4 mr-2 text-muted-foreground" />
              Export My Data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </SectionCard>

        {/* Delete Account Confirmation Modal */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-card border border-destructive/30 rounded-2xl shadow-2xl p-6 space-y-4">
              <h2 className="font-bold text-lg">Delete your account?</h2>
              <p className="text-sm text-muted-foreground">
                This permanently deletes your account, call history, streak, donations history, and all personal data. Your pending charity donations will still be dispatched. This cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deletingAccount}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? 'Deleting…' : 'Yes, delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
