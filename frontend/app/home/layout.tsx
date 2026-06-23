'use client'

/** Auth gate for the mobile consumer hub. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}
