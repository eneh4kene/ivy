'use client'

/** Auth gate + shared bottom-nav chrome for the mobile consumer hub. */

import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
