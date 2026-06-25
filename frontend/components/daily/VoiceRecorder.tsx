'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Pause, RotateCcw, Check } from 'lucide-react'
import type { VoiceNote } from './types'
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
              className="inline-block w-[3px] rounded-full bg-[#ff3b78] origin-center shadow-[0_0_6px_rgba(255,59,120,.6)]"
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
              isFilled ? 'bg-[#27e8ff] shadow-[0_0_6px_rgba(39,232,255,.6)]' : 'bg-white/10'
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
  /** Fires true when recording starts, false when it stops. */
  onRecordingChange?: (recording: boolean) => void
  /** Live mic level 0..1 (RMS, smoothed) while recording — drives the LivingForm bloom. */
  onLevel?: (level: number) => void
}

export function VoiceRecorder({ onSubmit, prompt, stakeAmount, currency, onRecordingChange, onLevel }: VoiceRecorderProps) {
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
  // Live mic-level analysis (feeds onLevel → LivingForm bloom)
  const audioCtx        = useRef<AudioContext | null>(null)
  const analyser        = useRef<AnalyserNode | null>(null)
  const levelRaf        = useRef<number | null>(null)

  // Tear down the WebAudio analysis graph and stop emitting level.
  const stopLevelMeter = useCallback(() => {
    if (levelRaf.current) { cancelAnimationFrame(levelRaf.current); levelRaf.current = null }
    analyser.current = null
    if (audioCtx.current) { audioCtx.current.close().catch(() => {}); audioCtx.current = null }
    onLevel?.(0)
  }, [onLevel])

  const sym = currency === 'GBP' ? '£' : '$'

  // ── Real MediaRecorder-based recording ──
  const startRecording = useCallback(async () => {
    setPhase('recording')
    setRecordSecs(0)
    audioChunks.current = []
    audioBlob.current = null
    onRecordingChange?.(true)

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

      // ── Live level meter: RMS → smoothed 0..1, emitted via onLevel ──
      if (onLevel) {
        try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext
          const ctx = new Ctx()
          audioCtx.current = ctx
          const src = ctx.createMediaStreamSource(stream)
          const node = ctx.createAnalyser()
          node.fftSize = 512
          node.smoothingTimeConstant = 0.6
          src.connect(node)
          analyser.current = node
          const buf = new Uint8Array(node.fftSize)
          let smoothed = 0
          const tick = () => {
            if (!analyser.current) return
            analyser.current.getByteTimeDomainData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128
              sum += v * v
            }
            const rms = Math.sqrt(sum / buf.length)          // ~0..0.5 for speech
            const level = Math.min(1, rms * 3.2)             // normalise into 0..1
            smoothed += (level - smoothed) * 0.35            // gentle attack/decay
            onLevel(smoothed)
            levelRaf.current = requestAnimationFrame(tick)
          }
          levelRaf.current = requestAnimationFrame(tick)
        } catch {
          // WebAudio unavailable — recorder still works, bloom just won't react.
        }
      }
    } catch {
      // Mic permission denied or not available — fall back to timer-only mode
      // (the blob will be null and submit will handle gracefully)
    }

    timerRef.current = setInterval(() => {
      setRecordSecs((s) => s + 1)
    }, 1000)
  }, [onRecordingChange, onLevel])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    stopLevelMeter()
    onRecordingChange?.(false)
    setPhase('recorded')
    setTotalSecs(recordSeconds)
    setPlaySecs(0)
  }, [recordSeconds, stopLevelMeter, onRecordingChange])

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
    if (levelRaf.current)       cancelAnimationFrame(levelRaf.current)
    audioCtx.current?.close().catch(() => {})
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
        <div className="w-16 h-16 rounded-full bg-[#c6ff44]/12 border border-[#c6ff44]/40 flex items-center justify-center shadow-[0_0_28px_rgba(198,255,68,.4)]">
          <Check className="w-7 h-7 text-neon-lime" strokeWidth={2.5} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-xl font-semibold uppercase tracking-tight text-white">Armed for the day</p>
          <p className="text-sm text-white/50">
            <span className="text-neon-lime led font-semibold">{sym}{stakeAmount}</span> secured · Ivy has your commitment
          </p>
        </div>
      </div>
    )
  }

  /* ── Main recorder UI ── */
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto py-4">
      {/* Prompt text */}
      <p className="text-lg text-white/85 text-center leading-snug px-2">
        {prompt}
      </p>

      {/* Waveform area */}
      <div className="w-full px-4">
        {phase === 'idle' ? (
          <div className="h-12 flex items-center justify-center">
            <p className="text-white/40 text-2xs uppercase tracking-[0.2em]">Press and hold the mic to record</p>
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
          <span className="font-mono text-sm text-neon-mag tabular-nums led uppercase tracking-wider">
            {formatTime(recordSeconds)} · rec
          </span>
        )}
        {(phase === 'recorded' || phase === 'playing') && (
          <span className="font-mono text-sm text-white/50 tabular-nums led">
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
            <span className="absolute w-24 h-24 rounded-full border-2 border-[#27e8ff]/50 animate-record-ring" />
          )}
          {/* Outer glow ring */}
          <span
            className={`absolute w-20 h-20 rounded-full border transition-all duration-200 ${
              phase === 'recording'
                ? 'border-[#ff3b78]/60 bg-[#ff3b78]/10 scale-110'
                : 'border-[#27e8ff]/40 bg-[#27e8ff]/5 scale-100'
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
                ? 'bg-[#ff3b78] shadow-[0_0_28px_rgba(255,59,120,.6)]'
                : 'bg-[#27e8ff] shadow-[0_0_28px_rgba(39,232,255,.6)]'
              }`}
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            {phase === 'recording'
              ? <Square className="w-5 h-5 text-[#04050a]" fill="currentColor" />
              : <Mic className="w-5 h-5 text-[#04050a]" />
            }
          </button>
        </div>
      ) : (
        /* Post-recording controls: retake · play/pause · submit */
        <div className="flex items-center gap-4">
          {/* Retake */}
          <button
            onClick={retake}
            className="w-11 h-11 rounded-full glass-arcade flex items-center justify-center
              hover:bg-white/[0.08] transition-colors active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-white/70" />
          </button>

          {/* Play / pause */}
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full glass-arcade panel-cyan flex items-center justify-center
              hover:bg-white/[0.08] transition-colors active:scale-95"
          >
            {phase === 'playing'
              ? <Pause className="w-5 h-5 text-neon-cyan" fill="currentColor" />
              : <Play  className="w-5 h-5 text-neon-cyan ml-0.5" fill="currentColor" />
            }
          </button>

          {/* Submit */}
          <button
            onClick={submit}
            disabled={phase === 'submitting'}
            className="relative overflow-hidden flex items-center gap-2 px-5 py-3 rounded-2xl btn-arcade-lime
              text-sm uppercase transition-all duration-150 active:scale-95
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {phase === 'submitting' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-[#04050a]/30 border-t-[#04050a] animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <span className="arcade-sheen" />
                <Check className="w-4 h-4" strokeWidth={2.5} />
                Arm {sym}{stakeAmount}
              </>
            )}
          </button>
        </div>
      )}

      {/* Stake reminder */}
      {phase === 'idle' && (
        <p className="text-2xs text-white/45 text-center max-w-xs leading-relaxed">
          Your <span className="text-neon-cyan led">{sym}{stakeAmount}</span> stake is live. Recording arms your day.
          Skip this and it&apos;s forfeited.
        </p>
      )}

      {/* Upload error */}
      {submitError && (
        <p className="text-2xs text-neon-mag text-center max-w-xs leading-relaxed">
          {submitError}
        </p>
      )}
    </div>
  )
}
