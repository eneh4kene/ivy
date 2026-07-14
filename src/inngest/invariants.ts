import { inngest } from './client'
import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { opsBatch } from '../lib/ops-alert'
import { withHeartbeat } from './with-heartbeat'
import { fromZonedTime } from 'date-fns-tz'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Invariant sweeper — verifies OUTCOMES, not code paths.
 *
 * Ivy's promises are time-based ("a call at 7pm", "settlement tonight",
 * "a callback in 20 minutes"). A job can run clean and still leave a promise
 * broken (eligibility bug, webhook that never arrived, Inngest event lost).
 * This cron queries the domain tables for violated promises and pages on what
 * it finds. ALERT-ONLY by design in week one: the two exceptions (#8/#9) call
 * service functions that are already idempotent re-runs of their own queries.
 *
 * NOTE on stuck SCHEDULED calls (#1): never re-emit `call/scheduled` here —
 * initiateCall dedupes on callId (24h idempotency window), so the re-emit
 * would be silently dropped. Redial is a manual admin action.
 */

const MIN = 60 * 1000
const HOUR = 60 * MIN

export async function runInvariantSweep(): Promise<Record<string, number>> {
  const now = new Date()
  const violations = opsBatch('invariants')
  const counts: Record<string, number> = {}

  // #1 — Call promised but never dialled: SCHEDULED >30m past its time.
  const stuckScheduled = await prisma.call.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lt: new Date(now.getTime() - 30 * MIN) } },
    select: { id: true, userId: true, callType: true, scheduledAt: true },
  })
  counts.stuck_scheduled_calls = stuckScheduled.length
  for (const c of stuckScheduled) {
    violations.add({
      severity: 'critical',
      title: 'call_never_dialled',
      detail: `${c.callType} promised at ${c.scheduledAt.toISOString()} never fired — redial manually (do NOT re-emit call/scheduled)`,
      userId: c.userId,
      entity: { type: 'call', id: c.id },
    })
  }

  // #2 — Call stuck IN_PROGRESS >2h (hourly backstop to the 03:00 recovery cron).
  const stuckInProgress = await prisma.call.count({
    where: { status: 'IN_PROGRESS', startedAt: { lt: new Date(now.getTime() - 2 * HOUR) } },
  })
  counts.stuck_in_progress_calls = stuckInProgress
  if (stuckInProgress > 0) {
    violations.add({
      severity: 'warn',
      title: 'calls_stuck_in_progress',
      detail: `${stuckInProgress} call(s) IN_PROGRESS >2h — Retell webhook likely lost; 03:00 recovery will mark FAILED`,
    })
  }

  // #3 — Messages that ended FAILED in the last sweep window (backstop to the
  // terminal-failure pager).
  const failedMessages = await prisma.message.groupBy({
    by: ['channel'],
    where: { status: 'FAILED', createdAt: { gte: new Date(now.getTime() - 70 * MIN) } },
    _count: { _all: true },
  })
  counts.failed_messages = failedMessages.reduce((s, g) => s + g._count._all, 0)
  if (counts.failed_messages > 0) {
    violations.add({
      severity: 'warn',
      title: 'messages_failed',
      detail: failedMessages.map((g) => `${g.channel}: ${g._count._all}`).join(', '),
    })
  }

  // #3b — Messages stuck PENDING >30m: the Inngest event was lost between
  // emit and handler start (nothing else can leave a row PENDING that long).
  const stuckPending = await prisma.message.count({
    where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 30 * MIN) } },
  })
  counts.stuck_pending_messages = stuckPending
  if (stuckPending > 0) {
    violations.add({
      severity: 'warn',
      title: 'messages_stuck_pending',
      detail: `${stuckPending} outbound message(s) never picked up by the send handler`,
    })
  }

  // #4 — Settlement missed: AUTHORIZED >6h past periodEnd. Money — critical,
  // and always manual (rerun settleExpiredStakeCycles or settle per-cycle).
  const overdueSettlements = await prisma.stakeCycle.findMany({
    where: { status: 'AUTHORIZED', periodEnd: { lt: new Date(now.getTime() - 6 * HOUR) } },
    select: { id: true, userId: true, periodEnd: true },
  })
  counts.overdue_settlements = overdueSettlements.length
  for (const c of overdueSettlements) {
    violations.add({
      severity: 'critical',
      title: 'settlement_overdue',
      detail: `cycle ended ${c.periodEnd.toISOString()} and is still AUTHORIZED — the auth hold is lingering on the user's card`,
      userId: c.userId,
      entity: { type: 'stakeCycle', id: c.id },
    })
  }

  // #5 — Cycle AUTHORIZED with no PaymentIntent after 1h: openStakeCycle
  // half-failed; there is no hold behind this cycle.
  const cyclesNoPi = await prisma.stakeCycle.findMany({
    where: {
      status: 'AUTHORIZED',
      stripePaymentIntentId: null,
      createdAt: { lt: new Date(now.getTime() - 1 * HOUR) },
    },
    select: { id: true, userId: true },
  })
  counts.cycles_without_pi = cyclesNoPi.length
  for (const c of cyclesNoPi) {
    violations.add({
      severity: 'critical',
      title: 'cycle_missing_payment_intent',
      userId: c.userId,
      entity: { type: 'stakeCycle', id: c.id },
    })
  }

  // #6 — Deadline never enforced: paid user whose arming window closed >90m
  // ago with today's workout still unarmed and its slice PENDING. Means the
  // DEADLINE stage skipped them → the forfeit ledger is drifting.
  const armingUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      isOnboarded: true,
      subscriptionTier: { notIn: ['FREE', 'COACH'] },
      armingWindowEnd: { not: null },
    },
    select: { id: true, timezone: true, armingWindowEnd: true },
  })
  let missedDeadlines = 0
  for (const u of armingUsers) {
    try {
      const tz = u.timezone ?? 'Europe/London'
      const todayLocal = formatInTimeZone(now, tz, 'yyyy-MM-dd')
      const windowEnd = fromZonedTime(`${todayLocal}T${u.armingWindowEnd}:00`, tz)
      if (now.getTime() - windowEnd.getTime() < 90 * MIN) continue

      const dayStartUtc = fromZonedTime(`${todayLocal}T00:00:00`, tz)
      const dayEndUtc = fromZonedTime(`${todayLocal}T23:59:59`, tz)
      const unenforced = await prisma.workout.findFirst({
        where: {
          userId: u.id,
          plannedDate: { gte: dayStartUtc, lte: dayEndUtc },
          armedAt: null,
          status: { not: 'MISSED' },
          sliceOutcome: 'PENDING',
        },
        select: { id: true },
      })
      if (unenforced) {
        missedDeadlines++
        violations.add({
          severity: 'critical',
          title: 'deadline_not_enforced',
          detail: `window closed >90m ago, workout still unarmed+PENDING — replay runArmingForStage('DEADLINE') for this user`,
          userId: u.id,
          entity: { type: 'workout', id: unenforced.id },
        })
      }
    } catch {
      // tz parse failure for one user must not kill the sweep
    }
  }
  counts.deadlines_not_enforced = missedDeadlines

  // #7 — Sessions past due: scheduled >1h overdue, or open >74h (close cutoff
  // is 72h). SAFE auto-fix: the lifecycle service functions are idempotent
  // re-runs of the same queries the 30-min cron uses.
  const [sessionsPastDue, sessionsPastClose] = await Promise.all([
    prisma.circleSprintSession.count({
      where: { status: 'scheduled', scheduledAt: { lt: new Date(now.getTime() - 1 * HOUR) }, circleId: { not: null } },
    }),
    prisma.circleSprintSession.count({
      where: { status: 'open', scheduledAt: { lt: new Date(now.getTime() - 74 * HOUR) }, circleId: { not: null } },
    }),
  ])
  counts.sessions_past_due = sessionsPastDue
  counts.sessions_past_close = sessionsPastClose
  if (sessionsPastDue > 0 || sessionsPastClose > 0) {
    violations.add({
      severity: 'warn',
      title: 'circle_sessions_stale',
      detail: `${sessionsPastDue} unopened past due, ${sessionsPastClose} unclosed past 74h — re-running lifecycle`,
    })
    try {
      const { default: circleSessionService } = await import('../services/circle-session.service')
      if (sessionsPastDue > 0) await circleSessionService.openDueSessions()
      if (sessionsPastClose > 0) await circleSessionService.closeExpiredSessions()
    } catch (err) {
      violations.add({ severity: 'warn', title: 'session_lifecycle_rerun_failed', error: err })
    }
  }

  // #8 — Missed call with no follow-up message within 30 minutes: the user
  // missed Ivy AND the "we missed each other" nudge silently failed.
  const recentNoAnswer = await prisma.call.findMany({
    where: {
      status: 'NO_ANSWER',
      endedAt: { gte: new Date(now.getTime() - 70 * MIN), lt: new Date(now.getTime() - 30 * MIN) },
    },
    select: { id: true, userId: true, endedAt: true },
  })
  let missedFollowups = 0
  for (const c of recentNoAnswer) {
    const followUp = await prisma.message.findFirst({
      where: {
        userId: c.userId,
        direction: 'OUTBOUND',
        createdAt: { gte: c.endedAt!, lte: new Date(c.endedAt!.getTime() + 30 * MIN) },
      },
      select: { id: true },
    })
    if (!followUp) {
      missedFollowups++
      violations.add({
        severity: 'warn',
        title: 'missed_call_no_followup',
        userId: c.userId,
        entity: { type: 'call', id: c.id },
      })
    }
  }
  counts.missed_call_no_followup = missedFollowups

  // #9 — Daily scheduler skipped someone: after 02:00 UTC, every active paid
  // call-eligible user (not TEXTS-style, not a coach client) should have at
  // least one Call row scheduled today by daily-evening-calls (00:00 UTC).
  if (now.getUTCHours() >= 2) {
    const utcDayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const eligible = await prisma.user.findMany({
      where: {
        isActive: true,
        isOnboarded: true,
        subscriptionTier: { notIn: ['FREE', 'COACH'] },
        commStyle: { not: 'TEXTS' },
        coachId: null,
      },
      select: { id: true },
    })
    let usersWithoutCalls = 0
    for (const u of eligible) {
      const call = await prisma.call.findFirst({
        where: { userId: u.id, scheduledAt: { gte: utcDayStart } },
        select: { id: true },
      })
      if (!call) {
        usersWithoutCalls++
        violations.add({
          severity: 'critical',
          title: 'no_calls_scheduled_today',
          detail: "daily-evening-calls skipped this paid user — run callService.scheduleDailyCalls manually",
          userId: u.id,
        })
      }
    }
    counts.users_without_calls_today = usersWithoutCalls
  }

  // #10 — Product signal, not an incident: catch-ups expiring uncovered.
  const expiredCatchups = await prisma.circleCatchup.count({
    where: { coveredAt: null, expiresAt: { lt: now, gte: new Date(now.getTime() - 70 * MIN) } },
  })
  counts.expired_catchups = expiredCatchups
  if (expiredCatchups >= 3) {
    violations.add({
      severity: 'info',
      title: 'catchups_expiring_uncovered',
      detail: `${expiredCatchups} catch-ups expired uncovered in the last sweep window`,
    })
  }

  // #11 — Charity money rotting: dispatch FAILED, or PENDING for >35 days.
  const [failedDonations, staleDonations] = await Promise.all([
    prisma.donation.count({ where: { dispatchStatus: 'FAILED' } }),
    prisma.donation.count({
      where: { dispatchStatus: 'PENDING', createdAt: { lt: new Date(now.getTime() - 35 * 24 * HOUR) } },
    }),
  ])
  counts.failed_donations = failedDonations
  counts.stale_donations = staleDonations
  if (failedDonations > 0 || staleDonations > 0) {
    violations.add({
      severity: 'warn',
      title: 'donations_stuck',
      detail: `${failedDonations} FAILED, ${staleDonations} PENDING >35d — charity money must not rot`,
    })
  }

  await violations.flush()
  logger.info(`Invariant sweep complete: ${JSON.stringify(counts)}`)
  return counts
}

// Hourly at :17 — offset from top-of-hour cron pileup.
export const opsInvariantSweep = inngest.createFunction(
  { id: 'ops-invariant-sweep', name: 'Ops: invariant sweeper', triggers: { cron: '17 * * * *' } },
  withHeartbeat('ops-invariant-sweep', async ({ step }: any) => {
    const counts = await step.run('sweep', () => runInvariantSweep())
    return counts
  })
)
