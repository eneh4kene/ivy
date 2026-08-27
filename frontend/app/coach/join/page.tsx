'use client'

/**
 * /coach/join — coach plan activation. The bridge between a coach-intent
 * signup (role='coach', tier still FREE) and the coach console: recap the
 * deal, take the £79/mo checkout, then wait for the subscription webhook to
 * flip the tier to COACH and move on to setup.
 *
 * The tier flip is asynchronous (Stripe webhook), so after checkout returns
 * we poll the user until the tier lands — never leave a paying coach staring
 * at a page that pretends nothing happened.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, PhoneCall, Bell, Link2, Loader2 } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'
import { paymentsApi, coachApi } from '@/lib/api'

const DEAL = [
  { icon: Bell, text: 'Slip alerts before clients ghost you' },
  { icon: PhoneCall, text: 'Biweekly ponder calls — adjust programmes by voice' },
  { icon: Link2, text: 'Your invite link · unlimited clients · they pay their own way' },
]

function CoachJoinInner() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  // "Try it first" — a coach cannot sell what they have never felt, and asking
  // for £79 before showing anything is what stranded our first coach signup.
  const [trialPhone, setTrialPhone] = useState('')
  const [trialState, setTrialState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [trialError, setTrialError] = useState('')

  const startTrialCall = useCallback(async () => {
    setTrialError('')
    const cleaned = trialPhone.trim().replace(/\s/g, '')
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      setTrialError('Use international format, e.g. +447700900123')
      return
    }
    setTrialState('sending')
    try {
      await coachApi.trialCall(cleaned)
      setTrialState('sent')
    } catch (err: any) {
      setTrialError(err?.message ?? "Couldn't place the call — try again.")
      setTrialState('idle')
    }
  }, [trialPhone])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const polls = useRef(0)

  // Already a coach → onward. Poll while we expect the webhook to land.
  const checkTier = useCallback(async () => {
    await fetchUser().catch(() => {})
  }, [fetchUser])

  useEffect(() => {
    if (user?.subscriptionTier === 'COACH') {
      router.replace(user.isOnboarded ? '/coach' : '/coach/settings')
    } else if (user && user.role !== 'coach') {
      // Consumers have no business on the coach activation page.
      router.replace(postLoginDestination(user))
    }
  }, [user, router])

  useEffect(() => {
    if (!waiting) return
    const id = setInterval(() => {
      polls.current += 1
      if (polls.current > 20) { setWaiting(false); clearInterval(id); return }
      checkTier()
    }, 2500)
    return () => clearInterval(id)
  }, [waiting, checkTier])

  // Returning from Stripe (success page routes back here while tier is still
  // flipping) → go straight into waiting mode.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === 'checkout') {
      setWaiting(true)
    }
  }, [])

  const activate = async () => {
    setStarting(true)
    setError('')
    try {
      // The promo arrives on /signup?as=coach&promo=… but the magic-link round
      // trip loses the query string, so signup stashes it. Without this a coach
      // meets the full £79 and has to know to type a code nobody told them about.
      const promo = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('promo') ?? window.localStorage.getItem('ivy_promo') ?? undefined)
        : undefined
      const { url } = await paymentsApi.createCoachCheckoutSession(user?.currency ?? 'GBP', promo || undefined)
      if (url) {
        window.location.href = url
        return
      }
      // Already subscribed server-side → poll for the tier.
      setWaiting(true)
    } catch (err: any) {
      setError(err.message ?? "Couldn't start checkout — try again.")
    } finally {
      setStarting(false)
    }
  }

  const s = (user?.currency ?? 'GBP') === 'USD' ? '$99' : '£79'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.24em] text-ink-400 mb-2">
            Coach account · one step left
          </p>
          <h1 className="font-display text-3xl text-ink-50 tracking-tight">
            Activate your coach plan
          </h1>
          <p className="mt-3 text-sm text-ink-400 leading-relaxed">
            {user?.firstName ? `${user.firstName}, this` : 'This'} unlocks your console, your invite
            link, and Ivy working your clients every day.
          </p>
        </div>

        <div className="surface border-gold-400/25 rounded-2xl p-5 space-y-3.5">
          {DEAL.map((d) => (
            <div key={d.text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gold-400/10 flex items-center justify-center shrink-0">
                <d.icon className="w-4 h-4 text-gold-300" />
              </div>
              <p className="text-sm text-ink-200">{d.text}</p>
            </div>
          ))}
        </div>


        {/* Experience before price. Deliberately above the CTA. */}
        <div className="surface border-ink-700 rounded-2xl p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-50">Hear it before you buy it</p>
            <p className="mt-1 text-xs text-ink-400 leading-relaxed">
              Ivy will ring you right now and run the call exactly as she&apos;d run it with one of
              your clients. No card needed.
            </p>
          </div>
          {trialState === 'sent' ? (
            <p className="text-xs text-sage-400">
              Calling you now — answer and talk to her like a client would.
            </p>
          ) : (
            <>
              <input
                type="tel"
                inputMode="tel"
                placeholder="+44 7700 900123"
                value={trialPhone}
                onChange={(e) => setTrialPhone(e.target.value)}
                disabled={trialState === 'sending'}
                className="w-full h-11 rounded-lg border border-ink-700 bg-ink-900/60 px-3 text-sm text-ink-50 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40"
              />
              <button
                onClick={startTrialCall}
                disabled={trialState === 'sending' || !trialPhone}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gold-400/40 text-gold-300 font-medium text-sm hover:bg-gold-400/10 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {trialState === 'sending'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Ringing you…</>
                  : <><PhoneCall className="w-4 h-4" /> Call me as a client</>}
              </button>
            </>
          )}
          {trialError && <p className="text-xs text-ember-400">{trialError}</p>}
        </div>

        {waiting ? (
          <div className="flex items-center justify-center gap-3 py-4 font-mono text-xs uppercase tracking-[0.2em] text-gold-300">
            <Loader2 className="w-4 h-4 animate-spin" /> Confirming your plan…
          </div>
        ) : (
          <button
            onClick={activate}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm hover:bg-gold-300 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate — {s}/month <ArrowRight className="w-4 h-4" /></>}
          </button>
        )}

        {error && <p className="text-center text-xs text-ember-400">{error}</p>}

        <p className="text-center text-2xs text-ink-500">
          Flat fee, unlimited clients. Cancel any time — your clients keep their own accounts.
        </p>
      </div>
    </div>
  )
}

export default function CoachJoinPage() {
  return (
    <ProtectedRoute>
      <div className="theme-vine min-h-dvh">
        <CoachJoinInner />
      </div>
    </ProtectedRoute>
  )
}
