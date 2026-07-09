'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'
import { CoachNav } from '@/components/layout/CoachNav'

/**
 * Gate for the coach console (/coach, /coach/clients, /coach/settings).
 * Requires an ACTIVE coach plan (tier COACH). A coach-intent signup that
 * hasn't activated yet (role='coach', tier FREE) belongs on /coach/join —
 * which lives OUTSIDE this route group precisely so this gate can't lock
 * them out of their own activation page.
 */
export default function CoachConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.subscriptionTier !== 'COACH') {
      // Not-yet-activated coach → activation; everyone else → their own home.
      router.push(user.role === 'coach' ? '/coach/join' : postLoginDestination(user))
    }
  }, [user, isLoading, router])

  // While auth is loading, or user is being redirected, show nothing
  if (isLoading || !user || user.subscriptionTier !== 'COACH') {
    return null
  }

  return (
    <div className="theme-vine min-h-[100dvh] pb-20">
      {children}
      <CoachNav />
    </div>
  )
}
