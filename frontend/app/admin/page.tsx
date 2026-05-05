'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/auth.store'
import { adminApi } from '@/lib/api'

interface AdminStats {
  season: { name: string; startDate: string | null; endDate: string | null; daysRemaining: number | null }
  enrollment: { total: number; active: number; pending: number }
  participation: { rate: number }
  consistency: { rate: number }
  donations: { total: number }
  tracks: { track: string; count: number; percentage: number }[]
  weeklyParticipation: { week: number; rate: number }[]
}

export default function AdminDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch((err) => setError(err.message ?? 'Failed to load stats'))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">Make sure your account is linked to a company.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Company Overview</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName}. Here&apos;s your team&apos;s progress.
        </p>
      </div>

      {/* Season Info */}
      <Card className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm mb-1">{stats?.season.name}</p>
              <h2 className="text-2xl font-bold mb-1">
                {stats?.season.startDate
                  ? `${new Date(stats.season.startDate).toLocaleDateString()} - ${new Date(stats.season.endDate ?? '').toLocaleDateString()}`
                  : 'Season dates not set'}
              </h2>
              <p className="text-indigo-100">
                {stats?.season.daysRemaining != null ? `${stats.season.daysRemaining} days remaining` : 'Not started'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-indigo-100 text-sm mb-1">Employees</p>
              <p className="text-4xl font-bold">{stats?.enrollment.total}</p>
              <p className="text-indigo-100 text-sm">{stats?.enrollment.active} active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Participation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.participation.rate ?? 0}%</p>
            <p className="text-sm text-muted-foreground mt-1">Users active this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consistency Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats?.consistency.rate ?? 0}%</p>
            <p className="text-sm text-muted-foreground mt-1">Overall workout completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatCurrency(stats?.donations.total ?? 0)}</p>
            <p className="text-sm text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Participation Over Time</CardTitle>
            <CardDescription>Weekly participation rate (last 6 weeks)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.weeklyParticipation.map((item) => (
                <div key={item.week} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Week {item.week}</span>
                    <span className="font-medium">{item.rate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${item.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Track Distribution</CardTitle>
            <CardDescription>Employee track selection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.tracks.map((item) => (
                <div key={item.track} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{item.track}</span>
                    <span className="text-muted-foreground">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
              {(!stats?.tracks || stats.tracks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No track data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-900 mb-1">Privacy-First Reporting</p>
              <p className="text-sm text-blue-800">
                All data shown is aggregated and anonymous. Individual employee performance, goals, and personal data are never visible to company administrators.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
