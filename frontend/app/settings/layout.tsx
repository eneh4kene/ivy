'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Sidebar } from '@/components/layout/sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="theme-arcade flex h-screen bg-background overflow-hidden">
        {/* Desktop: the full app sidebar */}
        <div className="hidden md:block w-60 flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: a clean bar back to the consumer home hub — the desktop
              sidebar links into web-only surfaces, so consumers don't see it. */}
          <header className="md:hidden sticky top-0 z-10 bg-ink-900/80 backdrop-blur-xl border-b border-ink-700/60 safe-top">
            <div className="px-4 py-3 flex items-center gap-2.5">
              <Link
                href="/home"
                aria-label="Back to home"
                className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full text-ink-300 hover:text-ink-50 hover:bg-ink-700/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <span className="font-display text-lg text-ink-50 tracking-tight">Settings</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
