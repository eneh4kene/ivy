'use client'

/** Auth gate for the mobile Seasons surface. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function SeasonsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}
