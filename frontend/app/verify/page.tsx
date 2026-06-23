'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'
import api, { paymentsApi } from '@/lib/api'
import { Leaf, CheckCircle2, XCircle, ArrowRight, Users } from 'lucide-react'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const verifyMagicLink = useAuthStore((state) => state.verifyMagicLink)
  const setUser = useAuthStore((state) => state.setUser)
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState<'verifying' | 'success' | 'coach_consent' | 'error'>('verifying')
  const [error, setError] = useState('')
  const [coachAction, setCoachAction] = useState<'idle' | 'loading'>('idle')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('No verification token found in URL')
      return
    }
    const promo = searchParams.get('promo')
    const plan = searchParams.get('plan')
    verifyMagicLink(token)
      .then(async () => {
        const authUser = useAuthStore.getState().user

        // Existing user with a pending coach invite — ask before linking
        if (authUser?.pendingCoachId) {
          setStatus('coach_consent')
          return
        }

        setStatus('success')
        if (authUser?.isOnboarded) {
          setTimeout(() => router.push(postLoginDestination(authUser)), 2000)
          return
        }
        if (plan) {
          try {
            const session = await paymentsApi.createCheckoutSession(plan, promo ?? undefined)
            window.location.href = session.url
          } catch {
            router.push(promo ? `/pricing?promo=${promo}` : '/pricing')
          }
          return
        }
        setTimeout(() => router.push(promo ? `/pricing?promo=${promo}` : '/pricing'), 2000)
      })
      .catch((err: any) => {
        setStatus('error')
        setError(err.message || 'Invalid or expired link')
      })
  }, [searchParams, verifyMagicLink, router])

  const handleAcceptCoach = async () => {
    setCoachAction('loading')
    try {
      const updated = await api.users.acceptCoachInvite()
      setUser(updated)
      setStatus('success')
      setTimeout(() => router.push(postLoginDestination(updated)), 1500)
    } catch {
      setCoachAction('idle')
    }
  }

  const handleDeclineCoach = async () => {
    setCoachAction('loading')
    try {
      await api.users.leaveCoach()
      const authUser = useAuthStore.getState().user
      if (authUser) setUser({ ...authUser, pendingCoachId: null })
      setStatus('success')
      setTimeout(() => router.push(authUser ? postLoginDestination(authUser) : '/home'), 1500)
    } catch {
      setCoachAction('idle')
    }
  }

  return (
    <div className="min-h-screen bg-background mesh-bg flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center glow-sm">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-gradient">Ivy</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/30 text-center">
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Verifying your link</h2>
              <p className="text-sm text-muted-foreground">Please wait a moment…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Welcome back!</h2>
              {user && (
                <p className="text-sm text-muted-foreground mb-1">
                  Signed in as <strong className="text-foreground">{user.firstName}</strong>
                </p>
              )}
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {searchParams.get('plan') && !useAuthStore.getState().user?.isOnboarded
                  ? 'Taking you to checkout…'
                  : 'Redirecting you now…'}
              </p>
            </>
          )}

          {status === 'coach_consent' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">You've been invited</h2>
              <p className="text-sm text-muted-foreground mb-1">
                <strong className="text-foreground">
                  {user?.pendingCoach?.coachProfile?.brandName
                    ?? user?.pendingCoach?.firstName
                    ?? 'A coach'}
                </strong>
                {' '}has invited you to join their accountability programme
                {user?.pendingCoach?.coachProfile?.programmeName
                  ? ` — ${user.pendingCoach.coachProfile.programmeName}`
                  : ''}.
              </p>
              <p className="text-xs text-muted-foreground mt-2 mb-6">
                Ivy will run your daily accountability calls as part of their programme.
                You can leave at any time from your settings.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  disabled={coachAction === 'loading'}
                  onClick={handleAcceptCoach}
                >
                  {coachAction === 'loading'
                    ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <>Join programme <ArrowRight className="w-4 h-4 ml-1.5" /></>}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  disabled={coachAction === 'loading'}
                  onClick={handleDeclineCoach}
                >
                  Decline
                </Button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Verification failed</h2>
              <p className="text-sm text-destructive mb-1">{error}</p>
              <p className="text-xs text-muted-foreground mb-6">Magic links expire after 15 minutes</p>
              <Link href="/login">
                <Button className="w-full">
                  Request a new link <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
