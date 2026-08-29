'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'coach_consent' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string>('')
  const [coachAction, setCoachAction] = useState<'idle' | 'loading'>('idle')
  const [pendingCoachName, setPendingCoachName] = useState<string | null>(null)
  const { setUser, setToken } = useAuthStore()

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setError('No verification token found')
        return
      }

      try {
        const { accessToken, user } = await authApi.verifyMagicLink(token)
        setToken(accessToken)

        // Coach intent from /signup?as=coach: when the account already existed,
        // signup couldn't set role — the flag carries the intent across the
        // magic-link round-trip and the server applies it only to stranded
        // half-signups (role 'user', FREE, not onboarded).
        let authedUser = user
        if (typeof window !== 'undefined' && window.localStorage.getItem('ivy_coach_intent') === '1') {
          window.localStorage.removeItem('ivy_coach_intent')
          if (user.role === 'user' && user.subscriptionTier === 'FREE' && !user.isOnboarded) {
            try {
              await usersApi.updateProfile({ role: 'coach' } as any)
              authedUser = { ...user, role: 'coach' as const }
            } catch { /* non-fatal — they can restart from /for-coaches */ }
          }
        }

        setUser(authedUser)

        // An EXISTING account invited by a coach carries pendingCoachId — the
        // link is proposed, not applied. This page never asked, so an invited
        // member sailed past it and stayed unlinked; the only way to accept was
        // to find it buried in Settings. (Brand-new invitees are linked at
        // creation, which is why this only bit people who already had Ivy.)
        if (authedUser?.pendingCoachId) {
          setPendingCoachName(
            (authedUser as { pendingCoach?: { firstName?: string } }).pendingCoach?.firstName ?? null
          )
          setStatus('coach_consent')
          return
        }

        setStatus('success')

        // postLoginDestination is the single source of truth for post-auth
        // routing (coach funnel, consumer onboarding, B2B) — never fork it here.
        setTimeout(() => router.push(postLoginDestination(authedUser)), 1000)
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'Failed to verify magic link')
      }
    }

    verifyToken()
  }, [searchParams, router, setUser, setToken])

  const handleAcceptCoach = async () => {
    setCoachAction('loading')
    try {
      const updated = await usersApi.acceptCoachInvite()
      setUser(updated)
      setStatus('success')
      setTimeout(() => router.push(postLoginDestination(updated)), 1200)
    } catch {
      setCoachAction('idle')
    }
  }

  const handleDeclineCoach = async () => {
    setCoachAction('loading')
    try {
      await usersApi.leaveCoach()
      const current = useAuthStore.getState().user
      if (current) setUser({ ...current, pendingCoachId: null })
      setStatus('success')
      setTimeout(() => router.push(current ? postLoginDestination(current) : '/home'), 1200)
    } catch {
      setCoachAction('idle')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl" />
          </div>

          {status === 'verifying' && (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Verifying...</h1>
              <p className="text-muted-foreground">Please wait while we log you in</p>
            </div>
          )}

          {status === 'coach_consent' && (
            <div className="text-left">
              <h1 className="text-2xl font-bold mb-2 text-center">One thing first</h1>
              <p className="text-sm text-muted-foreground mb-2">
                <strong className="text-foreground">{pendingCoachName ?? 'A coach'}</strong>{' '}
                has invited you to join their accountability programme.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Ivy will run your daily accountability as part of their programme, and what she sees
                gets back to them. You can leave any time from Settings.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  disabled={coachAction === 'loading'}
                  onClick={handleAcceptCoach}
                  className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {coachAction === 'loading' ? 'One moment…' : 'Join their programme'}
                </button>
                <button
                  disabled={coachAction === 'loading'}
                  onClick={handleDeclineCoach}
                  className="w-full text-muted-foreground px-6 py-2 rounded-lg hover:bg-muted transition disabled:opacity-60"
                >
                  No thanks — carry on solo
                </button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-green-600">Success!</h1>
              <p className="text-muted-foreground">Redirecting...</p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-red-600">Verification Failed</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <button
                onClick={() => router.push('/login')}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyMagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
