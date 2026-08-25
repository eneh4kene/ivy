'use client'

/**
 * ConsumerOnboardingScreen — the consumer signup flow (post-checkout).
 *
 * Steps: welcome → track → channel (+ phone) → marks user onboarded →
 * hands off to StakeSetupScreen.
 *
 * Track/channel copy is static config from lib/mock/onboarding.ts. The flow
 * persists track + commStyle + phone via usersApi.updateProfile, then calls
 * markAsOnboarded (backend requires a phone) and refreshes the auth store so
 * the user isn't bounced back into onboarding.
 * Follows §1d (channel preference), §5b (one plan) from product-pricing-rework.md.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Mic, MessageSquare, Shuffle, Phone, Loader2, ShieldCheck } from 'lucide-react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { Logo } from '@/components/brand/Logo'
import { checkPhone, normalizePhone } from '@/lib/phone'
import {
  TRACK_OPTIONS,
  CHANNEL_OPTIONS,
  DEFAULT_ONBOARDING_STATE,
  type OnboardingTrack,
  type ChannelPreference,
  type ConsumerOnboardingStep,
  type OnboardingState,
} from '@/lib/mock/onboarding'

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS: ConsumerOnboardingStep[] = ['welcome', 'track', 'channel']
const STEP_LABELS: Record<ConsumerOnboardingStep, string> = {
  welcome: 'Welcome',
  track: 'Your focus',
  channel: 'How Ivy reaches you',
  'stake-setup': 'Set your stake',
}

function ProgressBar({ step }: { step: ConsumerOnboardingStep }) {
  const idx = STEPS.indexOf(step)
  const total = STEPS.length
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 0

  return (
    <div className="relative h-0.5 bg-ink-700 rounded-full overflow-visible">
      <div
        className="absolute inset-y-0 left-0 bg-gold-400 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
      {/* Dots */}
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border transition-all duration-300 ${
            i <= idx ? 'bg-gold-400 border-gold-400' : 'bg-ink-800 border-ink-600'
          }`}
          style={{ left: `calc(${(i / (total - 1)) * 100}% - 4px)` }}
        />
      ))}
    </div>
  )
}

// ─── Shared button ────────────────────────────────────────────────────────────

function PrimaryButton({
  onClick,
  disabled = false,
  children,
  className = '',
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-2xl font-semibold text-base text-ink-900 transition-all active:scale-[0.98]
        ${disabled
          ? 'bg-ink-700 text-ink-600 cursor-not-allowed'
          : 'bg-gold-400 hover:bg-gold-300 glow-sm-gold'}
        ${className}`}
    >
      {children}
    </button>
  )
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl text-sm text-ink-400 hover:text-ink-200 transition-colors"
    >
      {children}
    </button>
  )
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const pillItems = [
    { label: 'Morning voice note', sub: 'Say it out loud. Arm your day.', color: 'text-gold-400', bg: 'bg-gold-400/08 border-gold-400/15' },
    { label: 'Evening review', sub: 'Ivy replays your words. Settles the score.', color: 'text-sage-400', bg: 'bg-sage-400/08 border-sage-400/15' },
    { label: 'Stake on the line', sub: 'Your £. Follow through — or it goes somewhere you\'d hate.', color: 'text-ember-400', bg: 'bg-ember-400/08 border-ember-400/15' },
    { label: 'Circle & games', sub: '5-person cohort. Social teeth.', color: 'text-periwinkle-400', bg: 'bg-periwinkle-400/08 border-periwinkle-400/15' },
  ]

  return (
    <div className="flex flex-col flex-1 px-4 pt-6 pb-6 animate-fade-in">
      {/* Wordmark */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo size={64} className="glow-gold" />
        </div>
        <h1 className="font-display text-3xl text-ink-50 tracking-tight leading-snug">
          Accountability<br />
          <em className="text-gradient-gold not-italic">that has teeth.</em>
        </h1>
        <p className="mt-3 text-sm text-ink-400 leading-relaxed max-w-xs mx-auto">
          Your money on the line. Your commitment, out loud. Every day.
        </p>
      </div>

      {/* The four pillars */}
      <div className="space-y-2.5 mb-8">
        {pillItems.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border ${item.bg}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`w-1.5 mt-1.5 h-1.5 rounded-full shrink-0 ${item.color.replace('text-', 'bg-')}`} />
            <div>
              <p className={`text-sm font-semibold ${item.color}`}>{item.label}</p>
              <p className="text-xs text-ink-400 mt-0.5 leading-snug">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 14-day trial pill */}
      <div className="glass rounded-xl px-4 py-3 text-center mb-6">
        <p className="text-xs text-ink-400">
          <span className="text-gold-400 font-semibold">14-day free trial</span>
          {' · '}real system from day one
          {' · '}cancel anytime
        </p>
      </div>

      <div className="mt-auto space-y-2.5">
        <PrimaryButton onClick={onNext}>
          Get started <ArrowRight className="inline-block ml-2 w-4 h-4" />
        </PrimaryButton>
        <Link href="/pricing" className="block">
          <GhostButton onClick={() => {}}>See what's included</GhostButton>
        </Link>
      </div>
    </div>
  )
}

// ─── Step 2: Track selection ──────────────────────────────────────────────────

function TrackStep({
  value,
  onChange,
  onNext,
}: {
  value: OnboardingTrack | null
  onChange: (t: OnboardingTrack) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-col flex-1 px-4 pt-2 pb-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-ink-50">What are you building?</h2>
        <p className="text-sm text-ink-400 mt-1.5 leading-snug">
          Pick the track that names your commitment. You can change it later.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {TRACK_OPTIONS.map((track) => {
          const selected = value === track.id
          return (
            <button
              key={track.id}
              onClick={() => onChange(track.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                selected
                  ? 'border-gold-400/50 bg-gold-400/06 glow-sm-gold'
                  : 'border-ink-600 bg-ink-800/60 hover:border-ink-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{track.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm ${selected ? 'text-gold-300' : 'text-ink-50'}`}>
                      {track.label}
                    </p>
                    <p className={`text-xs font-medium ${selected ? 'text-gold-400' : 'text-ink-400'}`}>
                      — {track.headline}
                    </p>
                  </div>
                  <p className="text-xs text-ink-400 mt-1 leading-snug">{track.description}</p>
                  <p className="text-2xs text-ink-600 mt-1.5 italic font-mono">{track.exampleCommit}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    selected ? 'bg-gold-400 border-gold-400' : 'border-ink-600'
                  }`}
                >
                  {selected && <Check className="w-3 h-3 text-ink-900" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-auto">
        <PrimaryButton onClick={onNext} disabled={!value}>
          Continue <ArrowRight className="inline-block ml-2 w-4 h-4" />
        </PrimaryButton>
      </div>
    </div>
  )
}

// ─── Step 3: Channel preference ───────────────────────────────────────────────

const CHANNEL_ICONS: Record<ChannelPreference, React.ReactNode> = {
  CALLS: <Mic className="w-5 h-5" />,
  TEXTS: <MessageSquare className="w-5 h-5" />,
  ADAPTIVE: <Shuffle className="w-5 h-5" />,
}

const CHANNEL_COLORS: Record<ChannelPreference, { selected: string; dot: string }> = {
  CALLS:    { selected: 'border-gold-400/50 bg-gold-400/06',        dot: 'bg-gold-400' },
  TEXTS:    { selected: 'border-periwinkle-400/50 bg-periwinkle-400/06', dot: 'bg-periwinkle-400' },
  ADAPTIVE: { selected: 'border-sage-400/50 bg-sage-400/06',        dot: 'bg-sage-400' },
}

function ChannelStep({
  value,
  onChange,
  phone,
  onPhoneChange,
  verifiedPhone,
  onNext,
  submitting,
  error,
}: {
  value: ChannelPreference | null
  onChange: (c: ChannelPreference) => void
  phone: string
  onPhoneChange: (p: string) => void
  verifiedPhone: string | null
  onNext: () => void
  submitting: boolean
  error: string | null
}) {
  // Phase "enter": pick channel + type number. Phase "code": confirm the OTP
  // OTP. We verify the number through the same backend endpoints settings uses,
  // so onboarding can't save an unverified (typo'd / wrong-owner) phone.
  const [phase, setPhase] = useState<'enter' | 'code'>('enter')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)

  const phoneCheck = checkPhone(phone)
  const canSend = !!value && phoneCheck.valid && !sending

  const handleSend = async () => {
    setOtpError(null)
    const check = checkPhone(phone)
    if (!check.valid) { setOtpError(check.error || 'Enter a valid number with country code'); return }
    // Resumed onboarding: if this number is already verified on the account,
    // there's nothing to re-confirm — go straight on.
    if (verifiedPhone && normalizePhone(phone) === verifiedPhone) { onNext(); return }
    setSending(true)
    try {
      await usersApi.requestPhoneOtp(normalizePhone(phone))
      setCode('')
      setPhase('code')
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Couldn’t send the code. Try again.'
      // Backend says it's already this user's number → nothing to verify.
      if (/already your current number/i.test(msg)) { onNext(); return }
      setOtpError(msg)
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    if (code.length < 6) return
    setOtpError(null)
    setVerifying(true)
    try {
      // On success the backend sets+confirms the phone; onNext finishes onboarding.
      await usersApi.verifyPhoneOtp(code)
      onNext()
    } catch (e: any) {
      setOtpError(e?.response?.data?.error || e?.message || 'Incorrect code. Try again.')
      setVerifying(false)
    }
  }

  // ── Phase 2: enter the code ──────────────────────────────────────────────
  // US numbers receive it by VOICE, not SMS — A2P 10DLC is unregistered so US
  // carriers drop the text. Telling a US user to check their messages would
  // strand them staring at an inbox while the phone rings unanswered.
  if (phase === 'code') {
    return (
      <div className="flex flex-col flex-1 px-4 pt-2 pb-6 animate-fade-in">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gold-400/12 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-gold-400" />
          </div>
          <h2 className="font-display text-2xl text-ink-50">Confirm your number</h2>
          <p className="text-sm text-ink-400 mt-1.5 leading-snug">
            {normalizePhone(phone).startsWith('+1') ? (
              <>Ivy is <span className="text-ink-100 font-medium">calling {normalizePhone(phone)}</span> to
              read you a 6-digit code. Answer and jot it down.</>
            ) : (
              <>We sent a 6-digit code to <span className="text-ink-100 font-medium">{normalizePhone(phone)}</span>.
              Enter it to verify Ivy can reach you.</>
            )}
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className="w-full py-4 rounded-2xl bg-ink-800/60 border border-ink-600 text-ink-50 text-center text-2xl tracking-[0.5em] font-mono placeholder:text-ink-700 focus:outline-none focus:border-gold-400/60 transition-colors"
        />
        {otpError && <p className="text-2xs text-ember-400 mt-2 text-center leading-snug">{otpError}</p>}

        <div className="flex items-center justify-center gap-5 mt-4">
          <button
            type="button"
            onClick={() => { setPhase('enter'); setCode(''); setOtpError(null) }}
            className="text-xs text-ink-400 hover:text-ink-200 transition-colors"
          >
            ← Wrong number
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={handleSend}
            className="text-xs text-ink-400 hover:text-ink-200 transition-colors disabled:opacity-40"
          >
            {sending ? 'Sending…' : normalizePhone(phone).startsWith('+1') ? 'Call me again' : 'Resend code'}
          </button>
        </div>

        <div className="mt-auto pt-8">
          <PrimaryButton onClick={handleVerify} disabled={code.length < 6 || verifying}>
            {verifying ? <><Loader2 className="inline-block mr-2 w-4 h-4 animate-spin" /> Verifying…</>
              : <>Verify &amp; continue <ArrowRight className="inline-block ml-2 w-4 h-4" /></>}
          </PrimaryButton>
        </div>
      </div>
    )
  }

  // ── Phase 1: pick channel + enter number ─────────────────────────────────
  return (
    <div className="flex flex-col flex-1 px-4 pt-2 pb-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-ink-50">How does Ivy reach you?</h2>
        <p className="text-sm text-ink-400 mt-1.5 leading-snug">
          Voice or text — same price, same system. You can change this in settings.
        </p>
      </div>

      {/* Phone number — required for the daily check-ins */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-ink-200 uppercase tracking-wider">Your phone number</label>
        {/* Channel follows the number: US gets a voice call because A2P 10DLC is
            unregistered and US carriers drop the text. Promising a text we cannot
            deliver is how a US signup dies staring at an empty inbox. */}
        <p className="text-2xs text-ink-400 mt-1 mb-2 leading-snug">
          {normalizePhone(phone).startsWith('+1')
            ? 'Ivy calls you and reads out a code to confirm this number. Include your country code.'
            : 'Ivy texts a code to confirm this number. Include your country code.'}
        </p>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => { onPhoneChange(e.target.value); setOtpError(null) }}
            placeholder="+44 7700 900000"
            className={`w-full pl-10 pr-4 py-3.5 rounded-2xl bg-ink-800/60 border text-ink-50 text-sm placeholder:text-ink-600 focus:outline-none transition-colors ${
              phoneCheck.error ? 'border-ember-400/60 focus:border-ember-400/60' : 'border-ink-600 focus:border-gold-400/60'
            }`}
          />
        </div>
        {phoneCheck.error && (
          <p className="text-2xs text-ember-400 mt-1.5 leading-snug">{phoneCheck.error}</p>
        )}
      </div>

      {/* The morning VN note */}
      <div className="glass-gold rounded-xl p-3.5 mb-5 flex gap-2.5">
        <div className="w-1 rounded-full bg-gold-400 shrink-0" />
        <p className="text-xs text-ink-200 leading-relaxed">
          <span className="text-gold-400 font-semibold">Morning voice note is always spoken.</span>{' '}
          That&apos;s the commitment mechanic — not a channel. Everyone records it, regardless of this choice.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {CHANNEL_OPTIONS.map((ch) => {
          const selected = value === ch.id
          const colors = CHANNEL_COLORS[ch.id]
          return (
            <button
              key={ch.id}
              onClick={() => onChange(ch.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                selected ? colors.selected : 'border-ink-600 bg-ink-800/60 hover:border-ink-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? `${colors.dot.replace('bg-', 'bg-')}/15` : 'bg-ink-700'
                }`}>
                  <span className={selected ? colors.dot.replace('bg-', 'text-') : 'text-ink-400'}>
                    {CHANNEL_ICONS[ch.id]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`font-semibold text-sm ${selected ? 'text-ink-50' : 'text-ink-200'}`}>
                      {ch.headline}
                    </p>
                    {ch.id === 'CALLS' && (
                      <span className="text-2xs px-1.5 py-0.5 rounded-md bg-gold-400/12 text-gold-400 font-semibold uppercase tracking-wide">
                        recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5 leading-snug">{ch.description}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                    selected ? `${colors.dot} border-transparent` : 'border-ink-600'
                  }`}
                >
                  {selected && <Check className="w-3 h-3 text-ink-900" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-auto">
        {(otpError || error) && <p className="text-center text-xs text-ember-400 mb-2">{otpError || error}</p>}
        <PrimaryButton onClick={handleSend} disabled={!canSend || submitting}>
          {sending ? <><Loader2 className="inline-block mr-2 w-4 h-4 animate-spin" /> Sending code…</>
            : <>Send verification code <ArrowRight className="inline-block ml-2 w-4 h-4" /></>}
        </PrimaryButton>
        <p className="text-center text-2xs text-ink-600 mt-3">
          We&apos;ll text a code to confirm it&apos;s really you
        </p>
      </div>
    </div>
  )
}

// ─── Root orchestrator ────────────────────────────────────────────────────────

export function ConsumerOnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState<ConsumerOnboardingStep>('welcome')
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE)
  const storeUser = useAuthStore((s) => s.user)
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const [phone, setPhone] = useState(storeUser?.phone ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { height: viewportH } = useVisualViewport()

  const goBack = useCallback(() => {
    if (step === 'track') setStep('welcome')
    else if (step === 'channel') setStep('track')
  }, [step])

  // Persist track + channel, mark the user onboarded, refresh the store, then
  // hand off to stake setup. The phone is already set+verified via the OTP
  // step (so markAsOnboarded — which requires a phone — passes), no need to
  // resend it here.
  const completeOnboarding = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await usersApi.updateProfile({
        track: state.track ?? undefined,
        commStyle: (state.channelPreference ?? 'ADAPTIVE') as ChannelPreference,
      })
      await usersApi.markAsOnboarded()
      await fetchUser().catch(() => {})
      // Soft nav (not window.location) so the in-memory auth store survives —
      // a hard reload drops it and the /stake-setup gate bounces to /login
      // before the persisted store rehydrates.
      router.push('/stake-setup')
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save your details. Check the number and try again.")
      setSubmitting(false)
    }
  }, [submitting, state.track, state.channelPreference, phone, fetchUser, router])

  const stepIndex = STEPS.indexOf(step)
  const canGoBack = stepIndex > 0

  return (
    <div
      className="flex flex-col mesh-bg overflow-hidden relative"
      style={{ height: viewportH > 0 ? `${viewportH}px` : '100dvh' }}
    >
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(85,163,120,0.1) 0%, transparent 70%)' }}
      />

      {/* Top chrome */}
      <div className="shrink-0 safe-top">
        <div className="flex items-center gap-3 px-4 pt-3 pb-4">
          {canGoBack ? (
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}

          <div className="flex-1 px-2">
            {step !== 'welcome' && <ProgressBar step={step} />}
          </div>

          {step !== 'welcome' && (
            <p className="text-2xs text-ink-400 font-mono w-9 text-right">
              {stepIndex + 1}/{STEPS.length}
            </p>
          )}
          {step === 'welcome' && <div className="w-9 h-9" />}
        </div>
      </div>

      {/* Scrollable step content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
        <div key={step} className="flex flex-col flex-1">
          {step === 'welcome' && (
            <WelcomeStep onNext={() => setStep('track')} />
          )}
          {step === 'track' && (
            <TrackStep
              value={state.track}
              onChange={(t) => setState((s) => ({ ...s, track: t }))}
              onNext={() => setStep('channel')}
            />
          )}
          {step === 'channel' && (
            <ChannelStep
              value={state.channelPreference}
              onChange={(c) => setState((s) => ({ ...s, channelPreference: c }))}
              phone={phone}
              onPhoneChange={setPhone}
              verifiedPhone={storeUser?.phone ?? null}
              onNext={completeOnboarding}
              submitting={submitting}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  )
}
