'use client'

/**
 * CollectiveGame — shared progress bar variant for the Circles game panel.
 * MOCK DATA ONLY — no backend calls.
 */

import type { CircleGame } from '@/lib/mock/circles'

interface CollectiveGameProps {
  game: CircleGame
}

export function CollectiveGame({ game }: CollectiveGameProps) {
  const prog = game.collective!
  const pct = Math.min(Math.round((prog.current / prog.target) * 100), 100)
  const remaining = prog.target - prog.current
  const isClose = pct >= 75
  const isDone = pct >= 100

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">🤝</span>
        <div>
          <p className="text-sm font-semibold text-ink-50">{game.name}</p>
          <p className="text-2xs text-ink-400 font-mono">collective · {prog.unit}</p>
        </div>
      </div>

      {/* Progress card */}
      <div
        className={`rounded-2xl p-5 space-y-4 transition-all duration-300 ${
          isDone
            ? 'border border-sage-400/40 glow-sage'
            : isClose
            ? 'border border-gold-400/25'
            : 'glass'
        }`}
        style={
          isDone
            ? { background: 'rgba(85,163,120,0.07)' }
            : isClose
            ? { background: 'rgba(204,163,72,0.05)' }
            : { background: 'rgba(255,255,255,0.025)' }
        }
      >
        {/* Numbers */}
        <div className="flex items-end gap-2">
          <span
            className={`font-mono text-4xl font-medium tabular-nums leading-none ${
              isDone ? 'text-sage-300' : isClose ? 'text-gold-300' : 'text-ink-50'
            }`}
          >
            {prog.current}
          </span>
          <span className="text-ink-400 font-mono text-lg mb-0.5">/ {prog.target}</span>
          <span className="text-ink-400 text-sm mb-0.5">{prog.unit}</span>
        </div>

        {/* Big bar */}
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-ink-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isDone ? 'bg-sage-400' : isClose ? 'bg-gold-400' : 'bg-periwinkle-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-2xs font-mono font-medium ${isDone ? 'text-sage-400' : isClose ? 'text-gold-400' : 'text-periwinkle-400'}`}>
              {pct}% there
            </span>
            {!isDone && (
              <span className="text-2xs text-ink-400 font-mono">
                {remaining} more · {prog.daysLeft}d left
              </span>
            )}
            {isDone && (
              <span className="text-2xs text-sage-400 font-semibold">Target hit!</span>
            )}
          </div>
        </div>

        {/* Rate needed */}
        {!isDone && prog.daysLeft > 0 && (
          <p className="text-xs text-ink-400">
            You need{' '}
            <span className="text-ink-200 font-mono">
              {Math.ceil(remaining / prog.daysLeft)}
            </span>{' '}
            {prog.unit} per day between you to hit the target.
          </p>
        )}

        {/* Charity impact line */}
        <div className="pt-1 border-t border-ink-600/40 flex items-center gap-2">
          <span className="text-sm">🌍</span>
          <p className="text-xs text-ink-300">
            {isDone
              ? `Done. Your circle's success-donations go to ${prog.chosenCharity} this sprint.`
              : `Hit the target and the circle's success-donations go to ${prog.chosenCharity}.`}
          </p>
        </div>
      </div>

      {/* Rules collapsible */}
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
