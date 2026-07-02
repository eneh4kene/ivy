'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.subscriptionTier !== 'COACH') {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  // While auth is loading, or user is being redirected, show nothing
  if (isLoading || !user || user.subscriptionTier !== 'COACH') {
    return null
  }

  return <div className="theme-vine min-h-[100dvh]">{children}</div>
}
