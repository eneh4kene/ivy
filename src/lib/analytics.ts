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

  // Did completing a workout follow a call that same day?
  workoutFollowedCall: (userId: string, callType: string, streakDays: number) =>
    capture(userId, 'workout_followed_call', { call_type: callType, streak_days: streakDays }),

  // Rescue call → workout logged same day (the key rescue conversion signal)
  rescueResolved: (userId: string) =>
    capture(userId, 'rescue_resolved'),

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

  // ── Server-owned lifecycle events ─────────────────────────────────────────
  // Rule of thumb: the SERVER owns state transitions (they happen in jobs and
  // webhooks, where the client can't see them); the client owns intent/UI
  // events (frontend/lib/analytics/events.ts). Don't double-emit.

  // Acquisition ("referral" = coach invite tokens)
  coachInviteJoinRequested: (distinctId: string, coachId: string) =>
    capture(distinctId, 'coach_invite_join_requested', { coach_id: coachId }),

  coachClientLinked: (clientId: string, coachId: string, source: string) =>
    capture(clientId, 'coach_client_linked', { coach_id: coachId, source }),

  // Onboarding / Day Zero
  onboardingCompletedServer: (userId: string, tier: string) =>
    capture(userId, 'onboarding_completed_server', { tier }),

  dayZeroTriggered: (userId: string, hasCard: boolean) =>
    capture(userId, 'day_zero_triggered', { has_card: hasCard }),

  foundationRunOpened: (userId: string, daysInCycle: number) =>
    capture(userId, 'foundation_run_opened', { days_in_cycle: daysInCycle }),

  // Payments
  paymentSucceeded: (userId: string, amount: number, currency: string) =>
    capture(userId, 'payment_succeeded', { amount, currency }),

  paymentFailed: (userId: string, invoiceId: string) =>
    capture(userId, 'payment_failed', { invoice_id: invoiceId }),

  // Staking
  stakeCycleOpened: (userId: string, amount: number, isFoundation: boolean) =>
    capture(userId, 'stake_cycle_opened', { amount, is_foundation: isFoundation }),

  stakeAuthFailed: (userId: string, reason: string) =>
    capture(userId, 'stake_auth_failed', { reason }),

  stakeCycleSettled: (userId: string, props: { daysKept: number; daysForfeited: number; capturedAmount: number; returnedAmount: number }) =>
    capture(userId, 'stake_cycle_settled', {
      days_kept: props.daysKept,
      days_forfeited: props.daysForfeited,
      captured_amount: props.capturedAmount,
      returned_amount: props.returnedAmount,
    }),

  stakeSettlementFailed: (userId: string, cycleId: string) =>
    capture(userId, 'stake_settlement_failed', { cycle_id: cycleId }),

  // Arming ladder — one event per stage OUTCOME (the trigger funnel)
  armingNudgeSent: (userId: string, stage: string, channel: 'push' | 'sms') =>
    capture(userId, 'arming_nudge_sent', { stage, channel }),

  nudgeDeliveryFailed: (userId: string, stage: string, reason: string) =>
    capture(userId, 'nudge_delivery_failed', { stage, reason }),

  workoutArmed: (userId: string, via: string) =>
    capture(userId, 'workout_armed', { via }),

  // The spoken "when" was written back to the plan → T-60 nudge will fire
  plannedTimeCaptured: (userId: string, source: string) =>
    capture(userId, 'planned_time_captured', { source }),

  // A card-less (promo) subscriber saved a card — the stake opt-in moment
  cardAdded: (userId: string, purpose: string) =>
    capture(userId, 'card_added', { purpose }),

  armingDeadlineMissed: (userId: string) =>
    capture(userId, 'arming_deadline_missed'),

  // Calls
  callScheduled: (userId: string, callType: string, leadMinutes: number) =>
    capture(userId, 'call_scheduled', { call_type: callType, lead_minutes: leadMinutes }),

  callInitiateFailed: (userId: string, callType: string, reason: string) =>
    capture(userId, 'call_initiate_failed', { call_type: callType, reason }),

  callDropped: (userId: string, durationSecs: number, reason: string) =>
    capture(userId, 'call_dropped', { duration_secs: durationSecs, reason }),

  callbackDetected: (userId: string, requestedMinutes: number) =>
    capture(userId, 'callback_detected', { requested_minutes: requestedMinutes }),

  callbackCallScheduled: (userId: string, callType: string) =>
    capture(userId, 'callback_call_scheduled', { call_type: callType }),

  missedCallFollowupSent: (userId: string, channel: string) =>
    capture(userId, 'missed_call_followup_sent', { channel }),

  // Circles / games / catchup
  circleSessionOpened: (circleId: string, memberCount: number) =>
    capture(`circle:${circleId}`, 'circle_session_opened', { circle_id: circleId, member_count: memberCount }),

  circleSessionClosed: (circleId: string, shares: number, absentees: number) =>
    capture(`circle:${circleId}`, 'circle_session_closed', { circle_id: circleId, shares, absentees }),

  circleCatchupCreated: (userId: string, circleId: string) =>
    capture(userId, 'circle_catchup_created', { circle_id: circleId }),

  circleCatchupCovered: (userId: string) =>
    capture(userId, 'circle_catchup_covered'),

  circleGameEvent: (userId: string | null, gameId: string, eventType: string) =>
    capture(userId ?? `game:${gameId}`, 'circle_game_event', { game_id: gameId, event_type: eventType }),

  // Coach loop
  ponderCallScheduled: (coachId: string) =>
    capture(coachId, 'ponder_call_scheduled'),

  ponderCompleted: (coachId: string, programmeUpdatesApplied: number) =>
    capture(coachId, 'ponder_completed', { programme_updates_applied: programmeUpdatesApplied }),

  programmeUpdated: (clientId: string, actor: string) =>
    capture(clientId, 'programme_updated', { actor }),

  // Ops overlay — emitted by opsAlert when a failure has a known user, so
  // funnels can separate breakage from drop-off. Exclude from default funnels.
  systemFailure: (userId: string, source: string, title: string, severity: string) =>
    capture(userId, 'system_failure', { source, title, severity }),

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
