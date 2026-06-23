'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'

function CheckoutSuccessContent() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(4)
  const fetchUser = useAuthStore((state) => state.fetchUser)

  // Where this user belongs next depends on their actual state — an already
  // onboarded user who just paid during stake-setup must NOT be bounced back
  // into onboarding. postLoginDestination is the single source of truth.
  function go() {
    const user = useAuthStore.getState().user
    router.push(user ? postLoginDestination(user) : '/home')
  }

  useEffect(() => {
    // Refresh the user so subscriptionTier/isOnboarded reflect the new payment
    // before we decide where to send them.
    fetchUser().catch(() => {})

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          go()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <Logo size={56} className="glow-gold" />
        </div>

        <div className="mx-auto w-16 h-16 rounded-full bg-sage-400/10 border border-sage-400/20 flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-sage-400" strokeWidth={2.5} />
        </div>

        <h1 className="font-display text-2xl text-ink-50 tracking-tight">You&apos;re in.</h1>
        <p className="mt-3 text-sm text-ink-400 leading-relaxed">
          Payment confirmed. Next: set your weekly stake and arm your first day —
          that&apos;s where Ivy gets its teeth.
        </p>

        <button
          onClick={go}
          className="mt-8 w-full py-3.5 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm hover:bg-gold-300 transition-colors flex items-center justify-center gap-2"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-3 text-xs text-ink-400">Taking you there in {countdown}…</p>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-400" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
