'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

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
        setUser(user)
        setStatus('success')

        // Route based on tier and onboarding state
        let destination = '/dashboard'
        if (user.subscriptionTier === 'COACH') {
          destination = user.isOnboarded ? '/coach' : '/coach/settings'
        } else if (!user.isOnboarded) {
          destination = `/onboard/${user.subscriptionTier === 'B2B' ? 'welcome' : 'welcome'}`
        }
        setTimeout(() => router.push(destination), 1000)
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
