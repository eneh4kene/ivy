'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { token } = useAuthStore()

  // On a hard reload the persisted store rehydrates after first render. Until it
  // has, token reads as its default (null) — redirecting on that would bounce a
  // logged-in user to /login. Wait for hydration first.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // persist API is client-only — never touch it during SSR/prerender.
    if (useAuthStore.persist?.hasHydrated?.()) setHydrated(true)
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true))
    return unsub
  }, [])

  // Auth is proven by a bearer token, full stop. We accept it from EITHER the
  // zustand store OR the raw `ivy_token` localStorage key the axios client reads,
  // because the two have desynced (token present but isAuthenticated stale-false),
  // which previously left this page stuck on a spinner forever: the old gate
  // required isAuthenticated===true to render but only redirected when there was
  // no token at all. An invalid token is handled by the axios 401 interceptor
  // (it clears both keys and redirects), so rendering on token presence is safe.
  const hasToken =
    !!token || (typeof window !== 'undefined' && !!localStorage.getItem('ivy_token'))

  useEffect(() => {
    if (hydrated && !hasToken) {
      router.push('/login')
    }
  }, [hydrated, hasToken, router])

  if (!hydrated || !hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}
