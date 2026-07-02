'use client'

/** Auth gate for the season-close ceremony. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function SeasonCloseLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><div className="theme-vine min-h-[100dvh]">{children}</div></ProtectedRoute>
}
