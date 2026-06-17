'use client'

/**
 * Reusable charity picker — used for:
 *   (a) success charity (§2: corporate donation fires on success)
 *   (b) disliked charity — SAVAGE forfeit destination (§3)
 *
 * MOCK DATA ONLY — no backend calls.
 */

import { useState } from 'react'
import { Search, Check, AlertTriangle } from 'lucide-react'
import { CHARITY_CATALOGUE, type CharityOption } from '@/lib/mock/stake-setup'

interface CharitySelectStepProps {
  mode: 'success' | 'savage'
  value: string | null
  onChange: (id: string) => void
  onNext: () => void
}

export function CharitySelectStep({ mode, value, onChange, onNext }: CharitySelectStepProps) {
  const [query, setQuery] = useState('')

  const isSuccess = mode === 'success'

  const filtered = CHARITY_CATALOGUE.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.cause.toLowerCase().includes(query.toLowerCase())
  )

  const selected = CHARITY_CATALOGUE.find((c) => c.id === value)

  return (
    <div className="flex flex-col gap-5">

      {/* Hero copy */}
      <div className="space-y-1.5">
        {isSuccess ? (
          <>
            <h2 className="font-display text-2xl text-ink-50 leading-tight">
              Who benefits when<br />
              <span className="text-gradient-sage">you follow through?</span>
            </h2>
            <p className="text-sm text-ink-400 leading-relaxed">
              On days you show up, a corporate donor contributes to this cause.
              You don't pay — this is the warmth side of the system.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-ink-50 leading-tight">
              Pick a cause you'd<br />
              <span className="text-ember-400 italic">hate to fund</span>
            </h2>
            <p className="text-sm text-ink-400 leading-relaxed">
              When you slip, your stake goes here. Choose something that genuinely
              makes you wince — that's the point.
            </p>
          </>
        )}
      </div>

      {/* Selected preview */}
      {selected && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 transition-all ${
            isSuccess
              ? 'glass-sage border border-sage-400/20'
              : 'border border-ember-400/30 glow-ember'
          }`}
          style={!isSuccess ? { background: 'rgba(210,90,46,0.06)' } : {}}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-ink-900 shrink-0"
            style={{ background: `hsl(${selected.logoHue}, 60%, 60%)` }}
          >
            {selected.logoInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isSuccess ? 'text-sage-300' : 'text-ember-400'}`}>
              {selected.name}
            </p>
            <p className="text-xs text-ink-400">{selected.cause}</p>
          </div>
          <Check className={`w-4 h-4 shrink-0 ${isSuccess ? 'text-sage-400' : 'text-ember-400'}`} />
        </div>
      )}

      {/* SAVAGE extra context */}
      {!isSuccess && (
        <div className="flex items-start gap-2 px-1">
          <AlertTriangle className="w-3.5 h-3.5 text-ember-400 shrink-0 mt-0.5" />
          <p className="text-xs text-ink-400">
            This must be a <em>real charity you'd hate to benefit from your failure</em>.
            Don't pick something harmless — that defeats the purpose.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search charities…"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-ink-700 border border-ink-600 text-sm text-ink-50 placeholder:text-ink-400 focus:outline-none focus:border-ink-400 transition-colors"
        />
      </div>

      {/* Charity list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto overscroll-contain pr-0.5">
        {filtered.map((c) => {
          const isSelected = c.id === value
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl transition-all duration-150 active:scale-[0.98] ${
                isSelected
                  ? isSuccess
                    ? 'border border-sage-400/30 bg-sage-400/07'
                    : 'border border-ember-400/40 bg-ember-400/07'
                  : 'surface hover:bg-ink-700'
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-ink-900 shrink-0"
                style={{ background: `hsl(${c.logoHue}, 60%, 60%)` }}
              >
                {c.logoInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isSelected
                  ? isSuccess ? 'text-sage-300' : 'text-ember-300'
                  : 'text-ink-50'}`}>
                  {c.name}
                </p>
                <p className="text-xs text-ink-400">{c.cause}</p>
              </div>
              {isSelected && (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isSuccess ? 'bg-sage-400' : 'bg-ember-400'
                }`}>
                  <Check className="w-3 h-3 text-ink-900" />
                </div>
              )}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-ink-400 py-6">No charities matching "{query}"</p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!value}
        className={`w-full py-4 rounded-2xl font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 ${
          isSuccess
            ? 'text-ink-900 bg-gold-400 hover:bg-gold-300'
            : 'text-ink-900 bg-ember-400 hover:bg-ember-400/90 glow-ember'
        }`}
      >
        {selected
          ? isSuccess
            ? `${selected.name} — continue`
            : `That's my anti-charity — continue`
          : isSuccess
          ? 'Choose a success charity'
          : 'Choose your anti-charity'}
      </button>
    </div>
  )
}
