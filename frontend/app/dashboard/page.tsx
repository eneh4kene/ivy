'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth.store'
import { formatCurrency } from '@/lib/utils'
import { getTierName } from '@/lib/permissions'
import api, { seasonsApi } from '@/lib/api'
import type { Stats, Season, Streak } from '@/lib/types'
import {
  Zap, Heart, TrendingUp, ArrowRight, Plus, CheckCircle,
  BarChart3, Flame, Trophy, ChevronRight, Target, Shield
} from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 transition-all duration-200 hover:border-primary/20 ${
      accent ? 'bg-primary/8 border-primary/20' : 'bg-card border-border'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          accent ? 'bg-primary/20' : 'bg-muted'
        }`}>
          <Icon className={`w-4 h-4 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>
      <div className="skeleton h-8 w-20" />
      <div className="skeleton h-3 w-32" />
    </div>
  )
}

const tierColors: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  PRO: 'bg-primary/15 text-primary border border-primary/20',
  ELITE: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  CONCIERGE: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  B2B: 'bg-primary/15 text-primary border border-primary/20',
}

function SeasonWidget({ season }: { season: Season }) {
  const now = new Date()
  const currentSprint = season.sprints.find(
    s => s.status === 'ACTIVE' && new Date(s.startDate) <= now && new Date(s.endDate) >= now
  )
  const completedSprints = season.sprints.filter(s => s.status === 'COMPLETED').length
  const totalSprints = season.sprints.length

  // Season progress
  const seasonStart = new Date(season.startDate)
  const seasonEnd = new Date(season.endDate)
  const seasonProgress = Math.min(100, Math.round(
    ((now.getTime() - seasonStart.getTime()) / (seasonEnd.getTime() - seasonStart.getTime())) * 100
  ))

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors mb-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Season {season.number}{season.title ? ` · ${season.title}` : ''}</p>
            <p className="text-sm font-semibold leading-tight">{season.goal}</p>
          </div>
        </div>
        <Link href="/seasons">
          <span className="text-xs text-primary hover:underline">View</span>
        </Link>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${seasonProgress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{seasonProgress}% through season</span>
        <span>
          {currentSprint ? `Sprint ${currentSprint.number} active` : `${completedSprints}/${totalSprints} sprints done`}
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState<Stats | null>(null)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.stats.getOverview().catch(() => null),
      api.stats.getStreak().catch(() => null),
      seasonsApi.getActive().catch(() => null),
    ]).then(([statsData, streakData, seasonData]) => {
      if (statsData) setStats(statsData)
      if (streakData) setStreak(streakData)
      if (seasonData) setActiveSeason(seasonData)
    }).finally(() => setIsLoading(false))
  }, [])

  const showUpgrade = user && ['FREE', 'PRO'].includes(user.subscriptionTier)

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Hey, {user?.firstName} 👋
            </h1>
            {user?.subscriptionTier && (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${tierColors[user.subscriptionTier]}`}>
                {getTierName(user.subscriptionTier)}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">Here's your accountability dashboard</p>
        </div>
        {showUpgrade && (
          <Link href="/pricing" className="hidden sm:block">
            <Button variant="outline" size="sm">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Upgrade
            </Button>
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <StatCard
                label="Current Streak"
                value={`${stats?.streak.current || 0}d`}
                sub={`Best: ${stats?.streak.longest || 0} days`}
                icon={Flame}
                accent={!!stats?.streak.current}
              />
              {(streak?.graceDays?.balance ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400 self-start">
                  <Shield className="w-3 h-3" />
                  {streak!.graceDays.balance} grace {streak!.graceDays.balance === 1 ? 'day' : 'days'}
                </div>
              )}
              {streak?.graceDays?.log && streak.graceDays.log.filter(e => e.used).slice(-1).map((entry, i) => (
                <p key={i} className="text-[11px] text-muted-foreground px-1">
                  Grace day used {new Date(entry.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                </p>
              ))}
            </div>
            <StatCard
              label="This Week"
              value={String(stats?.workouts.thisWeek || 0)}
              sub={`${stats?.workouts.completionRate || 0}% completion`}
              icon={Zap}
            />
            <StatCard
              label="Impact This Month"
              value={formatCurrency(stats?.donations.currentMonth || 0)}
              sub={`${formatCurrency(stats?.impact.remaining || 0)} remaining`}
              icon={Heart}
            />
            <StatCard
              label="Lifetime Impact"
              value={formatCurrency(stats?.donations.lifetimeTotal || 0)}
              sub={`${stats?.donations.count || 0} donations`}
              icon={Heart}
            />
          </>
        )}
      </div>

      {/* Season Widget */}
      {activeSeason && <SeasonWidget season={activeSeason} />}

      {/* Main content grid */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Workout progress */}
        <div className="bg-card border border-border rounded-xl p-6 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold">Workout Progress</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your fitness breakdown</p>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-2 flex-1 rounded-full" />
                  <div className="skeleton h-3 w-6" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {stats?.workouts.byStatus.map((item) => {
                const pct = (item.count / (stats?.workouts.total || 1)) * 100
                const colors: Record<string, string> = {
                  COMPLETED: 'bg-primary',
                  PLANNED: 'bg-blue-500',
                  SKIPPED: 'bg-muted-foreground',
                  PARTIAL: 'bg-amber-500',
                }
                return (
                  <div key={item.status} className="flex items-center gap-3">
                    <span className="text-sm capitalize text-muted-foreground w-20 flex-shrink-0">
                      {item.status.toLowerCase()}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${colors[item.status] || 'bg-muted-foreground'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right tabular-nums">{item.count}</span>
                  </div>
                )
              })}
              {(!stats?.workouts.byStatus || stats.workouts.byStatus.length === 0) && (
                <div className="text-center py-8">
                  <Zap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No workouts yet</p>
                </div>
              )}
            </div>
          )}

          <Link href="/workouts" className="flex items-center gap-1.5 text-xs text-primary font-medium mt-5 hover:gap-2.5 transition-all">
            View all workouts <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="bg-card border border-border rounded-xl p-6 hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold">Quick Actions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">What would you like to do?</p>
            </div>
            <Trophy className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="space-y-2.5">
            <Link href="/workouts">
              <button className="flex items-center gap-4 w-full p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group text-left">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Plan Workout</p>
                  <p className="text-xs text-muted-foreground">Schedule your next session</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </Link>

            <Link href="/workouts">
              <button className="flex items-center gap-4 w-full p-4 rounded-xl border border-border hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/15">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Log Completion</p>
                  <p className="text-xs text-muted-foreground">Mark today's workout done</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
              </button>
            </Link>

            <Link href="/transformation">
              <button className="flex items-center gap-4 w-full p-4 rounded-xl border border-border hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group text-left">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/15">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Log Transformation</p>
                  <p className="text-xs text-muted-foreground">Track your weekly progress</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
              </button>
            </Link>

            <Link href="/donations">
              <button className="flex items-center gap-4 w-full p-4 rounded-xl border border-border hover:border-pink-500/30 hover:bg-pink-500/5 transition-all group text-left">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-pink-500/15">
                  <Heart className="w-5 h-5 text-pink-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">View Impact</p>
                  <p className="text-xs text-muted-foreground">See your donations & wallet</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-pink-400 transition-colors" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Upgrade banner */}
      {showUpgrade && !isLoading && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {user.subscriptionTier === 'FREE' ? 'Your 14-day trial is active' : 'Unlock more with Ivy Plus'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.subscriptionTier === 'FREE'
                ? 'Choose a plan to keep your progress, wallet, and impact going after your trial.'
                : 'Upgrade to Ivy Plus for a larger impact wallet, Ivy Circles group sessions, and quarterly coaching.'}
            </p>
          </div>
          <Link href="/pricing">
            <Button size="sm">
              {user.subscriptionTier === 'FREE' ? 'Choose a plan' : 'Upgrade now'}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
