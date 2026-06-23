import type { User } from './types'

/**
 * Single source of truth for where a freshly-authenticated user lands.
 *
 * Consumers land on /home (the mobile PWA hub where the stake gate + daily loop
 * live) — NOT /dashboard (the desktop stats/web surface). Coaches go to their
 * coach console. New / not-yet-onboarded users go through onboarding first.
 *
 * Used by both the magic-link verify page and the Google SSO button so the two
 * entry points stay identical.
 */
export function postLoginDestination(user: User, isNewUser = false): string {
  if (user.subscriptionTier === 'COACH') {
    return user.isOnboarded ? '/coach' : '/coach/settings'
  }
  if (isNewUser || !user.isOnboarded) {
    // Consumers get the modern stake-aware flow; B2B still uses the legacy
    // multi-step wizard (company/employee/admin setup).
    return user.subscriptionTier === 'B2B' ? '/onboard/welcome' : '/onboard-consumer'
  }
  return '/home'
}
