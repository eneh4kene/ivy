'use client'

/** Auth gate for stake setup. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function StakeSetupLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}
