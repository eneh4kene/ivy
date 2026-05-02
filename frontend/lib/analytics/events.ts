import { posthog } from './posthog'

// ─── Acquisition ─────────────────────────────────────────────────────────────

export const analytics = {
  // Page
  page: (name: string, props?: Record<string, unknown>) =>
    posthog.capture('$pageview', { page: name, ...props }),

  // Signup funnel
  signupStarted: (region: 'GB' | 'US') =>
    posthog.capture('signup_started', { region }),

  signupCompleted: (region: 'GB' | 'US') =>
    posthog.capture('signup_completed', { region }),

  // Onboarding
  onboardingStepCompleted: (step: string, data?: Record<string, unknown>) =>
    posthog.capture('onboarding_step_completed', { step, ...data }),

  trialStarted: (tier: string, currency: string) =>
    posthog.capture('trial_started', { tier, currency }),

  // ─── Core loop ─────────────────────────────────────────────────────────────

  workoutLogged: (status: 'completed' | 'skipped', track: string, streakDays: number) =>
    posthog.capture('workout_logged', { status, track, streak_days: streakDays }),

  rescueCallInitiated: () =>
    posthog.capture('rescue_call_initiated'),

  streakMilestoneReached: (days: number) =>
    posthog.capture('streak_milestone_reached', { days }),

  graceDayUsed: (streakDays: number) =>
    posthog.capture('grace_day_used', { streak_days: streakDays }),

  // ─── Season / Sprint ───────────────────────────────────────────────────────

  seasonStarted: (seasonNumber: number, goal: string) =>
    posthog.capture('season_started', { season_number: seasonNumber, goal }),

  seasonClosed: (seasonNumber: number, consistencyRate: number, totalDonated: number) =>
    posthog.capture('season_closed', { season_number: seasonNumber, consistency_rate: consistencyRate, total_donated: totalDonated }),

  sprintCompleted: (sprintNumber: number, consistencyRate: number) =>
    posthog.capture('sprint_completed', { sprint_number: sprintNumber, consistency_rate: consistencyRate }),

  // ─── Social ────────────────────────────────────────────────────────────────

  buddySet: () => posthog.capture('buddy_set'),
  buddyRemoved: () => posthog.capture('buddy_removed'),

  seasonActivityJoined: (activityType: string) =>
    posthog.capture('season_activity_joined', { activity_type: activityType }),

  impactStoryReceived: (tier: string, charity: string) =>
    posthog.capture('impact_story_received', { tier, charity }),

  // ─── Monetisation ──────────────────────────────────────────────────────────

  subscriptionConverted: (tier: string, currency: string, price: number) =>
    posthog.capture('subscription_converted', { tier, currency, price }),

  tierUpgraded: (from: string, to: string) =>
    posthog.capture('tier_upgraded', { from, to }),

  subscriptionCancelled: (tier: string, reason?: string) =>
    posthog.capture('subscription_cancelled', { tier, reason }),

  // ─── PWA / Notifications ──────────────────────────────────────────────────

  pushNotificationEnabled: () => posthog.capture('push_notification_enabled'),
  pushNotificationDisabled: () => posthog.capture('push_notification_disabled'),
  pwaInstalled: () => posthog.capture('pwa_installed'),

  // ─── User identity ────────────────────────────────────────────────────────

  identify: (userId: string, props: { email: string; tier: string; region: string; commStyle: string }) => {
    posthog.identify(userId, {
      email: props.email,
      tier: props.tier,
      region: props.region,
      comm_style: props.commStyle,
    })
  },

  reset: () => posthog.reset(),
}
