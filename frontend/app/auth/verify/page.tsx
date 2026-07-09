'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string>('')
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
