import { PostHog } from 'posthog-node'
import logger from '../utils/logger'

let client: PostHog | null = null

function getClient(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null
  if (!client) {
    client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
    })
  }
  return client
}

function capture(distinctId: string, event: string, props?: Record<string, unknown>) {
  try {
    getClient()?.capture({ distinctId, event, properties: props })
  } catch (err) {
    logger.warn(`Analytics capture failed: ${event}`, err)
  }
}

export const serverAnalytics = {
  // Core loop
  callCompleted: (userId: string, callType: string, durationSecs: number, outcome: string) =>
    capture(userId, 'call_completed', { call_type: callType, duration_secs: durationSecs, outcome }),

  callMissed: (userId: string, callType: string) =>
    capture(userId, 'call_missed', { call_type: callType }),

  workoutLogged: (userId: string, status: string, track: string, streakDays: number) =>
    capture(userId, 'workout_logged', { status, track, streak_days: streakDays }),

  rescueCallInitiated: (userId: string) =>
    capture(userId, 'rescue_call_initiated'),

  streakMilestoneReached: (userId: string, days: number) =>
    capture(userId, 'streak_milestone_reached', { days }),

  // Season
  seasonStarted: (userId: string, seasonNumber: number) =>
    capture(userId, 'season_started', { season_number: seasonNumber }),

  seasonClosed: (userId: string, consistencyRate: number, totalDonated: number) =>
    capture(userId, 'season_closed', { consistency_rate: consistencyRate, total_donated: totalDonated }),

  // Monetisation
  subscriptionConverted: (userId: string, tier: string, currency: string) =>
    capture(userId, 'subscription_converted', { tier, currency }),

  subscriptionCancelled: (userId: string, tier: string) =>
    capture(userId, 'subscription_cancelled', { tier }),

  // Identity
  identify: (userId: string, props: Record<string, unknown>) => {
    try {
      getClient()?.identify({ distinctId: userId, properties: props })
    } catch (err) {
      logger.warn('Analytics identify failed', err)
    }
  },

  shutdown: async () => {
    await client?.shutdown()
  },
}
