'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'
import { CoachNav } from '@/components/layout/CoachNav'

/**
 * Gate for the coach console (/coach, /coach/clients, /coach/chat,
 * /coach/settings). Requires an ACTIVE coach plan (tier COACH). A coach-intent
 * signup that hasn't activated yet (role='coach', tier FREE) belongs on
 * /coach/join — which lives OUTSIDE this route group precisely so this gate
 * can't lock them out of their own activation page.
 */
export default function CoachConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  // On a hard reload (PWA cold start) the persisted store rehydrates AFTER
  // first render — gating on `user` before hydration bounced logged-in
  // coaches to /login. Same pattern as ProtectedRoute: wait for hydration.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) setHydrated(true)
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true))
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated || isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.subscriptionTier !== 'COACH') {
      // Not-yet-activated coach → activation; everyone else → their own home.
      router.push(user.role === 'coach' ? '/coach/join' : postLoginDestination(user))
    }
  }, [hydrated, user, isLoading, router])

  // While hydrating/loading, or user is being redirected, show nothing
  if (!hydrated || isLoading || !user || user.subscriptionTier !== 'COACH') {
    return null
  }

  return (
    <div className="theme-vine min-h-[100dvh] pb-20">
      {children}
      <CoachNav />
    </div>
  )
}
