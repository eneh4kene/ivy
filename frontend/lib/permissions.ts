import type { User, SubscriptionTier } from './types'

/**
 * Feature flags for tier-based access control
 */
export type Feature =
  | 'workouts'              // All tiers
  | 'donations'             // All tiers
  | 'basicStats'            // All tiers
  | 'energyMoodScores'      // PRO+
  | 'healthConfidence'      // ELITE+
  | 'lifeMarkers'           // ELITE+
  | 'calendarSync'          // ELITE+
  | 'ivyCircle'             // ELITE+
  | 'humanReview'           // CONCIERGE only
  | 'strategyCalls'         // CONCIERGE only
  | 'adminDashboard'        // Admin role only

/**
 * Tier hierarchy for feature access
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 1,
  ELITE: 2,
  CONCIERGE: 3,
  B2B: 2, // B2B has ELITE-level features
}

/**
 * Feature requirements mapping
 */
const FEATURE_REQUIREMENTS: Record<Feature, { minTier?: SubscriptionTier; requiresRole?: string[] }> = {
  workouts: {},
  donations: {},
  basicStats: {},
  energyMoodScores: { minTier: 'PRO' },
  healthConfidence: { minTier: 'ELITE' },
  lifeMarkers: { minTier: 'ELITE' },
  calendarSync: { minTier: 'ELITE' },
  ivyCircle: { minTier: 'ELITE' },
  humanReview: { minTier: 'CONCIERGE' },
  strategyCalls: { minTier: 'CONCIERGE' },
  adminDashboard: { requiresRole: ['admin', 'superadmin'] },
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(user: User | null, feature: Feature): boolean {
  if (!user) return false

  const requirements = FEATURE_REQUIREMENTS[feature]

  // Check role requirement
  if (requirements.requiresRole) {
    const userRole = user.role || 'user'
    return requirements.requiresRole.includes(userRole)
  }

  // Check tier requirement
  if (requirements.minTier) {
    const userTierLevel = TIER_HIERARCHY[user.subscriptionTier]
    const requiredTierLevel = TIER_HIERARCHY[requirements.minTier]
    return userTierLevel >= requiredTierLevel
  }

  // No requirements means accessible to all
  return true
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  if (!user) return false
  const role = user.role || 'user'
  return role === 'admin' || role === 'superadmin'
}

/**
 * Check if user is company admin (has companyId and admin role)
 */
export function isCompanyAdmin(user: User | null): boolean {
  if (!user) return false
  return isAdmin(user) && !!user.companyId
}

/**
 * Get the minimum tier required for a feature
 */
export function getRequiredTier(feature: Feature): SubscriptionTier | null {
  return FEATURE_REQUIREMENTS[feature].minTier || null
}

/**
 * Get all locked features for a user
 */
export function getLockedFeatures(user: User | null): Feature[] {
  if (!user) return Object.keys(FEATURE_REQUIREMENTS) as Feature[]

  const allFeatures = Object.keys(FEATURE_REQUIREMENTS) as Feature[]
  return allFeatures.filter(feature => !canAccessFeature(user, feature))
}

/**
 * Get all available features for a user
 */
export function getAvailableFeatures(user: User | null): Feature[] {
  if (!user) return []

  const allFeatures = Object.keys(FEATURE_REQUIREMENTS) as Feature[]
  return allFeatures.filter(feature => canAccessFeature(user, feature))
}

/**
 * Get user-friendly tier name
 */
export function getTierName(tier: SubscriptionTier): string {
  const names: Record<SubscriptionTier, string> = {
    FREE: 'Free',
    PRO: 'Ivy Pro',
    ELITE: 'Ivy Elite',
    CONCIERGE: 'Ivy Concierge',
    B2B: 'Ivy Business',
  }
  return names[tier]
}

/**
 * Get tier pricing
 */
export function getTierPrice(tier: SubscriptionTier): string {
  const prices: Record<SubscriptionTier, string> = {
    FREE: '£0',
    PRO: '£99/month',
    ELITE: '£199/month',
    CONCIERGE: '£399/month',
    B2B: 'Custom pricing',
  }
  return prices[tier]
}

/**
 * Get features for a specific tier
 */
export function getTierFeatures(tier: SubscriptionTier): string[] {
  const features: Record<SubscriptionTier, string[]> = {
    FREE: [
      'Plan and track workouts',
      'Basic donation tracking',
      'View your stats',
      'Limited impact wallet',
    ],
    PRO: [
      'Everything in Free',
      '2 AI calls per week',
      'Daily WhatsApp nudges',
      '£20/month impact wallet',
      'Energy & mood tracking',
      '£1 per workout donation',
    ],
    ELITE: [
      'Everything in Pro',
      '4 AI calls per week',
      '£30/month impact wallet',
      '£1.50 per workout donation',
      'Calendar integration',
      'Ivy Circle community',
      'Full transformation tracking',
      'Life markers',
      'Missed call recovery',
    ],
    CONCIERGE: [
      'Everything in Elite',
      '5-7 AI calls per week (daily)',
      '£50/month impact wallet',
      '£2 per workout donation',
      'Human coach review',
      'Quarterly strategy calls',
      'Custom escalation rules',
      'Priority support',
      'White-glove onboarding',
    ],
    B2B: [
      'Team dashboard',
      'Aggregate analytics',
      'Company-funded donations',
      'Season management',
      'Employee invitations',
      'Privacy-first reporting',
      'Optional Ivy Circles',
      'Integration support',
    ],
  }
  return features[tier]
}
