'use client'

/**
 * EveningReview — the truthful evening surface.
 *
 * Ivy's evening reflection happens over a real check-in CALL (the async
 * voice model), not an in-app text chatbot. This screen plays back the
 * morning voice note, shows the honest day status, and lets the user pull
 * the check-in call forward via the real /api/calls/rescue endpoint.
 */

import { useState } from 'react'
import { Phone, Check, Loader2 } from 'lucide-react'
import { callsApi } from '@/lib/api'
import type { VoiceNote } from './types'

function VoiceNoteCard({ vn }: { vn: VoiceNote }) {
  const dur = `${Math.floor(vn.duration / 60)}:${String(vn.duration % 60).padStart(2, '0')}`
  return (
    <div className="glass-gold rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gold-400" stroke="currentColor" strokeWidth={1.5}>
            <rect x="5" y="1" width="6" height="9" rx="3" />
            <path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6" strokeLinecap="round" />
            <path d="M8 14v2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-semibold uppercase tracking-widest text-gold-400">
              This morning you said
            </span>
            {vn.duration > 0 && <span className="text-2xs text-ink-400 font-mono">{dur}</span>}
          </div>
          {vn.transcript ? (
            <p className="text-sm text-ink-100 leading-relaxed font-display italic">
              &ldquo;{vn.transcript}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-ink-400 leading-relaxed">
              Voice note recorded — transcript still processing.
            </p>
          )}
          <p className="text-2xs text-ink-400 mt-1.5">
            {vn.recordedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}

interface EveningReviewProps {
  /** The morning voice note, if the user armed today. */
  voiceNote: VoiceNote | null
  /** Whether the user armed today. */
  isArmed: boolean
}

export function EveningReview({ voiceNote, isArmed }: EveningReviewProps) {
  const [callState, setCallState] = useState<'idle' | 'requesting' | 'requested' | 'error'>('idle')
  const [error, setError] = useState('')

  const requestCall = async () => {
    setCallState('requesting')
    setError('')
    try {
      await callsApi.requestRescueCall()
      setCallState('requested')
    } catch (e: any) {
      setError(e?.message ?? 'Could not request a call — please try again.')
      setCallState('error')
    }
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
      {voiceNote ? (
        <VoiceNoteCard vn={voiceNote} />
      ) : (
        <div className="surface rounded-2xl p-4">
          <p className="text-sm font-semibold text-ink-100">No voice note today</p>
          <p className="text-xs text-ink-400 mt-1">
            {isArmed
              ? "You're armed, but no morning voice note was recorded."
              : "You didn't arm today. Your stake slice for today is on the line."}
          </p>
        </div>
      )}

      {/* How the evening reflection works — truthful */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Your evening reflection</p>
        <p className="text-sm text-ink-200 leading-relaxed">
          Ivy reflects with you over a short check-in call — she&rsquo;ll play back what you committed to
          this morning and help you close the day honestly. You can wait for your scheduled call or pull
          it forward now.
        </p>

        {callState === 'requested' ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-sage-400/10 border border-sage-400/20">
            <Check className="w-4 h-4 text-sage-400" strokeWidth={2.5} />
            <p className="text-sm text-sage-300">Ivy will call you shortly.</p>
          </div>
        ) : (
          <button
            onClick={requestCall}
            disabled={callState === 'requesting'}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gold-400 text-ink-900
              font-semibold text-sm glow-sm-gold transition-all active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gold-300"
          >
            {callState === 'requesting' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
            ) : (
              <><Phone className="w-4 h-4" /> Call me now</>
            )}
          </button>
        )}

        {error && <p className="text-2xs text-ember-400">{error}</p>}
      </div>
    </div>
  )
}
