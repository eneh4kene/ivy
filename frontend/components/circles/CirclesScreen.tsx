'use client'

/**
 * CirclesScreen — the cohort view, wired to real API data.
 *
 * Data sources:
 *   - circlesApi.getMy()            → the user's circle(s) + member roster
 *   - circleGamesApi.getActiveGame()→ the active game + Ivy's state summary
 *   - circlesApi.getSessions()      → upcoming sprint session
 *
 * Per-member arming/streak/stake status is NOT exposed by the API, so it is
 * not shown here (no fabricated dots/streaks/witnessed-stake badges).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Calendar, ChevronRight, Zap, Sparkles } from 'lucide-react'
import { circlesApi, circleGamesApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

type Circle = Awaited<ReturnType<typeof circlesApi.getMy>>[number]
type ActiveGame = Awaited<ReturnType<typeof circleGamesApi.getActiveGame>>
type Session = Awaited<ReturnType<typeof circlesApi.getSessions>>[number]

const HUES = [14, 44, 152, 238, 280, 320]
function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

function MemberRow({ name, isYou }: { name: string; isYou: boolean }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
      isYou ? 'bg-gold-400/05 border border-gold-400/10' : 'hover:bg-ink-700/50'
    }`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-900 shrink-0"
        style={{ background: `hsl(${hueFor(name)}, 60%, 60%)` }}
      >
        {initials}
      </div>
      <p className={`flex-1 text-sm font-medium ${isYou ? 'text-gold-300' : 'text-ink-50'}`}>
        {isYou ? 'You' : name}
      </p>
    </div>
  )
}

function NavBar({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <>
      <div className="safe-top" />
      <div className="flex items-center justify-between pt-3 pb-5">
        <Link href="/daily">
          <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors">
            <ArrowLeft className="w-4 h-4 text-ink-200" />
          </button>
        </Link>
        {(title || subtitle) && (
          <div className="text-center">
            {title && <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">{title}</p>}
            {subtitle && <p className="text-xs text-ink-200 font-display italic mt-0.5">&ldquo;{subtitle}&rdquo;</p>}
          </div>
        )}
        <Link href="/home">
          <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors text-2xs text-ink-400">
            ≡
          </button>
        </Link>
      </div>
    </>
  )
}

export function CirclesScreen() {
  const { user } = useAuthStore()
  const [circle, setCircle] = useState<Circle | null>(null)
  const [activeGame, setActiveGame] = useState<ActiveGame>(null)
  const [nextSession, setNextSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    circlesApi.getMy()
      .then((cs) => {
        if (!alive) return
        const c = cs?.[0] ?? null
        setCircle(c)
        if (c) {
          circlesApi.getSessions(c.id)
            .then((sessions) => {
              if (!alive) return
              const upcoming = sessions
                .filter((s) => s.status !== 'COMPLETED' && new Date(s.scheduledAt).getTime() >= Date.now())
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              setNextSession(upcoming[0] ?? null)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })

    circleGamesApi.getActiveGame()
      .then((g) => { if (alive) setActiveGame(g) })
      .catch(() => {})

    return () => { alive = false }
  }, [])

  const daysToSession = nextSession
    ? Math.max(0, Math.ceil((new Date(nextSession.scheduledAt).getTime() - Date.now()) / 86400000))
    : null

  if (loading) {
    return (
      <div className="min-h-dvh mesh-bg-subtle flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-ink-600 border-t-periwinkle-400 animate-spin" />
      </div>
    )
  }

  // ── Empty state: not in a circle ───────────────────────────────────────────
  if (!circle) {
    return (
      <div className="min-h-dvh mesh-bg-subtle relative overflow-x-hidden">
        <div className="relative max-w-lg mx-auto px-4 pb-24">
          <NavBar />
          <div className="flex flex-col items-center justify-center text-center gap-4 mt-24">
            <div className="w-14 h-14 rounded-2xl bg-periwinkle-500/15 border border-periwinkle-400/25 flex items-center justify-center">
              <Users className="w-7 h-7 text-periwinkle-400" />
            </div>
            <h1 className="font-display text-xl text-ink-50">You&rsquo;re not in a circle yet</h1>
            <p className="text-sm text-ink-400 max-w-xs">
              Circles are small cohorts who show up together — shared sessions, shared games, shared
              accountability. When you join or get added to one, it&rsquo;ll appear here.
            </p>
            <Link href="/home">
              <button className="mt-2 px-5 py-3 rounded-2xl surface text-sm text-ink-200 hover:bg-ink-700 transition-colors">
                Back to home
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const myUserId = user?.id
  const game = activeGame?.game ?? null

  return (
    <div className="min-h-dvh mesh-bg-subtle relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed -top-32 -right-20 w-80 h-80 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(238,238,255,0.18) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-40 -left-20 w-72 h-72 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-lg mx-auto px-4 pb-24">
        <NavBar title={circle.track} subtitle={circle.seasonTheme} />

        {/* ── Hero header ── */}
        <div className="mb-6 page-enter">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-periwinkle-500/15 border border-periwinkle-400/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-periwinkle-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-ink-50 tracking-tight">{circle.name}</h1>
              <p className="text-sm text-ink-400 mt-0.5">
                {circle.size} member{circle.size !== 1 ? 's' : ''}
                {circle.maxSize ? ` · ${circle.maxSize - circle.size} spot${circle.maxSize - circle.size !== 1 ? 's' : ''} open` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Member roster ── */}
        <div className="surface rounded-2xl p-3 mb-5 page-enter" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Members</p>
            <p className="text-2xs text-ink-400">{circle.members.length} people</p>
          </div>
          <div className="space-y-0.5">
            {circle.members.map((m) => (
              <MemberRow
                key={m.userId}
                name={m.user.firstName}
                isYou={m.userId === myUserId}
              />
            ))}
          </div>
        </div>

        {/* ── Active game ── */}
        <div className="surface rounded-2xl p-4 mb-5 page-enter" style={{ animationDelay: '100ms' }}>
          {game ? (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="w-3 h-3 text-sage-400" />
                <span className="text-2xs font-semibold uppercase tracking-widest text-sage-400">Active game</span>
              </div>
              <h2 className="font-display text-lg text-ink-50">{game.name}</h2>
              {game.description && <p className="text-sm text-ink-400 mt-1">{game.description}</p>}
              {activeGame?.stateSummary && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-ink-900/60 border border-ink-700 p-3">
                  <Sparkles className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-ink-200 leading-relaxed">{activeGame.stateSummary}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-ink-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-200">No active game</p>
                <p className="text-xs text-ink-400 mt-0.5">Your circle&rsquo;s next game will show up here once it starts.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Session countdown ── */}
        {daysToSession !== null && nextSession && (
          <div className="glass rounded-2xl p-4 flex items-center gap-3 page-enter" style={{ animationDelay: '150ms' }}>
            <Calendar className="w-4 h-4 text-periwinkle-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-50">
                {daysToSession === 0 ? 'Sprint session today' : `Sprint session in ${daysToSession} day${daysToSession !== 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">
                {new Date(nextSession.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
          </div>
        )}
      </div>
    </div>
  )
}
