'use client'

/** Auth gate + shared bottom-nav chrome — same shell as /home. */

import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
