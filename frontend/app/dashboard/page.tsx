'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store/auth.store'
import { formatCurrency, getStreakEmoji } from '@/lib/utils'
import { getTierName } from '@/lib/permissions'
import api from '@/lib/api'
import type { Stats } from '@/lib/types'

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.stats.getOverview()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const tierColors = {
    FREE: 'bg-gray-100 text-gray-700 border-gray-300',
    PRO: 'bg-blue-100 text-blue-700 border-blue-300',
    ELITE: 'bg-purple-100 text-purple-700 border-purple-300',
    CONCIERGE: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    B2B: 'bg-green-100 text-green-700 border-green-300',
  }

  const showUpgradePrompt = user && ['FREE', 'PRO'].includes(user.subscriptionTier)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">
                Welcome back, {user?.firstName}!
              </h1>
              {user && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${tierColors[user.subscriptionTier]}`}>
                  {getTierName(user.subscriptionTier)}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              Here&apos;s your accountability journey at a glance
            </p>
          </div>
          {showUpgradePrompt && (
            <Link href="/pricing">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Streak
            </CardTitle>
            <span className="text-2xl">{getStreakEmoji(stats?.streak.current || 0)}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.streak.current || 0} days</div>
            <p className="text-xs text-muted-foreground">
              Longest: {stats?.streak.longest || 0} days
            </p>
          </CardContent>
        </Card>

        {/* This Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Workouts This Week
            </CardTitle>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.workouts.thisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.workouts.completionRate || 0}% completion rate
            </p>
          </CardContent>
        </Card>

        {/* Impact This Month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Impact This Month
            </CardTitle>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.donations.currentMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.impact.remaining || 0)} remaining
            </p>
          </CardContent>
        </Card>

        {/* Total Impact */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lifetime Impact
            </CardTitle>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.donations.lifetimeTotal || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.donations.count || 0} donations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Workout Status */}
        <Card>
          <CardHeader>
            <CardTitle>Workout Progress</CardTitle>
            <CardDescription>
              Your fitness journey breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.workouts.byStatus.map((item) => (
                <div key={item.status} className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {item.status.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(item.count / (stats?.workouts.total || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              What would you like to do today?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Plan Workout</p>
                  <p className="text-sm text-muted-foreground">
                    Schedule your next workout
                  </p>
                </div>
              </button>

              <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Complete Workout</p>
                  <p className="text-sm text-muted-foreground">
                    Mark today&apos;s workout as done
                  </p>
                </div>
              </button>

              <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Log Transformation</p>
                  <p className="text-sm text-muted-foreground">
                    Track your weekly progress
                  </p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
