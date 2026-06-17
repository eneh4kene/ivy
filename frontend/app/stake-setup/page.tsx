'use client'

/**
 * /stake-setup — Stake onboarding flow.
 *
 * Renders the StakeSetupScreen wizard (mock data only).
 * In production, this route is reached:
 *   - After a new user completes the onboarding wizard
 *   - When an existing user wants to configure/change their stake
 *
 * TODO(api): gate this route with auth (redirect to /login if no session).
 * TODO(api): if user already has an active StakeCycle, redirect to /daily.
 */

import { StakeSetupScreen } from '@/components/stake-setup/StakeSetupScreen'

export default function StakeSetupPage() {
  return <StakeSetupScreen />
}
