'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/auth.store'

// Mock data - these will be replaced with actual API calls
interface CompanyStats {
  season: {
    name: string
    startDate: string
    endDate: string
    daysRemaining: number
  }
  enrollment: {
    total: number
    active: number
    pending: number
  }
  participation: {
    rate: number
    trend: number
  }
  consistency: {
    rate: number
    trend: number
  }
  donations: {
    total: number
    trend: number
  }
  tracks: Array<{
    track: string
    count: number
    percentage: number
  }>
  weeklyParticipation: Array<{
    week: number
    rate: number
  }>
}

export default function AdminDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<CompanyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Replace with actual API call
    // For now, using mock data
    setTimeout(() => {
      setStats({
        season: {
          name: 'Season 3',
          startDate: '2025-01-15',
          endDate: '2025-03-15',
          daysRemaining: 45,
        },
        enrollment: {
          total: 125,
          active: 98,
          pending: 27,
        },
        participation: {
          rate: 78,
          trend: 5,
        },
        consistency: {
          rate: 65,
          trend: -3,
        },
        donations: {
          total: 2340,
          trend: 420,
        },
        tracks: [
          { track: 'Fitness', count: 50, percentage: 40 },
          { track: 'Focus', count: 38, percentage: 30 },
          { track: 'Sleep', count: 25, percentage: 20 },
          { track: 'Balance', count: 12, percentage: 10 },
        ],
        weeklyParticipation: [
          { week: 1, rate: 82 },
          { week: 2, rate: 79 },
          { week: 3, rate: 75 },
          { week: 4, rate: 78 },
          { week: 5, rate: 80 },
          { week: 6, rate: 78 },
        ],
      })
      setIsLoading(false)
    }, 500)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
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
                {new Date(stats?.season.startDate || '').toLocaleDateString()} - {new Date(stats?.season.endDate || '').toLocaleDateString()}
              </h2>
              <p className="text-indigo-100">{stats?.season.daysRemaining} days remaining</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Participation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">{stats?.participation.rate}%</p>
                <p className={`text-sm mt-1 ${stats && stats.participation.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats && stats.participation.trend > 0 ? '↑' : '↓'} {Math.abs(stats?.participation.trend || 0)}% from last week
                </p>
              </div>
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consistency Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">{stats?.consistency.rate}%</p>
                <p className={`text-sm mt-1 ${stats && stats.consistency.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats && stats.consistency.trend > 0 ? '↑' : '↓'} {Math.abs(stats?.consistency.trend || 0)}% from last week
                </p>
              </div>
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">{formatCurrency(stats?.donations.total || 0)}</p>
                <p className="text-sm text-green-600 mt-1">
                  ↑ {formatCurrency(stats?.donations.trend || 0)} this month
                </p>
              </div>
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Participation Over Time */}
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
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Track Distribution */}
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
                    <span className="font-medium">{item.track}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        item.track === 'Fitness' ? 'bg-blue-600' :
                        item.track === 'Focus' ? 'bg-purple-600' :
                        item.track === 'Sleep' ? 'bg-indigo-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Notice */}
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
