import type { User, SubscriptionTier } from './types'
import { getTierPrice as getPriceFromConfig, getWalletRate, type Currency } from './pricing'

/**
 * Feature flags for tier-based access control
 */
export type Feature =
  | 'workouts'              // All tiers
  | 'donations'             // All tiers
  | 'basicStats'            // All tiers
  | 'energyMoodScores'      // All paid tiers (universal AI feature)
  | 'healthConfidence'      // All paid tiers (universal AI feature)
  | 'lifeMarkers'           // All paid tiers (universal AI feature)
  | 'calendarSync'          // All paid tiers (universal AI feature)
  | 'streakBonuses'         // All paid tiers (universal — consistency always rewarded)
  | 'seasonClose'           // All paid tiers (universal — end-of-season arc review)
  | 'ivyCircle'             // IVY PLUS+ (ELITE+)
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
  B2B: 2, // B2B has Ivy Plus-level features
}

/**
 * Feature requirements mapping.
 * Per pricing strategy v4: all AI features are universal at every paid tier.
 * Differentiators are wallet size and human coaching quality.
 */
const FEATURE_REQUIREMENTS: Record<Feature, { minTier?: SubscriptionTier; requiresRole?: string[] }> = {
  workouts: {},
  donations: {},
  basicStats: {},
  energyMoodScores: { minTier: 'PRO' },    // All paid tiers
  healthConfidence: { minTier: 'PRO' },    // All paid tiers
  lifeMarkers: { minTier: 'PRO' },         // All paid tiers
  calendarSync: { minTier: 'PRO' },        // All paid tiers
  streakBonuses: { minTier: 'PRO' },       // All paid tiers — universal, never gated
  seasonClose: { minTier: 'PRO' },         // All paid tiers — universal
  ivyCircle: { minTier: 'ELITE' },         // Ivy Plus and Concierge
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
 * PRO = "Ivy", ELITE = "Ivy Plus", CONCIERGE = "Ivy Concierge"
 */
export function getTierName(tier: SubscriptionTier): string {
  const names: Record<SubscriptionTier, string> = {
    FREE: 'Free Trial',
    PRO: 'Ivy',
    ELITE: 'Ivy Plus',
    CONCIERGE: 'Ivy Concierge',
    B2B: 'Ivy Business',
  }
  return names[tier]
}

/**
 * Get tier pricing (currency-aware)
 */
export function getTierPrice(tier: SubscriptionTier, currency: Currency = 'GBP'): string {
  if (tier === 'FREE') return '14-day trial'
  if (tier === 'B2B') return 'Custom pricing'
  return getPriceFromConfig(tier, currency)
}

/**
 * Get features list for a specific tier (used in pricing cards and locked feature UI)
 */
export function getTierFeatures(tier: SubscriptionTier, currency: Currency = 'GBP'): string[] {
  const features: Record<SubscriptionTier, string[]> = {
    FREE: [
      'Full Ivy experience for 14 days',
      'Daily morning + evening AI calls',
      'Rescue calls — negotiate a minimum that counts',
      'Missed call recovery',
      'All 4 accountability tracks',
      'Impact Wallet included',
      'No card required',
    ],
    PRO: [
      'Daily morning + evening AI calls',
      'Rescue calls & missed call recovery',
      'All 4 tracks: Fitness, Focus, Sleep, Balance',
      'WhatsApp nudges & calendar integration',
      'Full transformation tracking & life markers',
      'Streak bonuses at 7, 30 & 90-day milestones',
      'Season Close — end-of-season arc review & AI goal suggestions',
      getWalletRate('PRO', currency) || '£30/month impact wallet (£1/day)',
      '2 charity choices',
      'Impact story: personalised note + photo',
    ],
    ELITE: [
      'Everything in Ivy',
      getWalletRate('ELITE', currency) || '£45/month impact wallet (£1.50/day)',
      '3 charity choices',
      'Impact story: note + photo + audio message',
      'Ivy Circles — peer-facilitated (3× per season)',
      'Season-end 1-on-1 with peer coach',
      'Priority support',
    ],
    CONCIERGE: [
      'Everything in Ivy Plus',
      getWalletRate('CONCIERGE', currency) || '£60/month impact wallet (£2/day)',
      'All charities',
      'Impact story: note + photo + personal video',
      'Ivy Circles — pro/celebrity coach, max 4 (3× per season)',
      'Season-end 1-on-1 with certified professional',
      'Quarterly strategy calls',
      'Custom escalation rules',
      'White-glove onboarding',
      'Wallet gifting to others',
    ],
    B2B: [
      'Full AI experience for all employees',
      'Company-funded Impact Wallet',
      'Ivy Impact Stories for every employee',
      'Team analytics dashboard',
      'Charity impact report (CSR asset)',
      'Season management',
      'Employee invitations',
      'Privacy-first reporting',
    ],
  }
  return features[tier]
}
