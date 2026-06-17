'use client'

/**
 * PointsRace — leaderboard variant for the Circles game panel.
 * MOCK DATA ONLY — no backend calls.
 */

import type { CircleGame, CircleMemberMock } from '@/lib/mock/circles'

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

interface PointsRaceProps {
  game: CircleGame
  members: CircleMemberMock[]
  currentUserId: string
}

export function PointsRace({ game, members, currentUserId }: PointsRaceProps) {
  const board = game.leaderboard ?? []
  const maxPoints = board[0]?.points ?? 1

  // Derive days left
  const daysLeft = game.endsAt
    ? Math.max(0, Math.ceil((game.endsAt.getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <div>
            <p className="text-sm font-semibold text-ink-50">{game.name}</p>
            <p className="text-2xs text-ink-400 font-mono">points race</p>
          </div>
        </div>
        {daysLeft !== null && (
          <span className="text-2xs font-mono text-ink-400 px-2 py-1 rounded-lg bg-ink-700 border border-ink-600">
            {daysLeft}d left
          </span>
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {board.map((entry, i) => {
          const member = members.find((m) => m.id === entry.memberId)
          if (!member) return null
          const isMe = entry.memberId === currentUserId
          const barPct = Math.round((entry.points / maxPoints) * 100)
          const medal = RANK_MEDALS[entry.rank]

          return (
            <div
              key={entry.memberId}
              className={`relative rounded-xl px-4 py-3 overflow-hidden transition-all duration-200 ${
                isMe
                  ? 'border border-gold-400/30 glow-sm-gold'
                  : 'glass border-0'
              }`}
              style={isMe ? { background: 'rgba(204,163,72,0.06)' } : { background: 'rgba(255,255,255,0.025)' }}
            >
              {/* Bar fill behind */}
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 pointer-events-none ${
                  isMe ? 'bg-gold-400/08' : 'bg-periwinkle-400/06'
                }`}
                style={{ width: `${barPct}%` }}
              />

              <div className="relative flex items-center gap-3">
                {/* Rank */}
                <span className="text-base w-6 shrink-0 text-center">
                  {medal ?? <span className="text-xs text-ink-400 font-mono">{entry.rank}</span>}
                </span>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-900 shrink-0"
                  style={{ background: `hsl(${member.avatarHue}, 60%, 60%)` }}
                >
                  {member.initials}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isMe ? 'text-gold-300' : 'text-ink-50'}`}>
                    {member.name.split(' ')[0]}
                    {isMe && <span className="text-2xs text-ink-400 ml-1 font-normal">(you)</span>}
                  </p>
                  {/* Streak badge */}
                  {member.streakDays > 0 && (
                    <p className="text-2xs text-ink-400">
                      🔥 {member.streakDays}d streak
                    </p>
                  )}
                </div>

                {/* Points */}
                <span className={`font-mono text-sm font-medium tabular-nums ${isMe ? 'text-gold-300' : 'text-ink-200'}`}>
                  {entry.points}
                </span>
                <span className="text-2xs text-ink-400 font-mono">pts</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rules collapsible */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer list-none">
          <span className="text-2xs font-semibold uppercase tracking-widest text-ink-400 group-open:text-ink-200 transition-colors">
            Scoring rules (Ivy runs this)
          </span>
          <span className="text-2xs text-ink-600 group-open:text-ink-400 transition-colors ml-auto">▾</span>
        </summary>
        <p className="mt-2 text-xs text-ink-400 leading-relaxed pl-1 italic">
          "{game.ivyInstruction}"
        </p>
      </details>
    </div>
  )
}
