'use client'

/**
 * Impact tab. Now part of the consumer mobile hub (shared bottom nav) rather
 * than the desktop Sidebar shell — Impact is a primary consumer destination.
 */

import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function DonationsLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
