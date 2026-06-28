'use client'

/** Auth gate + shared bottom-nav chrome for the Ivy chat surface. */

import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function IvyLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
