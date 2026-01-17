'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName, getTierPrice, getTierFeatures } from '@/lib/permissions'
import api from '@/lib/api'
import type { UpdateProfileInput, Charity } from '@/lib/types'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [charities, setCharities] = useState<Charity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

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
    fetchCharities()
  }, [])

  const fetchCharities = async () => {
    try {
      const data = await api.donations.getCharities()
      setCharities(data)
    } catch (error) {
      console.error('Failed to fetch charities:', error)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccessMessage('')

    try {
      const updatedUser = await api.users.updateProfile(profileData)
      setUser(updatedUser)
      setSuccessMessage('Profile updated successfully!')

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      alert(error.message || 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccessMessage('')

    try {
      const updatedUser = await api.users.updateProfile(preferencesData)
      setUser(updatedUser)
      setSuccessMessage('Preferences updated successfully!')

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Failed to update preferences:', error)
      alert(error.message || 'Failed to update preferences')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 text-green-900 rounded-lg border border-green-200">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 max-w-4xl">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+44 20 1234 5678"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={profileData.timezone}
                  onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                >
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="America/New_York">New York (EST)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Call Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Call Schedule</CardTitle>
            <CardDescription>
              Configure your daily accountability calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePreferencesUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="morningCallTime">Morning Call Time</Label>
                  <Input
                    id="morningCallTime"
                    type="time"
                    value={preferencesData.morningCallTime}
                    onChange={(e) => setPreferencesData({ ...preferencesData, morningCallTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eveningCallTime">Evening Call Time</Label>
                  <Input
                    id="eveningCallTime"
                    type="time"
                    value={preferencesData.eveningCallTime}
                    onChange={(e) => setPreferencesData({ ...preferencesData, eveningCallTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="callFrequency">Calls per Week</Label>
                <select
                  id="callFrequency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={preferencesData.callFrequency}
                  onChange={(e) => setPreferencesData({ ...preferencesData, callFrequency: parseInt(e.target.value) })}
                >
                  <option value="7">Daily (7 days)</option>
                  <option value="5">Weekdays (5 days)</option>
                  <option value="3">3 days per week</option>
                  <option value="1">Once per week</option>
                </select>
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Schedule'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Goals & Track */}
        <Card>
          <CardHeader>
            <CardTitle>Goals & Track</CardTitle>
            <CardDescription>
              Define your fitness journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePreferencesUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="track">Track</Label>
                <select
                  id="track"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={preferencesData.track}
                  onChange={(e) => setPreferencesData({ ...preferencesData, track: e.target.value })}
                >
                  <option value="fitness">Fitness</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="endurance">Endurance</option>
                  <option value="general_health">General Health</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Your Goal</Label>
                <textarea
                  id="goal"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="e.g., Run a marathon by end of year"
                  value={preferencesData.goal}
                  onChange={(e) => setPreferencesData({ ...preferencesData, goal: e.target.value })}
                />
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Goals'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage your plan and billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-purple/5">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                  <p className="text-xl font-bold">
                    {user && getTierName(user.subscriptionTier)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize mt-1">
                    {user?.subscriptionStatus}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {user && getTierPrice(user.subscriptionTier)}
                  </p>
                  <Link href="/pricing" className="mt-2 block">
                    <Button variant="outline" size="sm">
                      {user?.subscriptionTier === 'FREE' || user?.subscriptionTier === 'PRO'
                        ? 'Upgrade Plan'
                        : 'View Plans'}
                    </Button>
                  </Link>
                </div>
              </div>

              {user && (user.subscriptionTier === 'FREE' || user.subscriptionTier === 'PRO') && (
                <div className="p-4 bg-gradient-to-br from-primary/10 to-purple/10 rounded-lg border border-primary/20">
                  <p className="font-semibold mb-3">
                    {user.subscriptionTier === 'FREE'
                      ? 'Upgrade to Ivy Pro or higher to unlock:'
                      : 'Upgrade to Ivy Elite for:'}
                  </p>
                  <ul className="space-y-2 text-sm mb-4">
                    {user.subscriptionTier === 'FREE' && (
                      <>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>2 AI calls per week</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>£20/month impact wallet</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Energy & mood tracking</span>
                        </li>
                      </>
                    )}
                    {user.subscriptionTier === 'PRO' && (
                      <>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>4 AI calls per week (vs 2)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Full transformation tracking with life markers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Calendar integration & Ivy Circle community</span>
                        </li>
                      </>
                    )}
                  </ul>
                  <Link href="/pricing" className="block">
                    <Button className="w-full">
                      {user.subscriptionTier === 'FREE' ? 'Upgrade to Pro' : 'Upgrade to Elite'}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" disabled>
                Export My Data
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" disabled>
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
