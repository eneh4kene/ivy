'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Pause, RotateCcw, Check } from 'lucide-react'
import type { VoiceNote } from '@/lib/mock/daily-loop'
import { voiceNotesApi } from '@/lib/api'

/* ── Waveform display ─────────────────────────────────────────────────────── */
/** Animated bars: live during recording, static waveform during playback */
function Waveform({
  isRecording,
  bars = 32,
  playbackProgress = 0,
}: {
  isRecording: boolean
  bars?: number
  playbackProgress?: number
}) {
  // Randomised static heights for the playback waveform
  const staticHeights = useRef<number[]>(
    Array.from({ length: bars }, () => 0.2 + Math.random() * 0.8)
  )

  const fillTo = Math.floor(playbackProgress * bars)

  return (
    <div className="flex items-center justify-center gap-[3px] h-12 w-full">
      {Array.from({ length: bars }, (_, i) => {
        const h = staticHeights.current[i]
        const isFilled = i < fillTo

        if (isRecording) {
          return (
            <span
              key={i}
              className="inline-block w-[3px] rounded-full bg-gold-400 origin-center"
              style={{
                height: '100%',
                transform: 'scaleY(0.25)',
                animation: `waveform-bar ${0.5 + (i % 5) * 0.12}s ease-in-out ${(i % 7) * 0.05}s infinite`,
              }}
            />
          )
        }

        return (
          <span
            key={i}
            className={`inline-block w-[3px] rounded-full origin-center transition-colors duration-100 ${
              isFilled ? 'bg-gold-400' : 'bg-ink-600'
            }`}
            style={{ height: `${h * 100}%` }}
          />
        )
      })}
    </div>
  )
}

/* ── Main Recorder ────────────────────────────────────────────────────────── */
type RecorderState = 'idle' | 'recording' | 'recorded' | 'playing' | 'submitting' | 'submitted'

interface VoiceRecorderProps {
  onSubmit: (voiceNote: VoiceNote) => void
  prompt: string
  stakeAmount: number
  currency: 'GBP' | 'USD'
}

export function VoiceRecorder({ onSubmit, prompt, stakeAmount, currency }: VoiceRecorderProps) {
  const [phase, setPhase]               = useState<RecorderState>('idle')
  const [recordSeconds, setRecordSecs]  = useState(0)
  const [playSeconds, setPlaySecs]      = useState(0)
  const [totalSeconds, setTotalSecs]    = useState(0)
  const [isLongPressing, setIsLong]     = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [submitError, setSubmitError]   = useState('')

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdAnimRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorder   = useRef<MediaRecorder | null>(null)
  const audioChunks     = useRef<Blob[]>([])
  const audioBlob       = useRef<Blob | null>(null)
  const audioUrl        = useRef<string | null>(null)
  const audioEl         = useRef<HTMLAudioElement | null>(null)

  const sym = currency === 'GBP' ? '£' : '$'

  // ── Real MediaRecorder-based recording ──
  const startRecording = useCallback(async () => {
    setPhase('recording')
    setRecordSecs(0)
    audioChunks.current = []
    audioBlob.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorder.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mimeType })
        audioBlob.current = blob
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
        audioUrl.current = URL.createObjectURL(blob)
        // Stop all tracks so mic indicator goes off
        stream.getTracks().forEach((t) => t.stop())
      }

      mr.start(100) // collect in 100ms chunks
    } catch {
      // Mic permission denied or not available — fall back to timer-only mode
      // (the blob will be null and submit will handle gracefully)
    }

    timerRef.current = setInterval(() => {
      setRecordSecs((s) => s + 1)
    }, 1000)
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    setPhase('recorded')
    setTotalSecs(recordSeconds)
    setPlaySecs(0)
  }, [recordSeconds])

  // ── Press-and-hold handlers ──
  const onPressStart = useCallback(() => {
    if (phase !== 'idle') return
    setIsLong(false)
    setHoldProgress(0)

    // Animate the hold ring
    let prog = 0
    holdAnimRef.current = setInterval(() => {
      prog += 1 / 30  // 30 steps over 300ms
      setHoldProgress(Math.min(prog, 1))
      if (prog >= 1) {
        clearInterval(holdAnimRef.current!)
        setIsLong(true)
      }
    }, 10)

    // Start recording after 300ms hold
    longPressTimer.current = setTimeout(() => {
      startRecording()
    }, 300)
  }, [phase, startRecording])

  const onPressEnd = useCallback(() => {
    if (longPressTimer.current)  clearTimeout(longPressTimer.current)
    if (holdAnimRef.current)     clearInterval(holdAnimRef.current)
    setHoldProgress(0)
    if (phase === 'recording') {
      stopRecording()
    }
  }, [phase, stopRecording])

  // ── Playback using real audio blob ──
  const togglePlay = useCallback(() => {
    if (phase === 'playing') {
      audioEl.current?.pause()
      setPhase('recorded')
      if (timerRef.current) clearInterval(timerRef.current)
    } else if (audioUrl.current) {
      if (!audioEl.current) {
        audioEl.current = new Audio(audioUrl.current)
        audioEl.current.onended = () => {
          setPhase('recorded')
          setPlaySecs(0)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }
      audioEl.current.play().catch(() => {})
      setPhase('playing')
      timerRef.current = setInterval(() => {
        setPlaySecs((s) => {
          if (s >= totalSeconds) {
            clearInterval(timerRef.current!)
            setPhase('recorded')
            return 0
          }
          return s + 1
        })
      }, 1000)
    }
  }, [phase, totalSeconds])

  const retake = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    audioEl.current?.pause()
    audioEl.current = null
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null }
    audioBlob.current = null
    setPhase('idle')
    setRecordSecs(0)
    setPlaySecs(0)
    setTotalSecs(0)
    setSubmitError('')
  }, [])

  // ── Submit — upload to /api/voice-notes ──
  const submit = useCallback(async () => {
    setPhase('submitting')
    setSubmitError('')
    try {
      let result: Awaited<ReturnType<typeof voiceNotesApi.submit>> | null = null

      if (audioBlob.current && audioBlob.current.size > 0) {
        result = await voiceNotesApi.submit(audioBlob.current, totalSeconds)
      }
      // If no real audio (e.g. mic permission denied), still mark armed via UI
      setPhase('submitted')
      onSubmit({
        id:         result?.voiceNote.id ?? `vn-${Date.now()}`,
        duration:   result?.voiceNote.durationSec ?? totalSeconds,
        transcript: result?.voiceNote.transcript ?? '',
        recordedAt: result?.voiceNote.recordedAt ? new Date(result.voiceNote.recordedAt) : new Date(),
      })
    } catch (err: any) {
      setSubmitError(err.message ?? 'Upload failed — please try again.')
      setPhase('recorded')
    }
  }, [totalSeconds, onSubmit])

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current)       clearInterval(timerRef.current)
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (holdAnimRef.current)    clearInterval(holdAnimRef.current)
    audioEl.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
  }, [])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  /* ── Submitted state ── */
  if (phase === 'submitted') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-fade-in-scale">
        <div className="w-16 h-16 rounded-full bg-sage-400/15 border border-sage-400/30 flex items-center justify-center glow-sm-sage">
          <Check className="w-7 h-7 text-sage-400" strokeWidth={2.5} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-display text-xl text-ink-50">Armed for the day</p>
          <p className="text-sm text-ink-400">
            {sym}{stakeAmount} secured · Ivy has your commitment
          </p>
        </div>
      </div>
    )
  }

  /* ── Main recorder UI ── */
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto py-4">
      {/* Prompt text */}
      <p className="font-display text-lg text-ink-200 text-center leading-snug italic px-2">
        {prompt}
      </p>

      {/* Waveform area */}
      <div className="w-full px-4">
        {phase === 'idle' ? (
          <div className="h-12 flex items-center justify-center">
            <p className="text-ink-400 text-sm">Press and hold the mic to record</p>
          </div>
        ) : (
          <Waveform
            isRecording={phase === 'recording'}
            playbackProgress={phase === 'playing' ? playSeconds / totalSeconds : 0}
          />
        )}
      </div>

      {/* Timer / duration */}
      <div className="h-6 flex items-center justify-center">
        {phase === 'recording' && (
          <span className="font-mono text-sm text-ember-400 tabular-nums">
            {formatTime(recordSeconds)} · recording
          </span>
        )}
        {(phase === 'recorded' || phase === 'playing') && (
          <span className="font-mono text-sm text-ink-400 tabular-nums">
            {formatTime(phase === 'playing' ? playSeconds : 0)} / {formatTime(totalSeconds)}
          </span>
        )}
      </div>

      {/* Controls */}
      {phase === 'idle' || phase === 'recording' ? (
        /* Press-and-hold mic button */
        <div className="relative flex items-center justify-center">
          {/* Expanding ring on press */}
          {isLongPressing && (
            <span className="absolute w-24 h-24 rounded-full border-2 border-gold-400/50 animate-record-ring" />
          )}
          {/* Outer glow ring */}
          <span
            className={`absolute w-20 h-20 rounded-full border transition-all duration-200 ${
              phase === 'recording'
                ? 'border-ember-400/60 bg-ember-400/10 scale-110'
                : 'border-gold-400/30 bg-gold-400/5 scale-100'
            }`}
            style={{
              transform: `scale(${1 + holdProgress * 0.15})`,
              opacity: 0.6 + holdProgress * 0.4,
            }}
          />
          <button
            onMouseDown={onPressStart}
            onMouseUp={onPressEnd}
            onMouseLeave={onPressEnd}
            onTouchStart={(e) => { e.preventDefault(); onPressStart() }}
            onTouchEnd={(e) => { e.preventDefault(); onPressEnd() }}
            className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-150 active:scale-95 select-none touch-none
              ${phase === 'recording'
                ? 'bg-ember-500 glow-ember shadow-lg'
                : 'bg-gold-400 glow-gold shadow-lg'
              }`}
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            {phase === 'recording'
              ? <Square className="w-5 h-5 text-ink-900" fill="currentColor" />
              : <Mic className="w-5 h-5 text-ink-900" />
            }
          </button>
        </div>
      ) : (
        /* Post-recording controls: retake · play/pause · submit */
        <div className="flex items-center gap-4">
          {/* Retake */}
          <button
            onClick={retake}
            className="w-11 h-11 rounded-full bg-ink-700 border border-ink-600 flex items-center justify-center
              hover:bg-ink-600 transition-colors active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-ink-200" />
          </button>

          {/* Play / pause */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-ink-700 border border-ink-600 flex items-center justify-center
              hover:bg-ink-600 transition-colors active:scale-95"
          >
            {phase === 'playing'
              ? <Pause className="w-5 h-5 text-ink-50" fill="currentColor" />
              : <Play  className="w-5 h-5 text-ink-50 ml-0.5" fill="currentColor" />
            }
          </button>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={phase === 'submitting'}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gold-400 text-ink-900
              font-semibold text-sm glow-sm-gold transition-all duration-150 active:scale-95
              disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gold-300"
          >
            {phase === 'submitting' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-ink-900/30 border-t-ink-900 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" strokeWidth={2.5} />
                Arm {sym}{stakeAmount}
              </>
            )}
          </button>
        </div>
      )}

      {/* Stake reminder */}
      {phase === 'idle' && (
        <p className="text-2xs text-ink-400 text-center max-w-xs leading-relaxed">
          Your {sym}{stakeAmount} stake is live. Recording arms your day.
          Skip this and it's forfeited.
        </p>
      )}

      {/* Upload error */}
      {submitError && (
        <p className="text-2xs text-ember-400 text-center max-w-xs leading-relaxed">
          {submitError}
        </p>
      )}
    </div>
  )
}
