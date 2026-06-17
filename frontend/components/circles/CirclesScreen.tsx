'use client'

/**
 * CirclesScreen — the cohort view with live game UI.
 *
 * MOCK DATA ONLY — swap MOCK_CIRCLE for real API data.
 * All API wiring points are marked with // TODO(api):
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Flame, Calendar, ChevronRight, Zap, Trophy, Target } from 'lucide-react'
import { MOCK_CIRCLE, MOCK_BATON_GAME, MOCK_POINTS_RACE, MOCK_COLLECTIVE } from '@/lib/mock/circles'
import type { CircleGame, CircleMemberMock, MemberStatus } from '@/lib/mock/circles'
import { BatonGame } from './BatonGame'
import { PointsRace } from './PointsRace'
import { CollectiveGame } from './CollectiveGame'

// ─── Member status dot ────────────────────────────────────────────────────────

const STATUS_META: Record<MemberStatus, { label: string; dotClass: string }> = {
  armed:    { label: 'Armed',    dotClass: 'bg-gold-400 pulse-gold' },
  complete: { label: 'Done',     dotClass: 'bg-sage-400' },
  missed:   { label: 'Missed',   dotClass: 'bg-ember-500' },
  pending:  { label: 'Pending',  dotClass: 'bg-ink-600' },
}

function MemberRow({ member }: { member: CircleMemberMock }) {
  const meta = STATUS_META[member.status]

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
        member.isCurrentUser ? 'bg-gold-400/05 border border-gold-400/10' : 'hover:bg-ink-700/50'
      }`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-900 shrink-0"
        style={{ background: `hsl(${member.avatarHue}, 60%, 60%)` }}
      >
        {member.initials}
      </div>

      {/* Name + streak */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${member.isCurrentUser ? 'text-gold-300' : 'text-ink-50'}`}>
            {member.isCurrentUser ? 'You' : member.name.split(' ')[0]}
          </p>
          {member.streakDays >= 7 && (
            <span className="text-2xs text-ember-400 font-mono">🔥{member.streakDays}d</span>
          )}
        </div>
        {/* Witnessed stake badge */}
        {member.stakeShared && (
          <p className="text-2xs text-ink-400">
            £{member.stakeWeekly}/wk · visible to circle
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
        <span className="text-2xs text-ink-400">{meta.label}</span>
      </div>
    </div>
  )
}

// ─── Game type switcher (demo / development) ──────────────────────────────────

type GameVariant = 'relay' | 'points_race' | 'collective'

const GAME_DEMOS: Record<GameVariant, { label: string; icon: React.ReactNode; game: CircleGame }> = {
  relay:       { label: 'Baton relay', icon: <span>🏃</span>, game: MOCK_BATON_GAME },
  points_race: { label: 'Points race', icon: <Trophy className="w-3.5 h-3.5" />, game: MOCK_POINTS_RACE },
  collective:  { label: 'Collective',  icon: <Target className="w-3.5 h-3.5" />,  game: MOCK_COLLECTIVE },
}

// ─── Game panel dispatcher ────────────────────────────────────────────────────

function GamePanel({ game, members, currentUserId }: { game: CircleGame; members: CircleMemberMock[]; currentUserId: string }) {
  if (game.type === 'relay')       return <BatonGame       game={game} members={members} currentUserId={currentUserId} />
  if (game.type === 'points_race') return <PointsRace      game={game} members={members} currentUserId={currentUserId} />
  if (game.type === 'collective')  return <CollectiveGame  game={game} />
  return null
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function CirclesScreen() {
  const circle = MOCK_CIRCLE
  const currentUser = circle.members.find((m) => m.isCurrentUser)!
  const [activeVariant, setActiveVariant] = useState<GameVariant>('relay')
  const activeGame = GAME_DEMOS[activeVariant].game

  const armedCount  = circle.members.filter((m) => m.status === 'armed' || m.status === 'complete').length
  const daysToSession = circle.nextSession
    ? Math.max(0, Math.ceil((circle.nextSession.getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="min-h-dvh mesh-bg-subtle relative overflow-x-hidden">
      {/* Ambient glows */}
      <div
        className="pointer-events-none fixed -top-32 -right-20 w-80 h-80 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(238,238,255,0.18) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-40 -left-20 w-72 h-72 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-lg mx-auto px-4 pb-24">

        {/* ── Nav ── */}
        <div className="safe-top" />
        <div className="flex items-center justify-between pt-3 pb-5">
          <Link href="/daily">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors">
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          </Link>
          <div className="text-center">
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">{circle.sprintLabel}</p>
            <p className="text-xs text-ink-200 font-display italic mt-0.5">"{circle.seasonTheme}"</p>
          </div>
          <Link href="/dashboard">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors text-2xs text-ink-400">
              ≡
            </button>
          </Link>
        </div>

        {/* ── Hero header ── */}
        <div className="mb-6 page-enter" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-periwinkle-500/15 border border-periwinkle-400/25 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-periwinkle-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-ink-50 tracking-tight">{circle.name}</h1>
              <p className="text-sm text-ink-400 mt-0.5">
                {armedCount}/{circle.members.length} armed today · {circle.circleForfeitsThisWeek > 0
                  ? `${circle.circleForfeitsThisWeek} forfeit this week`
                  : 'no forfeits this week'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div
          className="glass rounded-2xl px-4 py-3 mb-5 flex items-center gap-4 page-enter"
          style={{ animationDelay: '60ms' }}
        >
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-ember-400" />
            <span className="font-mono text-sm font-medium text-ink-200 tabular-nums">{circle.circleDaysArmed}</span>
            <span className="text-2xs text-ink-400">days armed</span>
          </div>
          <div className="h-4 w-px bg-ink-600" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sage-400" />
            <span className="text-2xs text-ink-200">{armedCount}/{circle.members.length} today</span>
          </div>
          <div className="h-4 w-px bg-ink-600" />
          {daysToSession !== null && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Calendar className="w-3 h-3 text-ink-400" />
              <span className="text-2xs text-ink-400">session in {daysToSession}d</span>
            </div>
          )}
        </div>

        {/* ── Member roster ── */}
        <div
          className="surface rounded-2xl p-3 mb-5 page-enter"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Members</p>
            <p className="text-2xs text-ink-400">{circle.members.length} people</p>
          </div>
          <div className="space-y-0.5">
            {circle.members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </div>
          {/* Witnessed stakes note */}
          <p className="text-2xs text-ink-400 mt-3 px-2 pb-1">
            Members showing stake amounts have opted in to witnessed stakes — loss is shared.
          </p>
        </div>

        {/* ── Game panel ── */}
        <div
          className="surface rounded-2xl p-4 mb-5 page-enter"
          style={{ animationDelay: '150ms' }}
        >
          {/* Game type switcher (dev demo) */}
          <div className="flex items-center gap-1 p-1 bg-ink-900 rounded-xl mb-4">
            {(Object.entries(GAME_DEMOS) as [GameVariant, typeof GAME_DEMOS[GameVariant]][]).map(([key, def]) => (
              <button
                key={key}
                onClick={() => setActiveVariant(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-2xs font-medium transition-all duration-200 ${
                  activeVariant === key
                    ? 'bg-ink-700 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {def.icon}
                <span className="hidden sm:inline">{def.label}</span>
              </button>
            ))}
          </div>

          {/* Active badge */}
          <div className="flex items-center gap-1.5 mb-4">
            <Zap className="w-3 h-3 text-sage-400" />
            <span className="text-2xs font-semibold uppercase tracking-widest text-sage-400">
              Active game
            </span>
          </div>

          <GamePanel
            game={activeGame}
            members={circle.members}
            currentUserId={currentUser.id}
          />
        </div>

        {/* ── Session countdown ── */}
        {daysToSession !== null && (
          <div
            className="glass rounded-2xl p-4 flex items-center gap-3 page-enter"
            style={{ animationDelay: '200ms' }}
          >
            <Calendar className="w-4 h-4 text-periwinkle-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-50">Sprint session in {daysToSession} day{daysToSession !== 1 ? 's' : ''}</p>
              <p className="text-xs text-ink-400 mt-0.5">
                {circle.nextSession?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
          </div>
        )}

      </div>
    </div>
  )
}
