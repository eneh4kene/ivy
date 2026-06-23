'use client'

/**
 * Auth gate for the mobile consumer daily loop. No desktop sidebar — these are
 * full-screen mobile-first surfaces. Unauthenticated visitors (incl. someone who
 * just installed the PWA without signing up) are redirected to /login.
 */

import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}
