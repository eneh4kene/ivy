'use client'

import { AdminRoute } from '@/components/auth/admin-route'
import { AdminSidebar } from '@/components/layout/admin-sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminRoute>
      <div className="flex h-screen">
        <aside className="w-64 flex-shrink-0">
          <AdminSidebar />
        </aside>
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </AdminRoute>
  )
}
