/**
 * Arming Service — Phase 3 of product-pricing-rework.md
 *
 * Implements the morning VN arming loop and escalation ladder (§4):
 *
 *   sendArmingPrompt(userId)       → step 1: "Drop your VN"
 *   sendArmingReminder(userId)     → step 2: loss-framed reminder (~60-90 min after prompt)
 *   sendArmingFinalNotice(userId)  → step 3: final warning near deadline
 *   enforceArmingDeadline(userId)  → step 4: deadline passed → MISSED + FORFEITED
 *   runArmingSchedule(date)        → called by worker cron to process all active users for a day
 *
 * Escalation ladder (spec §4):
 *   1. Push prompt at window start          (free)
 *   2. Push loss-framed reminder 75 min in  (free)
 *   3. Push final notice near deadline      (free)
 *   4. Buddy nudge (pre-consented only)     (free social layer)
 *   5. ARMING_CHASE live call               (opt-in, capped 8/user/month, §9 d4b)
 *   Deadline: unarmed Workout → MISSED + sliceOutcome FORFEITED
 *
 * The morning VN is always a spoken voice note regardless of CommStyle (§1d).
 * Escalation nudges use web push; SMS fallback for the single morning prompt only (§1e, §9 d10).
 * Evening review delivery follows CommStyle (§1d) — handled in communication.service.ts.
 *
 * SAFETY: No real Twilio/Retell/push calls are made when DISABLE_EXTERNAL_SENDS=true.
 * Tests mock all external services.
 */

import { startOfDay, endOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { sendPushToUser, type PushPayload } from './push.service'
import messagingService from './messaging.service'
import callService from './call.service'
import { CURRENCY_SYMBOL, type Currency } from '../config/pricing'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cap on ARMING_CHASE calls per user per calendar month (§9 decision 4b) */
export const ARMING_CHASE_MONTHLY_CAP = 8

/**
 * How many minutes after the window-start prompt fires before the loss-framed
 * reminder fires (§4: "~60-90 min later").
 */
const REMINDER_DELAY_MINS = 75

// ---------------------------------------------------------------------------
// Push notification templates for the arming ladder
// ---------------------------------------------------------------------------

export const armingPushTemplates = {
  /** Step 1 — window opens */
  prompt: (stakeAmount: number, currency: Currency): PushPayload => ({
    title: 'Morning! Drop your voice note',
    body: `What's the one thing you're taking on today? Your ${CURRENCY_SYMBOL[currency]}${stakeAmount} stake is counting on it.`,
    tag: 'arming-prompt',
    url: '/daily?action=record',
    actions: [{ action: 'open', title: 'Record now' }],
  }),

  /** Step 2 — loss-framed reminder (~75 min after prompt, if still unarmed) */
  reminder: (stakeAmount: number, currency: Currency): PushPayload => ({
    title: "You haven't armed today",
    body: `Your ${CURRENCY_SYMBOL[currency]}${stakeAmount} is on the line until you record your voice note.`,
    tag: 'arming-reminder',
    url: '/daily?action=record',
    actions: [{ action: 'open', title: 'Arm now' }],
  }),

  /** Step 3 — final notice (approaching deadline) */
  finalNotice: (stakeAmount: number, currency: Currency, deadlineStr: string): PushPayload => ({
    title: 'Last chance to arm',
    body: `Drop your VN by ${deadlineStr} or today won't count and your ${CURRENCY_SYMBOL[currency]}${stakeAmount} goes to your forfeit destination.`,
    tag: 'arming-final-notice',
    url: '/daily?action=record',
    actions: [{ action: 'open', title: 'Arm now — it takes 30 seconds' }],
  }),
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load the minimal user data needed for arming logic.
 * Returns null if the user doesn't have arming configured.
 */
/**
 * Shape returned by loadArmingUser — defined explicitly because the three
 * arming-chase fields (armingChaseEnabled, chaseCallsThisMonth, chaseCapMonthStart)
 * are newly added to the schema in Phase 3.  The Prisma client types won't include
 * them until after `prisma generate` is run against the new schema (which requires
 * a real DB connection — safe to run post-review per the SAFETY note at the top).
 * We cast the query result to this shape; the runtime values are correct once the
 * migration is applied.
 */
export interface ArmingUser {
  id: string
  firstName: string | null
  phone: string | null
  currency: string | null
  timezone: string | null
  stakeWeeklyAmount: { toNumber?: () => number; valueOf?: () => number } | null
  armingWindowStart: string | null
  armingWindowEnd: string | null
  /** Phase 3 field — present after migration */
  armingChaseEnabled: boolean
  /** Phase 3 field — present after migration */
  chaseCallsThisMonth: number
  /** Phase 3 field — present after migration */
  chaseCapMonthStart: Date | null
  commStyle: string | null
  accountabilityBuddy: {
    id: string
    buddyName: string
    buddyEmail: string | null
    isActive: boolean
  } | null
}

async function loadArmingUser(userId: string): Promise<ArmingUser | null> {
  // Cast to any to select the Phase 3 fields before `prisma generate` is re-run.
  // Once the migration is applied and `prisma generate` runs, remove the cast.
  return (prisma.user as any).findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      phone: true,
      currency: true,
      timezone: true,
      stakeWeeklyAmount: true,
      armingWindowStart: true,
      armingWindowEnd: true,
      armingChaseEnabled: true,
      chaseCallsThisMonth: true,
      chaseCapMonthStart: true,
      commStyle: true,
      accountabilityBuddy: {
        select: { id: true, buddyName: true, buddyEmail: true, isActive: true },
      },
    },
  }) as Promise<ArmingUser | null>
}

/**
 * Convert "HH:MM" in the user's timezone to a UTC Date on the given calendar day.
 */
function toUTCOnDay(hhmm: string, tz: string, date: Date): Date {
  const localDateStr = date.toLocaleDateString('en-CA', { timeZone: tz })
  return fromZonedTime(`${localDateStr}T${hhmm}:00`, tz)
}

/**
 * Format an HH:MM time string as a human-readable "H:MMam/pm" label.
 */
function formatTime(hhmm: string, tz: string): string {
  // Build a dummy Date on Jan 1 2000 so we can format the time
  const dt = fromZonedTime(`2000-01-01T${hhmm}:00`, tz)
  return dt.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
}

/**
 * Return today's Workout for the user (PLANNED or existing for today).
 * Returns null if none found.
 */
async function getTodaysWorkout(userId: string, date: Date) {
  return prisma.workout.findFirst({
    where: {
      userId,
      plannedDate: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    orderBy: { plannedDate: 'asc' },
    select: { id: true, status: true, armedAt: true, sliceOutcome: true, stakeSliceAmount: true },
  })
}

/**
 * Check whether the monthly chase cap needs resetting and reset if so.
 * The cap window is a calendar month — if chaseCapMonthStart is in a prior month,
 * reset both the counter and the window.
 *
 * Returns the current call count after any reset.
 */
async function ensureChaseCap(
  userId: string,
  currentCount: number,
  capMonthStart: Date | null,
): Promise<number> {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`
  const capMonth = capMonthStart
    ? `${capMonthStart.getFullYear()}-${capMonthStart.getMonth()}`
    : null

  if (capMonth !== currentMonth) {
    // New calendar month — reset the counter.
    // Cast to any: chaseCallsThisMonth / chaseCapMonthStart are Phase 3 schema fields;
    // the Prisma client types will include them after `prisma generate` post-migration.
    await (prisma.user as any).update({
      where: { id: userId },
      data: {
        chaseCallsThisMonth: 0,
        chaseCapMonthStart: now,
      },
    })
    return 0
  }
  return currentCount
}

// ---------------------------------------------------------------------------
// Step 1: Send the arming prompt at window start
// ---------------------------------------------------------------------------

/**
 * Send the morning arming prompt to a user.
 *
 * Delivery: web push primary; SMS fallback for the single morning prompt if
 * the user has no active push subscriptions (§1e, §9 d10).
 *
 * Note: the morning VN is always voice regardless of CommStyle (§1d).
 */
export async function sendArmingPrompt(userId: string): Promise<void> {
  const user = await loadArmingUser(userId)
  if (!user) return

  const stakeAmt = user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : 0
  const currency = (user.currency ?? 'GBP') as Currency
  const payload = armingPushTemplates.prompt(stakeAmt, currency)

  // Attempt web push first
  const pushSubs = await prisma.pushSubscription.count({
    where: { userId, isActive: true },
  })

  if (pushSubs > 0) {
    await sendPushToUser(userId, payload)
    logger.info(`Arming prompt (push) sent to user ${userId}`)
    return
  }

  // SMS fallback — morning prompt only (§1e / §9 d10)
  // We only SMS this one touch; reminders + final-notice stay push-only
  // (if they have no push subs at that point, they'll see it in-app when they open it)
  if (user.phone) {
    const name = user.firstName ? ` ${user.firstName}` : ''
    const symbol = CURRENCY_SYMBOL[currency]
    const smsText = stakeAmt > 0
      ? `Morning${name}! Drop your voice note — what's the one thing you're taking on today? Your ${symbol}${stakeAmt} stake is counting on it. Open the app to record: ${process.env.FRONTEND_URL ?? 'https://www.ivykeeps.life'}/daily?action=record`
      : `Morning${name}! Drop your voice note — what's the one thing you're taking on today? Open the app to record: ${process.env.FRONTEND_URL ?? 'https://www.ivykeeps.life'}/daily?action=record`

    await messagingService.sendSMSMessage(userId, smsText, 'reminder')
    logger.info(`Arming prompt (SMS fallback) sent to user ${userId}`)
    return
  }

  // No push, no phone — log and skip (in-app notification visible on open)
  logger.warn(`Arming prompt: no delivery channel available for user ${userId}`)
}

// ---------------------------------------------------------------------------
// Step 2: Loss-framed reminder (~75 min after prompt, if still unarmed)
// ---------------------------------------------------------------------------

/**
 * Send the loss-framed arming reminder.
 * Only fires if the user is still unarmed at this point.
 */
export async function sendArmingReminder(userId: string, date: Date): Promise<void> {
  const workout = await getTodaysWorkout(userId, date)
  if (workout?.armedAt) {
    // Already armed — skip
    logger.info(`Arming reminder skipped for user ${userId} — already armed`)
    return
  }

  const user = await loadArmingUser(userId)
  if (!user) return

  const stakeAmt = user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : 0
  const currency = (user.currency ?? 'GBP') as Currency
  const payload = armingPushTemplates.reminder(stakeAmt, currency)

  await sendPushToUser(userId, payload)
  logger.info(`Arming reminder (push) sent to user ${userId}`)
}

// ---------------------------------------------------------------------------
// Step 3: Final notice (approaching deadline)
// ---------------------------------------------------------------------------

/**
 * Send the final arming notice just before the deadline.
 * Only fires if the user is still unarmed.
 */
export async function sendArmingFinalNotice(userId: string, date: Date): Promise<void> {
  const workout = await getTodaysWorkout(userId, date)
  if (workout?.armedAt) {
    logger.info(`Final notice skipped for user ${userId} — already armed`)
    return
  }

  const user = await loadArmingUser(userId)
  if (!user) return

  const stakeAmt = user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : 0
  const currency = (user.currency ?? 'GBP') as Currency
  const tz = user.timezone ?? 'Europe/London'
  const deadlineStr = user.armingWindowEnd ? formatTime(user.armingWindowEnd, tz) : 'your deadline'

  const payload = armingPushTemplates.finalNotice(stakeAmt, currency, deadlineStr)

  await sendPushToUser(userId, payload)
  logger.info(`Arming final notice (push) sent to user ${userId}`)

  // ── Buddy nudge (free social layer, §4) ─────────────────────────────────
  // Only fires if the user has a pre-consented, active accountability buddy.
  await sendBuddyNudge(userId, user)

  // ── ARMING_CHASE call (opt-in, capped, §5b-i + §9 d4b) ──────────────────
  // We fire the chase call at final-notice time (last meaningful moment before
  // the deadline) so it has the most chance of reaching the user in time.
  if (user.armingChaseEnabled) {
    await maybeDispatchChaseCall(userId, user)
  }
}

// ---------------------------------------------------------------------------
// Step 4: Enforce arming deadline
// ---------------------------------------------------------------------------

/**
 * Called at (or just after) the arming deadline.
 * For each unarmed Workout:
 *   - status → MISSED
 *   - sliceOutcome → FORFEITED
 *
 * No live call is made here — the stake consequence is the enforcement (§4).
 */
export async function enforceArmingDeadline(userId: string, date: Date): Promise<void> {
  const workout = await getTodaysWorkout(userId, date)
  if (!workout) {
    logger.info(`Deadline enforcement: no workout found for user ${userId} on ${date.toDateString()}`)
    return
  }

  if (workout.armedAt) {
    // Armed in time — nothing to enforce
    logger.info(`Deadline: user ${userId} armed in time — no action`)
    return
  }

  if (workout.status === 'MISSED') {
    // Already marked missed
    return
  }

  // Mark as missed and forfeited
  await prisma.workout.update({
    where: { id: workout.id },
    data: {
      status: 'MISSED',
      sliceOutcome: 'FORFEITED',
    },
  })

  // Link the missed slice to the open StakeCycle so it's captured at settlement.
  const { linkWorkoutToCycle } = await import('./stake.service')
  await linkWorkoutToCycle(workout.id, userId).catch((err) =>
    logger.warn(`Deadline: could not link workout ${workout.id} to cycle`, err),
  )

  logger.info(
    `Deadline enforced for user ${userId}: workout ${workout.id} → MISSED / FORFEITED`,
  )
}

// ---------------------------------------------------------------------------
// Buddy nudge helper
// ---------------------------------------------------------------------------

/**
 * Ping the user's accountability buddy (§4 — free social escalation layer).
 * Only sends if the buddy is active and pre-consented.
 * Uses the buddy's email channel (buddyService already handles email/WhatsApp).
 * This is a lightweight nudge — we don't want to spam the buddy.
 */
async function sendBuddyNudge(
  userId: string,
  user: Awaited<ReturnType<typeof loadArmingUser>>,
): Promise<void> {
  if (!user) return
  const buddy = user.accountabilityBuddy
  if (!buddy?.isActive) return

  const name = user.firstName ?? 'your friend'

  // Send an email nudge to the buddy (if they have email)
  if (buddy.buddyEmail) {
    // We re-use the buddy service's email transporter indirectly by firing a message
    // through the nodemailer path. Because buddyService's sendDigest is complex HTML,
    // we craft a direct simple text nudge here via nodemailer config.
    // (buddyService.sendBuddyArmingNudge is added below as a thin wrapper)
    const nodemailer = (await import('nodemailer')).default
    const { config } = await import('../config')

    if (!config.email.smtp.host) {
      logger.warn(`Buddy nudge: SMTP not configured — skipping nudge to ${buddy.buddyEmail}`)
      return
    }

    const transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port || 587,
      secure: config.email.smtp.secure || false,
      auth: config.email.smtp.auth.user
        ? { user: config.email.smtp.auth.user, pass: config.email.smtp.auth.pass }
        : undefined,
    })

    try {
      await transporter.sendMail({
        from: config.email.from,
        to: buddy.buddyEmail,
        subject: `${name} hasn't checked in yet — give them a poke?`,
        text: [
          `Hey ${buddy.buddyName},`,
          '',
          `${name} hasn't recorded their morning voice note yet — their commitment window is closing soon.`,
          '',
          `A quick message might be all they need. You know what to say.`,
          '',
          '— Ivy',
        ].join('\n'),
      })
      logger.info(`Buddy nudge email sent to ${buddy.buddyEmail} for user ${userId}`)
    } catch (err) {
      logger.error(`Buddy nudge email failed for user ${userId}:`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// ARMING_CHASE call helper
// ---------------------------------------------------------------------------

/**
 * Fire an ARMING_CHASE live call if the user is opt-in and under the monthly cap.
 *
 * Cap rule (§9 d4b): max 8 chase calls per user per calendar month.
 * The cap resets at the start of each calendar month.
 */
async function maybeDispatchChaseCall(
  userId: string,
  user: Awaited<ReturnType<typeof loadArmingUser>>,
): Promise<void> {
  if (!user) return
  if (!user.armingChaseEnabled) return

  // Reset cap if month rolled over
  const currentCount = await ensureChaseCap(
    userId,
    user.chaseCallsThisMonth,
    user.chaseCapMonthStart,
  )

  if (currentCount >= ARMING_CHASE_MONTHLY_CAP) {
    logger.info(
      `ARMING_CHASE skipped for user ${userId}: monthly cap reached ` +
      `(${currentCount}/${ARMING_CHASE_MONTHLY_CAP})`,
    )
    return
  }

  // Schedule the ARMING_CHASE call (2 minutes out, like rescue calls)
  const scheduledAt = new Date(Date.now() + 2 * 60 * 1000)
  try {
    await callService.scheduleCall(userId, 'ARMING_CHASE', scheduledAt, {
      chase_reason: 'unarmed_near_deadline',
      stake_amount: user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : 0,
      currency: user.currency ?? 'GBP',
    })

    // Increment the monthly counter.
    // Cast to any: Phase 3 schema fields pending `prisma generate`.
    await (prisma.user as any).update({
      where: { id: userId },
      data: {
        chaseCallsThisMonth: { increment: 1 },
        chaseCapMonthStart: user.chaseCapMonthStart ?? new Date(),
      },
    })

    logger.info(
      `ARMING_CHASE scheduled for user ${userId} ` +
      `(${currentCount + 1}/${ARMING_CHASE_MONTHLY_CAP} this month)`,
    )
  } catch (err) {
    // Non-fatal: daily call cap may already be reached — log and continue
    logger.warn(`ARMING_CHASE scheduling failed for user ${userId}:`, err)
  }
}

// ---------------------------------------------------------------------------
// Scheduler entry-point — called by worker.ts crons
// ---------------------------------------------------------------------------

/**
 * Run the arming schedule for all active, onboarded, paid users for a given date.
 *
 * Called at multiple times by the worker:
 *   - At the user's armingWindowStart      → sendArmingPrompt
 *   - ~75 min after armingWindowStart      → sendArmingReminder (if unarmed)
 *   - ~15 min before armingWindowEnd       → sendArmingFinalNotice (if unarmed)
 *   - At armingWindowEnd                   → enforceArmingDeadline
 *
 * Because users have different arming windows and timezones, the crons run
 * frequently (every 15 minutes) and this function checks whether each user's
 * relevant moment has arrived. This avoids per-user delayed queuing complexity.
 *
 * The stage parameter drives which action to fire for users whose window
 * matches the current moment within a ±7.5-minute tolerance (half the poll
 * interval — so every integer-minute window matches exactly one poll: no user
 * is skipped, and no window lands within tolerance of two consecutive polls).
 */
export type ArmingStage = 'PROMPT' | 'REMINDER' | 'FINAL_NOTICE' | 'DEADLINE'

export async function runArmingForStage(stage: ArmingStage, now: Date): Promise<void> {
  const TOLERANCE_MS = 7.5 * 60 * 1000 // ±7.5 min match window (half the 15-min poll interval)

  // Load all active, onboarded, paid users who have arming windows configured
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      isOnboarded: true,
      subscriptionTier: { notIn: ['FREE', 'COACH'] },
      armingWindowStart: { not: null },
      armingWindowEnd: { not: null },
    },
    select: {
      id: true,
      timezone: true,
      armingWindowStart: true,
      armingWindowEnd: true,
    },
  })

  let actioned = 0

  for (const user of users) {
    try {
      const tz = user.timezone ?? 'Europe/London'
      const windowStart = toUTCOnDay(user.armingWindowStart!, tz, now)
      const windowEnd = toUTCOnDay(user.armingWindowEnd!, tz, now)
      const reminderTime = new Date(windowStart.getTime() + REMINDER_DELAY_MINS * 60 * 1000)
      // Final notice fires 15 minutes before the deadline
      const finalNoticeTime = new Date(windowEnd.getTime() - 15 * 60 * 1000)

      let targetTime: Date
      switch (stage) {
        case 'PROMPT':       targetTime = windowStart;    break
        case 'REMINDER':     targetTime = reminderTime;   break
        case 'FINAL_NOTICE': targetTime = finalNoticeTime; break
        case 'DEADLINE':     targetTime = windowEnd;       break
      }

      const delta = Math.abs(now.getTime() - targetTime.getTime())
      if (delta > TOLERANCE_MS) continue

      // This user's moment has arrived — fire the action
      switch (stage) {
        case 'PROMPT':
          await sendArmingPrompt(user.id)
          break
        case 'REMINDER':
          await sendArmingReminder(user.id, now)
          break
        case 'FINAL_NOTICE':
          await sendArmingFinalNotice(user.id, now)
          break
        case 'DEADLINE':
          await enforceArmingDeadline(user.id, now)
          break
      }

      actioned++
    } catch (err) {
      logger.warn(`Arming stage ${stage} error for user ${user.id}:`, err)
    }
  }

  logger.info(`Arming stage ${stage} complete — actioned ${actioned}/${users.length} users`)
}

// ---------------------------------------------------------------------------
// Stake cycle cron helpers (called by worker.ts)
// ---------------------------------------------------------------------------

/**
 * Open a new StakeCycle for users whose weekly cycle starts today.
 *
 * Called at cycle start (Monday 00:05 UTC by default).
 * Uses openStakeCycle from stake.service — that function handles all guards
 * (min stake, no duplicate open cycle, Stripe PI creation).
 *
 * SAFETY: Stripe PaymentIntent creation happens inside openStakeCycle.
 * Tests must mock stake.service to avoid real network calls.
 */
export async function openStakeCyclesForActiveUsers(): Promise<void> {
  const { openStakeCycle } = await import('./stake.service')

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      isOnboarded: true,
      subscriptionTier: { notIn: ['FREE', 'COACH'] },
      stakeWeeklyAmount: { not: null },
    },
    select: { id: true },
  })

  let opened = 0
  let skipped = 0

  for (const user of users) {
    try {
      await openStakeCycle(user.id)
      opened++
    } catch (err: any) {
      // "already has an open cycle" is expected on re-run / server restart — not an error
      if (err?.message?.includes('already has an open stake cycle')) {
        skipped++
      } else {
        logger.warn(`openStakeCycle failed for user ${user.id}:`, err)
        skipped++
      }
    }
  }

  logger.info(`StakeCycle open run: opened=${opened}, skipped/errored=${skipped}`)
}

/**
 * Settle all StakeCycles whose periodEnd has passed and which are still AUTHORIZED.
 *
 * Called at end of cycle (Sunday 23:55 UTC by default).
 * settleStakeCycle handles Stripe capture + Donation creation + dispatch.
 */
export async function settleExpiredStakeCycles(): Promise<void> {
  const { settleStakeCycle } = await import('./stake.service')

  const overdueCycles = await prisma.stakeCycle.findMany({
    where: {
      status: 'AUTHORIZED',
      periodEnd: { lte: new Date() },
    },
    select: { id: true, userId: true },
  })

  let settled = 0
  let failed = 0

  for (const cycle of overdueCycles) {
    try {
      await settleStakeCycle(cycle.id)
      settled++
    } catch (err) {
      logger.error(`settleStakeCycle failed for cycle ${cycle.id} (user ${cycle.userId}):`, err)
      failed++
    }
  }

  logger.info(`StakeCycle settle run: settled=${settled}, failed=${failed}`)
}
