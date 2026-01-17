'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store/auth.store'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verifyMagicLink = useAuthStore((state) => state.verifyMagicLink)
  const user = useAuthStore((state) => state.user)

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setError('No verification token found')
      return
    }

    const verify = async () => {
      try {
        await verifyMagicLink(token)
        setStatus('success')

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'Invalid or expired link')
      }
    }

    verify()
  }, [searchParams, verifyMagicLink, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary rounded-lg"></div>
          <span className="text-2xl font-bold">Ivy</span>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {status === 'verifying' && 'Verifying...'}
              {status === 'success' && 'Welcome back!'}
              {status === 'error' && 'Verification failed'}
            </CardTitle>
            <CardDescription className="text-center">
              {status === 'verifying' && 'Please wait while we verify your magic link'}
              {status === 'success' && 'Redirecting you to your dashboard...'}
              {status === 'error' && 'Something went wrong with your magic link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'verifying' && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 text-green-900 p-6 rounded-md text-center">
                  <div className="flex justify-center mb-3">
                    <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-lg mb-2">Successfully signed in!</p>
                  {user && (
                    <p className="text-sm">
                      Welcome back, <strong>{user.firstName}</strong>
                    </p>
                  )}
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  <p>Redirecting you to your dashboard...</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-destructive/10 text-destructive p-6 rounded-md text-center">
                  <div className="flex justify-center mb-3">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-lg mb-2">Verification failed</p>
                  <p className="text-sm">{error}</p>
                </div>

                <div className="text-sm text-muted-foreground text-center space-y-2">
                  <p>Your magic link may have expired or is invalid</p>
                  <p>Magic links expire after 15 minutes</p>
                </div>

                <Link href="/login" className="block">
                  <Button className="w-full">
                    Request a new magic link
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
