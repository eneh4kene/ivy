'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { Sidebar } from '@/components/layout/sidebar'

export default function DonationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="theme-arcade flex h-screen bg-background overflow-hidden">
        <div className="hidden md:block w-60 flex-shrink-0">
          <Sidebar />
        </div>
        <div className="md:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
