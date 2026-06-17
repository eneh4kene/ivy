'use client'

/**
 * BatonGame — the relay/baton game UI for the Circles screen.
 *
 * Shows: who holds the baton, their window, lives remaining, pass order,
 * the baton-stake raised-amount indicator, and an animated "pass moment".
 *
 * MOCK DATA ONLY — no backend calls.
 */

import { useState, useEffect } from 'react'
import type { CircleGame, CircleMemberMock, BatonState } from '@/lib/mock/circles'
import { getPassOrder } from '@/lib/mock/circles'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function MemberAvatar({
  member,
  size = 'md',
  ring = false,
  ringColor = 'gold',
}: {
  member: CircleMemberMock
  size?: 'sm' | 'md' | 'lg'
  ring?: boolean
  ringColor?: 'gold' | 'sage' | 'ember' | 'periwinkle'
}) {
  const sz = size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  const ringClasses = ring
    ? ringColor === 'gold'
      ? 'ring-2 ring-offset-2 ring-offset-ink-900 ring-gold-400'
      : ringColor === 'sage'
      ? 'ring-2 ring-offset-2 ring-offset-ink-900 ring-sage-400'
      : ringColor === 'ember'
      ? 'ring-2 ring-offset-2 ring-offset-ink-900 ring-ember-400'
      : 'ring-2 ring-offset-2 ring-offset-ink-900 ring-periwinkle-400'
    : ''

  return (
    <div
      className={`${sz} ${ringClasses} rounded-full flex items-center justify-center font-semibold text-ink-900 shrink-0 transition-all duration-300`}
      style={{ background: `hsl(${member.avatarHue}, 60%, 60%)` }}
    >
      {member.initials}
    </div>
  )
}

function LivesIndicator({ remaining, total }: { remaining: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
            i < remaining
              ? 'bg-sage-400 glow-sm-sage'
              : 'bg-ink-600'
          }`}
          style={i < remaining ? { animationDelay: `${i * 0.1}s` } : {}}
        />
      ))}
      <span className="text-2xs font-medium text-ink-400 ml-1">
        {remaining}/{total} lives
      </span>
    </div>
  )
}

interface BatonGameProps {
  game: CircleGame
  members: CircleMemberMock[]
  currentUserId: string
}

export function BatonGame({ game, members, currentUserId }: BatonGameProps) {
  const baton = game.batonState!
  const holder = members.find((m) => m.id === baton.holderId)!
  const isMyTurn = baton.holderId === currentUserId
  const passOrder = getPassOrder(members, baton.holderId)
  const nextUp = passOrder[0]

  const [countdown, setCountdown] = useState<string>('')
  const [pct, setPct] = useState(0)
  const [justPassed, setJustPassed] = useState(false)

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const total = baton.windowClosesAt.getTime() - baton.windowOpensAt.getTime()
      const elapsed = now - baton.windowOpensAt.getTime()
      const remaining = baton.windowClosesAt.getTime() - now
      setPct(Math.min(Math.max((elapsed / total) * 100, 0), 100))
      setCountdown(formatCountdown(Math.max(remaining, 0)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [baton])

  const handleSimulatePass = () => {
    // MOCK: in prod this calls circleGamesApi.recordEvent(game.id, { eventType: 'BATON_PASSED' })
    setJustPassed(true)
    setTimeout(() => setJustPassed(false), 2400)
  }

  const windowPct = Math.round(pct)
  const isLate = pct > 80

  return (
    <div className="space-y-4">

      {/* ── Game label bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🏃</span>
          <div>
            <p className="text-sm font-semibold text-ink-50">{game.name}</p>
            <p className="text-2xs text-ink-400 font-mono">relay · baton game</p>
          </div>
        </div>
        <LivesIndicator remaining={baton.livesRemaining} total={baton.totalLives} />
      </div>

      {/* ── Baton holder card ── */}
      <div
        className={`relative rounded-2xl p-5 overflow-hidden transition-all duration-300 ${
          isMyTurn
            ? 'border border-gold-400/40 glow-gold'
            : 'glass border border-periwinkle-400/20'
        }`}
        style={
          isMyTurn
            ? { background: 'rgba(204,163,72,0.06)' }
            : { background: 'rgba(238,238,255,0.03)' }
        }
      >
        {/* Pass animation overlay */}
        {justPassed && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-ink-900/60 rounded-2xl animate-fade-in">
            <div className="text-center space-y-1">
              <p className="text-3xl">🏃✨</p>
              <p className="text-sm font-semibold text-gold-300 font-display">Baton passed!</p>
            </div>
          </div>
        )}

        {/* Holder row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <MemberAvatar
              member={holder}
              size="lg"
              ring
              ringColor={isMyTurn ? 'gold' : 'periwinkle'}
            />
            {/* Baton icon */}
            <span
              className="absolute -bottom-1 -right-1 text-sm"
              style={{ filter: 'drop-shadow(0 0 4px rgba(204,163,72,0.8))' }}
            >
              🏃
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-50">
              {isMyTurn ? 'You hold the baton' : `${holder.name} holds the baton`}
            </p>
            {baton.batonRaisedStake > 0 && (
              <p className="text-2xs text-ember-400 mt-0.5 font-mono">
                +£{baton.batonRaisedStake} extra stake active (baton-stake)
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xs font-mono font-medium text-ink-200">{countdown}</span>
              <span className="text-2xs text-ink-400">window closes</span>
            </div>
          </div>
          {isMyTurn && (
            <div className="shrink-0">
              <span className="text-2xs font-semibold uppercase tracking-widest text-gold-400 px-2 py-1 rounded-lg bg-gold-400/10 border border-gold-400/25 pulse-gold">
                Your turn
              </span>
            </div>
          )}
        </div>

        {/* Window progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-ink-400">Window elapsed</span>
            <span className={`text-2xs font-mono font-medium ${isLate ? 'text-ember-400' : 'text-ink-200'}`}>
              {windowPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isLate ? 'bg-ember-400' : 'bg-periwinkle-400'
              }`}
              style={{ width: `${windowPct}%` }}
            />
          </div>
        </div>

        {/* CTA for current user */}
        {isMyTurn && (
          <button
            onClick={handleSimulatePass}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-sm text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all duration-200 glow-gold active:scale-95"
          >
            Pass the baton — I'm done
          </button>
        )}
      </div>

      {/* ── Pass order queue ── */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">
          Up next
        </p>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {passOrder.map((m, i) => (
            <div key={m.id} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative">
                <MemberAvatar
                  member={m}
                  size="sm"
                  ring={i === 0}
                  ringColor="periwinkle"
                />
                {i === 0 && (
                  <span className="absolute -top-1 -right-1 text-xs">👤</span>
                )}
              </div>
              <span className="text-2xs text-ink-400 text-center" style={{ maxWidth: 48 }}>
                {m.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
        {nextUp && (
          <p className="text-xs text-ink-200">
            {isMyTurn
              ? `Pass to ${nextUp.name.split(' ')[0]} — they're on standby.`
              : `${nextUp.name.split(' ')[0]} is on standby after ${holder.name.split(' ')[0]}.`}
          </p>
        )}
      </div>

      {/* ── Ivy instruction (plain English rules) ── */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer list-none">
          <span className="text-2xs font-semibold uppercase tracking-widest text-ink-400 group-open:text-ink-200 transition-colors">
            Game rules (Ivy runs this)
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
