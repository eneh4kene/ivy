'use client'

/**
 * Step 2 — Pick forfeit destination mode: MIDDLE or SAVAGE.
 * See §3 of docs/product-pricing-rework.md for product rationale.
 *
 * MOCK DATA ONLY — no backend calls.
 */

import { FORFEIT_OPTIONS, HOUSE_CHARITIES, type ForfeitMode } from '@/lib/mock/stake-setup'

interface ForfeitModeStepProps {
  value: ForfeitMode
  onChange: (mode: ForfeitMode) => void
  onNext: () => void
}

const TEETH_BARS: Record<1 | 2, React.ReactNode> = {
  1: (
    <div className="flex items-center gap-1">
      <span className="w-6 h-1.5 rounded-full bg-ember-400/80" />
      <span className="w-6 h-1.5 rounded-full bg-ember-400/20" />
      <span className="text-2xs text-ember-400/70 ml-1 font-mono">softer</span>
    </div>
  ),
  2: (
    <div className="flex items-center gap-1">
      <span className="w-6 h-1.5 rounded-full bg-ember-400" />
      <span className="w-6 h-1.5 rounded-full bg-ember-400" />
      <span className="text-2xs text-ember-400 ml-1 font-mono font-semibold">maximum</span>
    </div>
  ),
}

export function ForfeitModeStep({ value, onChange, onNext }: ForfeitModeStepProps) {
  return (
    <div className="flex flex-col gap-6">

      {/* Hero copy */}
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl text-ink-50 leading-tight">
          Where should the money go<br />
          <span className="italic text-ember-400">if you slip?</span>
        </h2>
        <p className="text-sm text-ink-400 leading-relaxed">
          Self-selecting your failure destination makes it bite harder.
          Choose honestly — you can't change this mid-cycle.
        </p>
      </div>

      {/* Option cards */}
      <div className="space-y-3">
        {FORFEIT_OPTIONS.map((opt) => {
          const selected = value === opt.mode
          const isSavage = opt.mode === 'SAVAGE'

          return (
            <button
              key={opt.mode}
              onClick={() => onChange(opt.mode)}
              className={`w-full text-left rounded-2xl p-5 transition-all duration-200 active:scale-[0.985] ${
                selected
                  ? isSavage
                    ? 'border border-ember-400/50 glow-ember'
                    : 'border border-gold-400/40 glow-sm-gold'
                  : 'surface hover:border-ink-400/50'
              }`}
              style={
                selected
                  ? isSavage
                    ? { background: 'rgba(210,90,46,0.07)' }
                    : { background: 'rgba(204,163,72,0.06)' }
                  : {}
              }
            >
              {/* Header row */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  selected
                    ? isSavage ? 'border-ember-400 bg-ember-400' : 'border-gold-400 bg-gold-400'
                    : 'border-ink-500'
                }`}>
                  {selected && (
                    <div className="w-2 h-2 rounded-full bg-ink-900" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-base font-semibold font-display ${
                      selected
                        ? isSavage ? 'text-ember-400' : 'text-gold-300'
                        : 'text-ink-50'
                    }`}>
                      {opt.label}
                    </span>
                    {opt.mode === 'MIDDLE' && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-ink-700 border border-ink-600 text-ink-400 font-mono">
                        default
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${
                    selected
                      ? isSavage ? 'text-ember-400/80' : 'text-gold-400/80'
                      : 'text-ink-400'
                  }`}>
                    {opt.sublabel}
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {TEETH_BARS[opt.teethLevel]}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-ink-300 leading-relaxed pl-8">
                {opt.description}
              </p>

              {/* For MIDDLE: show the house charities */}
              {opt.mode === 'MIDDLE' && selected && (
                <div className="mt-3 pl-8 space-y-1.5">
                  <p className="text-2xs font-semibold uppercase tracking-widest text-ink-400">House charity pool</p>
                  {HOUSE_CHARITIES.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-ink-900 shrink-0"
                        style={{ background: `hsl(${c.logoHue}, 60%, 60%)` }}
                      >
                        {c.logoInitials[0]}
                      </div>
                      <span className="text-xs text-ink-300">{c.name}</span>
                      <span className="text-2xs text-ink-400">· {c.cause}</span>
                    </div>
                  ))}
                  <p className="text-2xs text-ink-400 mt-1">
                    ⚑ Founder is confirming the final 1–3 vetted orgs
                  </p>
                </div>
              )}

              {/* SAVAGE honest caveat */}
              {opt.mode === 'SAVAGE' && selected && (
                <div className="mt-3 pl-8 p-3 rounded-xl bg-ember-400/08 border border-ember-400/20">
                  <p className="text-xs text-ember-400/90">
                    You'll choose a real charity you actively dislike on the next screen.
                    Every miss sends money there. Think carefully.
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* The weak option disclaimer */}
      <div className="surface rounded-xl p-3 flex items-start gap-2">
        <span className="text-sm">⚠️</span>
        <p className="text-xs text-ink-400 leading-relaxed">
          We don't offer "forfeit to my own charity" — it's been deliberately removed.
          If failing still feels good, it isn't a stake.
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all duration-200 active:scale-95"
      >
        {value === 'SAVAGE' ? 'Savage — continue' : 'Middle — continue'}
      </button>
    </div>
  )
}
