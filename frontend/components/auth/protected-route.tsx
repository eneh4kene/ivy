'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading, token } = useAuthStore()

  // On a hard reload the persisted store rehydrates after first render. Until it
  // has, token/isAuthenticated read as their defaults (null/false) — redirecting
  // on that would bounce a logged-in user to /login. Wait for hydration first.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // persist API is client-only — never touch it during SSR/prerender.
    if (useAuthStore.persist?.hasHydrated?.()) setHydrated(true)
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true))
    return unsub
  }, [])

  useEffect(() => {
    if (hydrated && !isLoading && !isAuthenticated && !token) {
      router.push('/login')
    }
  }, [hydrated, isAuthenticated, isLoading, token, router])

  if (!hydrated || isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}
