'use client'

/**
 * /circles — Cohort view + active game UI.
 *
 * Uses CirclesScreen (mock data only).
 * TODO(api): replace MOCK_CIRCLE with real API fetch in CirclesScreen when
 *            backend Phase 1 + circlesApi are wired.
 */

import { CirclesScreen } from '@/components/circles/CirclesScreen'

export default function CirclesPage() {
  return <CirclesScreen />
}
