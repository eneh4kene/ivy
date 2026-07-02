'use client'

/** Auth gate for the call history surface. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function CallsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><div className="theme-vine min-h-[100dvh]">{children}</div></ProtectedRoute>
}
