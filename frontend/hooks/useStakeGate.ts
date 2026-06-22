'use client'

/**
 * useStakeGate — the "default-on" app-entry gate.
 *
 * On a landing screen, refresh the user and, if they're a paid user with no
 * stake set, send them into /stake-setup. If they deferred the gate this session
 * (tapped "Not now"), don't bounce them — return `showNudge: true` so the screen
 * can render a persistent re-nudge instead.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { needsStakeSetup, hasDeferredStakeGate } from '@/lib/stake'

export function useStakeGate() {
  const { user, fetchUser } = useAuthStore()
  const router = useRouter()
  const [showNudge, setShowNudge] = useState(false)

  // Refresh once so the gate reacts to the latest server state, not a stale
  // persisted store that could mis-gate a user who already set a stake.
  useEffect(() => {
    fetchUser().catch(() => {})
  }, [fetchUser])

  useEffect(() => {
    if (!needsStakeSetup(user)) { setShowNudge(false); return }
    if (hasDeferredStakeGate()) { setShowNudge(true); return }
    router.replace('/stake-setup')
  }, [user, router])

  return { showNudge, currency: user?.currency ?? 'GBP' }
}
