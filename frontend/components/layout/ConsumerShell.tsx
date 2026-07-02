'use client'

/**
 * Shared chrome for the consumer PWA hub: auth gate + theme + the persistent
 * BottomNav. Used by /home, /ivy, /circles, /donations so they all share one
 * navigation surface. Immersive/flow routes (/daily, /stake-setup,
 * /onboard-consumer) deliberately opt out — they render their own full-screen
 * shell without nav.
 */

import { ProtectedRoute } from '@/components/auth/protected-route'
import { BottomNav } from '@/components/layout/BottomNav'

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="theme-vine min-h-[100dvh]">
        {children}
        <BottomNav />
      </div>
    </ProtectedRoute>
  )
}
