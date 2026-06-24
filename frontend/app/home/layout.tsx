'use client'

/** Auth gate for the mobile consumer hub. See app/daily/layout.tsx. */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><div className="theme-arcade min-h-[100dvh]">{children}</div></ProtectedRoute>
}
