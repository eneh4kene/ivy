'use client'

/** Auth gate + shared bottom-nav chrome for the mobile Circles surface. */

import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function CirclesLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
