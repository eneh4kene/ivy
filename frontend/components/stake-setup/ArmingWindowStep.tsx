'use client'

/**
 * Step 4 — Set the morning arming window (HH:MM deadline).
 * The VN must be recorded before this time or the day counts as a miss.
 *
 * MOCK DATA ONLY — no backend calls.
 */

import { ARMING_WINDOW_PRESETS } from '@/lib/mock/stake-setup'

interface ArmingWindowStepProps {
  windowStart: string    // HH:MM
  windowEnd: string      // HH:MM
  onChangeStart: (t: string) => void
  onChangeEnd: (t: string) => void
  onNext: () => void
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex-1 space-y-1.5">
      <label className="text-2xs font-semibold uppercase tracking-widest text-ink-400">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-xl bg-ink-700 border border-ink-600 text-sm font-mono text-ink-50 focus:outline-none focus:border-gold-400/60 transition-colors [color-scheme:dark]"
      />
    </div>
  )
}

export function ArmingWindowStep({
  windowStart,
  windowEnd,
  onChangeStart,
  onChangeEnd,
  onNext,
}: ArmingWindowStepProps) {
  const canProceed = windowStart && windowEnd && windowEnd > windowStart

  const handlePreset = (preset: (typeof ARMING_WINDOW_PRESETS)[number]) => {
    onChangeStart(preset.start)
    onChangeEnd(preset.end)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Hero copy */}
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl text-ink-50 leading-tight">
          When do you arm each morning?
        </h2>
        <p className="text-sm text-ink-400 leading-relaxed">
          Drop your voice note before this window closes or the day doesn't count.
          Choose a deadline you can actually hit — five minutes of buffer beats false confidence.
        </p>
      </div>

      {/* Visual window diagram */}
      <div className="glass rounded-2xl px-5 py-4 space-y-3">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Your arming window</p>
        <div className="relative h-2 bg-ink-700 rounded-full overflow-hidden">
          {/* 24h scale */}
          {windowStart && windowEnd && (() => {
            const toMins = (t: string) => {
              const [h, m] = t.split(':').map(Number)
              return h * 60 + m
            }
            const startMins = toMins(windowStart)
            const endMins   = toMins(windowEnd)
            const leftPct   = (startMins / 1440) * 100
            const widthPct  = ((endMins - startMins) / 1440) * 100
            return (
              <div
                className="absolute h-full bg-gold-400 rounded-full"
                style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
              />
            )
          })()}
        </div>
        <div className="flex items-center justify-between text-2xs text-ink-400 font-mono">
          <span>midnight</span>
          <span>noon</span>
          <span>midnight</span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="glass-gold rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-2xs text-gold-400/70 uppercase tracking-widest mb-0.5">Opens</p>
            <p className="font-mono text-sm text-gold-300">{windowStart || '—'}</p>
          </div>
          <div className="text-ink-600 text-lg font-light">→</div>
          <div className="glass-gold rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-2xs text-ember-400/70 uppercase tracking-widest mb-0.5">Deadline</p>
            <p className="font-mono text-sm text-ember-400">{windowEnd || '—'}</p>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Quick picks</p>
        <div className="grid grid-cols-2 gap-2">
          {ARMING_WINDOW_PRESETS.map((preset) => {
            const active = preset.start === windowStart && preset.end === windowEnd
            return (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className={`text-left p-3.5 rounded-xl transition-all duration-150 active:scale-95 ${
                  active
                    ? 'border border-gold-400/40 bg-gold-400/08 glow-sm-gold'
                    : 'surface hover:border-ink-400/50'
                }`}
              >
                <p className={`text-sm font-medium ${active ? 'text-gold-300' : 'text-ink-50'}`}>
                  {preset.label}
                </p>
                <p className="text-2xs font-mono text-ink-400 mt-0.5">
                  {preset.start} → {preset.end}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual inputs */}
      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">Or set exact times</p>
        <div className="flex gap-3">
          <TimeInput label="Opens at" value={windowStart} onChange={onChangeStart} />
          <TimeInput label="Deadline" value={windowEnd}   onChange={onChangeEnd} />
        </div>
        {windowEnd <= windowStart && windowEnd && windowStart && (
          <p className="text-xs text-ember-400 mt-1">Deadline must be after opening time.</p>
        )}
      </div>

      {/* The mechanic explained */}
      <div className="surface rounded-xl p-4 space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">How it works</p>
        <ul className="space-y-1.5 text-xs text-ink-300 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-gold-400 shrink-0">1.</span>
            Ivy sends your morning prompt at {windowStart || '—'}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-400 shrink-0">2.</span>
            One reminder ~60 min later if no voice note
          </li>
          <li className="flex items-start gap-2">
            <span className="text-ember-400 shrink-0">3.</span>
            {windowEnd || '—'} — if no VN by this time, today is unarmed and your stake forfeits
          </li>
        </ul>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-300 transition-all duration-200 active:scale-95"
      >
        Set window {windowStart}–{windowEnd} — continue
      </button>
    </div>
  )
}
