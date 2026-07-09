'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ConsumerOnboardingScreen } from '@/components/onboarding-consumer/ConsumerOnboardingScreen'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'

export default function ConsumerOnboardingPage() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  // Coaches must never fall into consumer onboarding (stake pitch, seasons,
  // circles — all wrong for them). Send them down their own funnel instead.
  const isCoach = !!user && (user.role === 'coach' || user.subscriptionTier === 'COACH')

  useEffect(() => {
    if (!isLoading && isCoach) {
      router.replace(postLoginDestination(user!))
    }
  }, [isLoading, isCoach, user, router])

  if (isCoach) return null

  return (
    <div className="theme-vine min-h-[100dvh]">
      <ConsumerOnboardingScreen />
    </div>
  )
}
