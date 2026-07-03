/**
 * Stake Service — Phase 2 of product-pricing-rework.md
 *
 * Implements the Stripe auth-and-capture commitment-device money engine:
 *
 *   openStakeCycle(userId)   → authorise full weekly stake (no capture yet)
 *   settleStakeCycle(cycleId) → at period end, capture only forfeited slices,
 *                               release/void the rest, dispatch forfeit donations
 *
 * NON-NEGOTIABLE GUARDRAILS (§7, enforced here and tested in stake.service.test.ts):
 *   G1 — Forfeited money NEVER touches Ivy's P&L; always routed to charity.
 *   G2 — Released slices are NEVER captured.
 *   G3 — MIDDLE mode routes to a `Charity.isHouseDefault` charity only.
 *   G4 — SAVAGE mode routes to `user.dislikedCharityId` only.
 *   G5 — Grace skip suppresses exactly one forfeit per cycle; graceUsed is bounded.
 *   G6 — The stake is pass-through — never recognised as Ivy revenue.
 *
 * SAFETY: this file makes real Stripe SDK calls. Unit tests must mock Stripe
 * entirely (no network). Do NOT run settleStakeCycle against production until
 * the money-flow review checkpoint is cleared (§ Phase 2 ✋).
 */

import Stripe from 'stripe'
import { startOfDay, endOfDay, startOfWeek, addDays, isSameDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { Decimal } from '@prisma/client/runtime/library'
import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { BadRequestError, NotFoundError } from '../utils/errors'
import { STAKE_CONFIG, GRACE_SKIPS_PER_CYCLE, type Currency } from '../config/pricing'
import { dispatchPendingDonationsForUser } from './every-org.service'
import type { ForfeitMode, StakeCycleStatus, SliceOutcome } from '@prisma/client'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new BadRequestError('Stripe not configured')
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

/**
 * Return stake amount in the smallest currency unit (pence / cents) for Stripe.
 * Stripe requires integer minor units — we round to avoid fp drift.
 * currency is accepted for future per-currency decimal rules (currently all are 2dp).
 */
function toMinorUnits(amount: number | Decimal, _currency: Currency): number {
  return Math.round(Number(amount) * 100)
}

/**
 * Resolve the customer's saved default card so we can place the stake hold
 * off-session (no checkout redirect). Subscription checkout already saves a
 * reusable card to the Stripe customer, so subscribers have one.
 *
 * Order: invoice_settings.default_payment_method → first listed card PM.
 * Returns null if the customer has no saved card at all.
 */
async function resolveDefaultPaymentMethod(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer && !(customer as Stripe.DeletedCustomer).deleted) {
    const dpm = (customer as Stripe.Customer).invoice_settings?.default_payment_method
    if (dpm) return typeof dpm === 'string' ? dpm : dpm.id
  }
  const pms = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  })
  return pms.data[0]?.id ?? null
}

/**
 * Record a FAILED stake cycle and nudge the user to re-authorise when the
 * off-session auth hold can't be placed (declined card, or SCA / 3DS required
 * which off_session confirm cannot complete unattended).
 *
 * There is no PENDING_ACTION StakeCycleStatus, so we use FAILED — the
 * duplicate-open-cycle guard only blocks AUTHORIZED cycles, so a FAILED record
 * never blocks next week's retry and is never settled. Always throws.
 */
async function recordFailedHoldAndNotify(
  userId: string,
  stakeAmount: number,
  paymentIntentId: string | null,
  reason: string,
): Promise<never> {
  const now = new Date()
  const periodEnd = new Date(now.getTime() + STAKE_CONFIG.cycleDays * 24 * 60 * 60 * 1000)
  try {
    await prisma.stakeCycle.create({
      data: {
        userId,
        periodStart: now,
        periodEnd,
        stakeAmount,
        stripePaymentIntentId: paymentIntentId,
        capturedAmount: 0,
        status: 'FAILED',
        daysArmed: 0,
        daysCompleted: 0,
        daysForfeited: 0,
        graceUsed: 0,
      },
    })
  } catch (e) {
    logger.error(`Could not record FAILED stake cycle for user ${userId}`, e)
  }

  // Re-auth nudge — non-blocking; failure to notify must not mask the real error.
  try {
    const { default: messagingService } = await import('./messaging.service')
    await messagingService.sendMessage(
      userId,
      "We couldn't set up your weekly stake hold — your card needs re-authorising. " +
      'Open Ivy to confirm it so your commitment is active this week.',
      'nudge',
    )
  } catch (e) {
    logger.warn(`Could not notify user ${userId} of stake hold failure`, e)
  }

  throw new BadRequestError(`Stake auth hold failed for user ${userId}: ${reason}`)
}

/**
 * Resolve the forfeit charity for a user based on their ForfeitMode.
 *
 * MIDDLE → must be a Charity with isHouseDefault = true   (G3)
 * SAVAGE → must be the user's dislikedCharityId           (G4)
 *
 * Throws if the required charity is missing (setup incomplete).
 */
async function resolveForfeitCharity(
  _userId: string,
  forfeitMode: ForfeitMode,
  dislikedCharityId: string | null,
): Promise<string> {
  if (forfeitMode === 'SAVAGE') {
    if (!dislikedCharityId) {
      throw new BadRequestError(
        'SAVAGE forfeit mode requires a dislikedCharityId — user setup incomplete'
      )
    }
    // Verify the charity exists and is active
    const charity = await prisma.charity.findUnique({
      where: { id: dislikedCharityId },
      select: { id: true, isActive: true },
    })
    if (!charity || !charity.isActive) {
      throw new NotFoundError(
        `Savage anti-charity ${dislikedCharityId} not found or inactive`
      )
    }
    return dislikedCharityId
  }

  // MIDDLE — pick the house default charity (G3: NEVER user's own chosen charity)
  const houseCharity = await prisma.charity.findFirst({
    where: { isHouseDefault: true, isActive: true },
    select: { id: true },
  })
  if (!houseCharity) {
    throw new NotFoundError(
      'No house-default charity configured — cannot route MIDDLE forfeit. ' +
      'Set Charity.isHouseDefault = true on at least one active charity.'
    )
  }
  return houseCharity.id
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OpenStakeCycleResult {
  cycleId: string
  paymentIntentId: string
  stakeAmount: number
  currency: string
  periodStart: Date
  periodEnd: Date
}

/**
 * openStakeCycle — authorise the user's weekly stake on Stripe.
 *
 * Creates a PaymentIntent with capture_method: 'manual' so the full weekly
 * stake is earmarked (visible to the user as "£X on the line") without
 * capturing a penny.  A StakeCycle record is persisted with status AUTHORIZED.
 *
 * Guards:
 *  - stakeWeeklyAmount must be set and >= minWeeklyStake for their currency (§9 d2).
 *  - User must have a Stripe customer ID (subscription checkout creates this).
 *  - No AUTHORIZED cycle may already be open for this user.
 *
 * Does NOT move money.  Capture only happens in settleStakeCycle().
 */
export async function openStakeCycle(userId: string): Promise<OpenStakeCycleResult> {
  // ── Load stake config + enforce minimum (§9 decision 2) ───────────────────
  // Guard is in the service, not the controller, so it applies at every entry point.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, currency: true, stakeWeeklyAmount: true },
  })
  if (!user) throw new NotFoundError('User not found')

  const currency = (user.currency ?? 'GBP') as Currency
  const stakeAmount = user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : null
  const minStake = STAKE_CONFIG.minWeeklyStake[currency]
  if (stakeAmount === null || stakeAmount < minStake) {
    throw new BadRequestError(
      `Stake amount must be at least ${currency === 'GBP' ? '£' : '$'}${minStake}/week ` +
      `(§9 decision 2). Got: ${stakeAmount ?? 'not set'}`
    )
  }

  const now = new Date()
  const periodEnd = new Date(now.getTime() + STAKE_CONFIG.cycleDays * 24 * 60 * 60 * 1000)
  return placeHoldAndCreateCycle(userId, {
    stakeAmount,
    periodStart: now,
    periodEnd,
    daysInCycle: STAKE_CONFIG.cycleDays,
    isFoundation: false,
    descriptionLabel: 'weekly stake',
  })
}

// ---------------------------------------------------------------------------
// Foundation Run — a brand-new user's FIRST cycle, at a flat low starter stake.
// See docs/foundation-run-and-day-zero.md.
// ---------------------------------------------------------------------------

const ISO_DAY: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
}

/** Add `days` to a YYYY-MM-DD string, returning a YYYY-MM-DD string (UTC-safe). */
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * computeFoundationWindow — the mid-week Foundation Run window for a signup.
 *
 * No teeth on signup day: forfeitable days start TOMORROW (day 1) in the user's
 * timezone and run to the coming Sunday 23:59. Returns null when too few days
 * remain (< minFoundationDays, i.e. a Sat/Sun signup) — the caller should defer
 * to the Monday opener, which opens the Foundation Run as the next full week.
 */
export function computeFoundationWindow(
  tz: string,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date; daysInCycle: number } | null {
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase()
  const isoDay = ISO_DAY[weekday] ?? 1
  const forfeitableDays = 7 - isoDay // day1..coming-Sunday inclusive; 0 if today is Sunday
  if (forfeitableDays < STAKE_CONFIG.minFoundationDays) return null

  const day1Str = addDaysToDateStr(todayStr, 1)
  const sundayStr = addDaysToDateStr(todayStr, forfeitableDays)
  return {
    periodStart: fromZonedTime(`${day1Str}T00:00:00`, tz),
    periodEnd: fromZonedTime(`${sundayStr}T23:59:59`, tz),
    daysInCycle: forfeitableDays,
  }
}

/**
 * openFoundationCycle — open a brand-new user's FIRST cycle at the flat starter
 * stake (STAKE_CONFIG.foundationFlatAmount — NOT the user's weekly amount, NOT
 * prorated). `window` defaults to a full 7-day run from now (the Monday-opener
 * path for Sat/Sun signups); pass an explicit window for the mid-week path.
 *
 * Never longer than 7 days, so the Stripe auth hold (~7-day expiry) always fits.
 */
export async function openFoundationCycle(
  userId: string,
  window?: { periodStart: Date; periodEnd: Date; daysInCycle: number },
): Promise<OpenStakeCycleResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, currency: true },
  })
  if (!user) throw new NotFoundError('User not found')
  const currency = (user.currency ?? 'GBP') as Currency
  const flat = STAKE_CONFIG.foundationFlatAmount[currency]

  const now = new Date()
  const win = window ?? {
    periodStart: now,
    periodEnd: new Date(now.getTime() + STAKE_CONFIG.cycleDays * 24 * 60 * 60 * 1000),
    daysInCycle: STAKE_CONFIG.cycleDays,
  }

  return placeHoldAndCreateCycle(userId, {
    stakeAmount: flat,
    periodStart: win.periodStart,
    periodEnd: win.periodEnd,
    daysInCycle: win.daysInCycle,
    isFoundation: true,
    descriptionLabel: 'first run',
  })
}

// ---------------------------------------------------------------------------

interface PlaceHoldParams {
  stakeAmount: number
  periodStart: Date
  periodEnd: Date
  daysInCycle: number
  isFoundation: boolean
  /** Human label for the Stripe PI description, e.g. 'weekly stake' / 'first run'. */
  descriptionLabel: string
}

/**
 * placeHoldAndCreateCycle — shared core for openStakeCycle / openFoundationCycle.
 *
 * Places the off-session manual-capture auth hold and persists the StakeCycle.
 * Does NOT move money (G2, G6). Caller supplies the amount, window, and flags;
 * the min-stake guard and amount resolution live in the callers.
 */
async function placeHoldAndCreateCycle(
  userId: string,
  params: PlaceHoldParams,
): Promise<OpenStakeCycleResult> {
  const stripe = getStripe()
  const { stakeAmount, periodStart, periodEnd, daysInCycle, isFoundation, descriptionLabel } = params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, currency: true, stripeCustomerId: true },
  })
  if (!user) throw new NotFoundError('User not found')
  const currency = (user.currency ?? 'GBP') as Currency

  // ── Guard: no overlapping open cycle ──────────────────────────────────────
  const existingOpen = await prisma.stakeCycle.findFirst({
    where: { userId, status: 'AUTHORIZED' },
    select: { id: true },
  })
  if (existingOpen) {
    throw new BadRequestError(
      `User ${userId} already has an open stake cycle (${existingOpen.id}). ` +
      'Settle or void it before opening a new one.'
    )
  }

  // ── Stripe: create or retrieve customer ───────────────────────────────────
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.firstName,
      metadata: { userId },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  // ── Resolve the saved card to place the hold against ──────────────────────
  // The stake hold is placed off-session (no checkout redirect) against the
  // card the user saved at subscription checkout. Without one we cannot hold.
  const paymentMethodId = await resolveDefaultPaymentMethod(stripe, customerId)
  if (!paymentMethodId) {
    throw new BadRequestError(
      `User ${userId} has no saved payment method — cannot place a stake hold. ` +
      'They must add a card (subscription checkout saves one) before staking.'
    )
  }

  // ── Stripe: create + confirm a manual-capture PaymentIntent off-session ────
  // capture_method: 'manual' + confirm + off_session → the stake is EARMARKED as
  // a real auth hold but NOT moved (G2, G6). On success the intent sits in
  // 'requires_capture' until settleStakeCycle() captures forfeits.
  let paymentIntent: Stripe.PaymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorUnits(stakeAmount, currency),
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method: paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      off_session: true, // unattended — fails fast if the card needs SCA/3DS
      metadata: {
        userId,
        purpose: isFoundation ? 'stake_cycle_foundation' : 'stake_cycle',
        // Guardrail audit trail — recorded so Stripe dashboard shows this is pass-through
        guardrail: 'PASS_THROUGH_NOT_IVY_REVENUE',
      },
      description: `Ivy ${descriptionLabel} — ${user.firstName} — ${currency} ${stakeAmount.toFixed(2)}`,
    })
  } catch (err) {
    // Off-session confirm failed — typically authentication_required (SCA) or a
    // declined card. Stripe attaches the PI to the error; record it + nudge.
    const piFromErr =
      (err as any)?.payment_intent?.id ?? (err as any)?.raw?.payment_intent?.id ?? null
    return await recordFailedHoldAndNotify(
      userId,
      stakeAmount,
      piFromErr,
      (err as any)?.message ?? 'unknown Stripe error',
    )
  }

  // A successful manual-capture off-session confirm lands in 'requires_capture'.
  // Anything else (e.g. requires_action) means the hold is NOT actually placed.
  if (paymentIntent.status !== 'requires_capture') {
    return await recordFailedHoldAndNotify(
      userId,
      stakeAmount,
      paymentIntent.id,
      `unexpected PaymentIntent status '${paymentIntent.status}' (expected requires_capture)`,
    )
  }

  // ── DB: persist StakeCycle ────────────────────────────────────────────────
  const cycle = await prisma.stakeCycle.create({
    data: {
      userId,
      periodStart,
      periodEnd,
      stakeAmount,
      stripePaymentIntentId: paymentIntent.id,
      capturedAmount: 0,
      status: 'AUTHORIZED',
      isFoundation,
      daysInCycle,
      daysArmed: 0,
      daysCompleted: 0,
      daysForfeited: 0,
      graceUsed: 0,
    },
  })

  logger.info(
    `StakeCycle opened${isFoundation ? ' (FOUNDATION)' : ''}: ${cycle.id} | user=${userId} | ` +
    `amount=${currency} ${stakeAmount} | days=${daysInCycle} | pi=${paymentIntent.id}`
  )

  return {
    cycleId: cycle.id,
    paymentIntentId: paymentIntent.id,
    stakeAmount,
    currency,
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
  }
}

// ---------------------------------------------------------------------------

/**
 * linkWorkoutToCycle — attach a solo workout to the user's currently-open
 * StakeCycle so its slice is counted at settlement.
 *
 * Solo (non-circle) workouts are created without a stakeCycleId; without this
 * link settleStakeCycle() sees an empty workouts relation and releases the
 * entire hold regardless of misses. Idempotent: no-op if already linked, if
 * there is no open cycle, or if the workout falls outside the cycle period.
 *
 * Called at arm time, at deadline enforcement, and on completion — wherever a
 * day's outcome is first resolved.
 */
export async function linkWorkoutToCycle(workoutId: string, userId: string): Promise<void> {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { id: true, plannedDate: true, stakeCycleId: true },
  })
  if (!workout || workout.stakeCycleId) return // already linked or gone

  // Exactly one AUTHORIZED cycle exists per user at a time (guarded in openStakeCycle).
  const cycle = await prisma.stakeCycle.findFirst({
    where: { userId, status: 'AUTHORIZED' },
    select: { id: true, stakeAmount: true, periodEnd: true, daysInCycle: true },
  })
  if (!cycle) return

  // Don't link a workout planned beyond this cycle's window (e.g. next week).
  if (workout.plannedDate > cycle.periodEnd) return

  // Slice is the held amount over THIS cycle's day count (foundation runs are
  // often <7 days), not the global weekly cycleDays, so slices sum to the hold.
  const slice = Math.round((Number(cycle.stakeAmount) / cycle.daysInCycle) * 100) / 100
  await prisma.workout.update({
    where: { id: workout.id },
    data: { stakeCycleId: cycle.id, stakeSliceAmount: slice },
  })
  logger.info(`Linked workout ${workout.id} → stakeCycle ${cycle.id} (slice ${slice})`)
}

// ---------------------------------------------------------------------------

export interface SettleStakeCycleResult {
  cycleId: string
  capturedAmount: number
  releasedAmount: number
  forfeitDonationIds: string[]
  status: StakeCycleStatus
}

/**
 * settleStakeCycle — end-of-period settlement.
 *
 * Workflow:
 *  1. Load cycle + associated Workout slices.
 *  2. Apply grace: the first unarmed/forfeited day within the grace allowance
 *     flips to RELEASED (G5: exactly one grace per cycle).
 *  3. Sum forfeited slices.
 *  4. If captureAmount > 0: call stripe.paymentIntents.capture(partialAmount).
 *     If captureAmount == 0: call stripe.paymentIntents.cancel() (all released).
 *  5. Create Donation records for forfeited amount → correct charity (G1, G3, G4).
 *  6. Dispatch donations via the existing every-org path.
 *  7. Update cycle status → SETTLED, capturedAmount.
 *
 * GUARDRAILS enforced:
 *  G1 — captured amount goes to charity Donation; never to an Ivy account.
 *  G2 — released slices are explicitly excluded from the Stripe capture call.
 *  G3/G4 — charity routing goes through resolveForfeitCharity().
 *  G5 — graceUsed is capped at GRACE_SKIPS_PER_CYCLE; excess forfeits are not waived.
 *  G6 — Donation.source = USER_STAKE, donationType = STAKE_FORFEIT; amount never
 *       credited to Ivy's own account.
 */
export async function settleStakeCycle(cycleId: string): Promise<SettleStakeCycleResult> {
  const stripe = getStripe()

  // ── Load cycle ─────────────────────────────────────────────────────────────
  const cycle = await prisma.stakeCycle.findUnique({
    where: { id: cycleId },
    include: {
      workouts: {
        select: {
          id: true,
          sliceOutcome: true,
          stakeSliceAmount: true,
          stakeCycleId: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          currency: true,
          forfeitMode: true,
          dislikedCharityId: true,
        },
      },
    },
  })

  if (!cycle) throw new NotFoundError(`StakeCycle ${cycleId} not found`)
  if (cycle.status !== 'AUTHORIZED') {
    throw new BadRequestError(
      `StakeCycle ${cycleId} is not in AUTHORIZED status (current: ${cycle.status}). ` +
      'Cannot settle a cycle that is already settled, voided, or failed.'
    )
  }
  if (!cycle.stripePaymentIntentId) {
    throw new BadRequestError(`StakeCycle ${cycleId} has no Stripe PaymentIntent — cannot settle`)
  }

  const currency = (cycle.user.currency ?? 'GBP') as Currency

  // ── Belt-and-suspenders: sweep up any unlinked same-period workouts ─────────
  // The arm/deadline/complete paths link each day's workout to the cycle, but if
  // any slipped through (created before linking shipped, or a race), catch them
  // here by date range so settlement reflects every day of the week — otherwise
  // an unlinked miss would be silently released. Use startOfDay(periodStart) so
  // the cycle's own opening day (cycle opens minutes after midnight) is included.
  const sliceForSweep =
    Math.round((Number(cycle.stakeAmount) / cycle.daysInCycle) * 100) / 100
  const unlinked = await prisma.workout.findMany({
    where: {
      userId: cycle.userId,
      stakeCycleId: null,
      plannedDate: { gte: startOfDay(cycle.periodStart), lte: cycle.periodEnd },
    },
    select: { id: true, sliceOutcome: true, stakeSliceAmount: true, stakeCycleId: true },
  })
  if (unlinked.length > 0) {
    await prisma.workout.updateMany({
      where: { id: { in: unlinked.map((w) => w.id) } },
      data: { stakeCycleId: cycleId, stakeSliceAmount: sliceForSweep },
    })
    logger.info(`StakeCycle ${cycleId}: swept ${unlinked.length} unlinked workout(s) into settlement`)
  }
  const allWorkouts = [...cycle.workouts, ...unlinked]

  // ── Apply grace (G5) ───────────────────────────────────────────────────────
  // Identify workouts that were forfeited (FORFEITED or still PENDING = unarmed miss).
  // We treat PENDING as a forfeit at settlement time — any slice not explicitly RELEASED
  // or granted grace is captured.
  const forfeitable = allWorkouts.filter(
    (w) => w.sliceOutcome === 'FORFEITED' || w.sliceOutcome === 'PENDING'
  )
  const alreadyGraceUsed = cycle.graceUsed
  const maxGrace = GRACE_SKIPS_PER_CYCLE

  // Collect IDs of workouts that will receive grace (suppresses exactly one forfeit)
  const graceAppliedTo: string[] = []
  let graceRemaining = Math.max(0, maxGrace - alreadyGraceUsed)
  const toForfeit: typeof forfeitable = []

  for (const w of forfeitable) {
    if (graceRemaining > 0) {
      graceAppliedTo.push(w.id)
      graceRemaining--
    } else {
      toForfeit.push(w)
    }
  }

  // ── Calculate amounts ─────────────────────────────────────────────────────
  // Sum forfeited slice amounts. If stakeSliceAmount is null, fall back to the
  // held amount over this cycle's own day count (foundation runs are <7 days).
  const dailySlice = Number(cycle.stakeAmount) / cycle.daysInCycle

  const captureAmountDecimal = toForfeit.reduce(
    (sum, w) => sum + (w.stakeSliceAmount ? Number(w.stakeSliceAmount) : dailySlice),
    0
  )
  // Round to 2dp to avoid Stripe minor-unit rounding errors
  const captureAmount = Math.round(captureAmountDecimal * 100) / 100
  const totalAuthorised = Number(cycle.stakeAmount)
  const releaseAmount = Math.round((totalAuthorised - captureAmount) * 100) / 100

  logger.info(
    `StakeCycle settle: ${cycleId} | forfeit=${captureAmount} ${currency} | ` +
    `release=${releaseAmount} ${currency} | graceApplied=${graceAppliedTo.length}`
  )

  // ── Resolve forfeit charity (G3/G4) ───────────────────────────────────────
  const forfeitCharityId = await resolveForfeitCharity(
    cycle.userId,
    cycle.user.forfeitMode,
    cycle.user.dislikedCharityId,
  )

  // ── Stripe: capture or cancel ─────────────────────────────────────────────
  //
  // G2 GUARDRAIL — released slices are NEVER captured.
  // We only call capture() for the sum of forfeited slices; the remainder is
  // released implicitly when the PaymentIntent is cancelled or by Stripe when
  // a partial capture is used (the uncaptured portion is automatically released).
  //
  // Stripe partial capture: pass `amount_to_capture` = forfeited minor units.
  // If captureAmount === 0, cancel the whole intent (everything released).

  let stripeStatus: string

  if (captureAmount === 0) {
    // All days succeeded / graced — void the whole auth; nothing captured (G2)
    await stripe.paymentIntents.cancel(cycle.stripePaymentIntentId)
    stripeStatus = 'cancelled'
    logger.info(`StakeCycle ${cycleId}: full release — PI cancelled (no capture)`)
  } else {
    // Partial or full capture — only forfeited amount; released amount is auto-released
    const captureMinorUnits = toMinorUnits(captureAmount, currency)
    await stripe.paymentIntents.capture(cycle.stripePaymentIntentId, {
      amount_to_capture: captureMinorUnits,
    })
    stripeStatus = 'captured'
    logger.info(
      `StakeCycle ${cycleId}: captured ${captureAmount} ${currency} ` +
      `(${captureMinorUnits} minor units) — ${releaseAmount} ${currency} auto-released`
    )
  }

  // ── DB: update workout slice outcomes ─────────────────────────────────────
  // Grace workouts → RELEASED; outstanding forfeits → FORFEITED; already RELEASED → unchanged.

  if (graceAppliedTo.length > 0) {
    await prisma.workout.updateMany({
      where: { id: { in: graceAppliedTo } },
      data: { sliceOutcome: 'RELEASED' as SliceOutcome },
    })
  }

  if (toForfeit.length > 0) {
    await prisma.workout.updateMany({
      where: { id: { in: toForfeit.map((w) => w.id) } },
      data: { sliceOutcome: 'FORFEITED' as SliceOutcome },
    })
  }

  // ── DB: create Donation records for forfeited amount (G1, G6) ─────────────
  //
  // G1 GUARDRAIL — money goes to charity, never to an Ivy-owned account.
  // G6 GUARDRAIL — source=USER_STAKE, donationType=STAKE_FORFEIT so it is
  //               identifiable in audit as pass-through, never Ivy revenue.
  //
  // One Donation record per forfeited workout (slice-level audit trail).
  const forfeitDonationIds: string[] = []

  if (toForfeit.length > 0) {
    for (const w of toForfeit) {
      const sliceAmt = w.stakeSliceAmount ? Number(w.stakeSliceAmount) : dailySlice
      const donation = await prisma.donation.create({
        data: {
          userId: cycle.userId,
          charityId: forfeitCharityId,
          amount: Math.round(sliceAmt * 100) / 100,
          currency: cycle.user.currency ?? 'GBP',
          donationType: 'STAKE_FORFEIT',
          source: 'USER_STAKE',          // G6: pass-through flag
          stakeCycleId: cycleId,
          workoutId: w.id,
          dispatchStatus: 'PENDING',
        },
      })
      forfeitDonationIds.push(donation.id)
    }

    // Dispatch via the existing every-org path — non-blocking; failure logged, not fatal
    dispatchPendingDonationsForUser(cycle.userId).catch((err) =>
      logger.error(`StakeCycle ${cycleId}: every-org dispatch failed`, err)
    )
  }

  // ── DB: update StakeCycle ─────────────────────────────────────────────────
  const newGraceUsed = alreadyGraceUsed + graceAppliedTo.length
  const updatedCycle = await prisma.stakeCycle.update({
    where: { id: cycleId },
    data: {
      status: 'SETTLED',
      capturedAmount: captureAmount,
      daysForfeited: toForfeit.length,
      graceUsed: newGraceUsed,
    },
  })

  // ── The settlement voice ────────────────────────────────────────────────
  // The week's money just moved — the single most emotionally-charged moment
  // in the product. Tell the user the story in chat the second it happens;
  // the vine on home tells it visually. Fire-and-forget: a chat failure must
  // never fail a settlement.
  ;(async () => {
    const s = currency === 'GBP' ? '£' : '$'
    const keptDays = cycle.daysInCycle - toForfeit.length
    const graceNote = graceAppliedTo.length > 0
      ? ` Your grace day covered one miss — no charge for it.`
      : ''
    let story: string
    if (captureAmount === 0) {
      story =
        `Your week just settled. ${keptDays} of ${cycle.daysInCycle} days kept — a clean run. ` +
        `Your ${s}${totalAuthorised} is back where it belongs, all of it.${graceNote} ` +
        `That's ${keptDays} ${keptDays === 1 ? 'leaf' : 'leaves'} on the vine. New cycle opens Monday.`
    } else {
      const charity = await prisma.charity.findUnique({
        where: { id: forfeitCharityId },
        select: { name: true },
      })
      story =
        `Your week just settled. ${keptDays} of ${cycle.daysInCycle} days kept — ${s}${releaseAmount} back where it belongs. ` +
        `The ${toForfeit.length} missed ${toForfeit.length === 1 ? 'day' : 'days'} sent ${s}${captureAmount} to ${charity?.name ?? 'charity'} — real money, doing real good, just not the way you wanted.${graceNote} ` +
        `New cycle opens Monday. Fresh vine.`
    }
    const { default: chatService } = await import('./chat.service')
    await chatService.postIvyMessage(cycle.userId, story, {
      messageType: 'settlement',
      notify: true,
    })
  })().catch((err) => logger.warn(`StakeCycle ${cycleId}: settlement chat message failed`, err))

  logger.info(
    `StakeCycle ${cycleId} settled | status=SETTLED | ` +
    `captured=${updatedCycle.capturedAmount} | charity=${forfeitCharityId} | ` +
    `forfeitMode=${cycle.user.forfeitMode} | stripeAction=${stripeStatus}`
  )

  return {
    cycleId,
    capturedAmount: captureAmount,
    releasedAmount: releaseAmount,
    forfeitDonationIds,
    status: 'SETTLED',
  }
}

// ---------------------------------------------------------------------------
// Webhook handlers — called from webhook.controller.ts
// ---------------------------------------------------------------------------

/**
 * handlePaymentIntentSucceeded — fires when the user confirms the PaymentIntent
 * (i.e., the card auth hold is placed successfully).
 *
 * Updates StakeCycle status from a transient pre-auth state → AUTHORIZED
 * (it may already be AUTHORIZED if the DB write raced ahead of the webhook).
 */
export async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const cycle = await prisma.stakeCycle.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { id: true, status: true },
  })

  if (!cycle) {
    // Not a stake cycle PI — ignore (could be a subscription payment)
    return
  }

  if (cycle.status !== 'AUTHORIZED') {
    await prisma.stakeCycle.update({
      where: { id: cycle.id },
      data: { status: 'AUTHORIZED' },
    })
    logger.info(`StakeCycle ${cycle.id}: PI ${paymentIntent.id} confirmed → AUTHORIZED`)
  }
}

/**
 * handlePaymentIntentCanceled — fires if the auth was cancelled before confirmation
 * or if we called stripe.paymentIntents.cancel() during a full-release settlement.
 *
 * On settlement cancel (all slices released): cycle is already SETTLED — no-op.
 * On pre-settlement cancel (e.g. user withdrew): mark cycle VOIDED.
 */
export async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const cycle = await prisma.stakeCycle.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { id: true, status: true },
  })

  if (!cycle) return

  if (cycle.status === 'AUTHORIZED') {
    await prisma.stakeCycle.update({
      where: { id: cycle.id },
      data: { status: 'VOIDED' },
    })
    logger.info(`StakeCycle ${cycle.id}: PI ${paymentIntent.id} cancelled → VOIDED`)
  }
  // If already SETTLED (we cancelled it as part of a full-release settlement), no-op.
}

/**
 * handlePaymentIntentPaymentFailed — fires when a card auth fails (e.g. insufficient funds).
 *
 * Marks the cycle FAILED so the scheduler can re-attempt or notify the user.
 */
export async function handlePaymentIntentPaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const cycle = await prisma.stakeCycle.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { id: true, status: true },
  })

  if (!cycle) return

  await prisma.stakeCycle.update({
    where: { id: cycle.id },
    data: { status: 'FAILED' },
  })
  logger.warn(`StakeCycle ${cycle.id}: PI ${paymentIntent.id} payment failed → FAILED`)
}

/**
 * handlePaymentIntentRequiresAction — fires when 3DS or other authentication
 * is needed before the auth hold can be placed.
 *
 * We log this so the scheduler knows to notify the user; no DB state change
 * (the cycle remains in whatever state it was until the PI succeeds or fails).
 */
export async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const cycle = await prisma.stakeCycle.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { id: true },
  })

  if (cycle) {
    logger.info(
      `StakeCycle ${cycle.id}: PI ${paymentIntent.id} requires_action (3DS/SCA) — ` +
      'user must complete authentication'
    )
  }
}

// ---------------------------------------------------------------------------
// Re-auth helper (auth holds expire ~7 days; weekly cycle just fits)
// ---------------------------------------------------------------------------

/**
 * reauthoriseStakeCycle — called by the scheduler if a cycle's PI expires before
 * settlement (e.g., the cycle was delayed or settlement ran late).
 *
 * Strategy: cancel the expired PI; create a new one; update the cycle record.
 * This is a rare path — the normal weekly cycle settles well within the 7-day window.
 */
export async function reauthoriseStakeCycle(cycleId: string): Promise<void> {
  const stripe = getStripe()

  const cycle = await prisma.stakeCycle.findUnique({
    where: { id: cycleId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          currency: true,
          stripeCustomerId: true,
        },
      },
    },
  })

  if (!cycle) throw new NotFoundError(`StakeCycle ${cycleId} not found`)
  if (cycle.status !== 'AUTHORIZED') {
    throw new BadRequestError(
      `Cannot re-auth cycle ${cycleId} in status ${cycle.status}`
    )
  }
  if (!cycle.user.stripeCustomerId) {
    throw new BadRequestError(`User ${cycle.userId} has no Stripe customer ID`)
  }

  const currency = (cycle.user.currency ?? 'GBP') as Currency

  // Cancel old PI (best-effort — it may have already expired)
  if (cycle.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(cycle.stripePaymentIntentId)
    } catch (err) {
      logger.warn(`Re-auth ${cycleId}: could not cancel old PI ${cycle.stripePaymentIntentId}`, err)
    }
  }

  // Create replacement PI
  const newPI = await stripe.paymentIntents.create({
    amount: toMinorUnits(cycle.stakeAmount, currency),
    currency: currency.toLowerCase(),
    customer: cycle.user.stripeCustomerId,
    capture_method: 'manual',
    confirm: false,
    metadata: {
      userId: cycle.userId,
      purpose: 'stake_cycle_reauth',
      originalCycleId: cycleId,
      guardrail: 'PASS_THROUGH_NOT_IVY_REVENUE',
    },
    description: `Ivy weekly stake RE-AUTH — ${cycle.user.firstName} — ${currency} ${Number(cycle.stakeAmount).toFixed(2)}`,
  })

  await prisma.stakeCycle.update({
    where: { id: cycleId },
    data: { stripePaymentIntentId: newPI.id },
  })

  logger.info(`StakeCycle ${cycleId}: re-authorised → new PI ${newPI.id}`)
}

// ---------------------------------------------------------------------------
// Convenience: void an entire cycle (e.g. subscription cancelled mid-week)
// ---------------------------------------------------------------------------

/**
 * voidStakeCycle — releases the entire auth hold; no money captured.
 * Use when: user cancels subscription during an active cycle, or admin override.
 */
export async function voidStakeCycle(cycleId: string): Promise<void> {
  const stripe = getStripe()

  const cycle = await prisma.stakeCycle.findUnique({
    where: { id: cycleId },
    select: { id: true, status: true, stripePaymentIntentId: true },
  })

  if (!cycle) throw new NotFoundError(`StakeCycle ${cycleId} not found`)
  if (cycle.status !== 'AUTHORIZED') {
    throw new BadRequestError(`Cannot void cycle ${cycleId} in status ${cycle.status}`)
  }

  if (cycle.stripePaymentIntentId) {
    await stripe.paymentIntents.cancel(cycle.stripePaymentIntentId)
  }

  await prisma.stakeCycle.update({
    where: { id: cycleId },
    data: { status: 'VOIDED' },
  })

  logger.info(`StakeCycle ${cycleId}: voided — PI ${cycle.stripePaymentIntentId ?? 'none'} cancelled`)
}

// ---------------------------------------------------------------------------
// Read model — composed daily/home state for the consumer PWA
// ---------------------------------------------------------------------------

export type DayStatus = 'armed' | 'complete' | 'forfeited' | 'grace' | 'upcoming'

export interface StakeStateResult {
  /** The user's active (AUTHORIZED) stake cycle, or null if none is open. */
  cycle: {
    id: string
    status: StakeCycleStatus
    /** True when this is the user's flat-rate first cycle (Foundation Run). */
    isFoundation: boolean
    /** Forfeitable days this cycle spans (foundation runs are often <7). */
    daysInCycle: number
    weeklyAmount: number
    dailySlice: number
    currency: Currency
    periodStart: string
    periodEnd: string
    daysArmed: number
    daysCompleted: number
    daysForfeited: number
    graceUsed: number
    graceTotal: number
    amountSafe: number
    amountAtRisk: number
  } | null
  /** The user's persisted stake configuration (set at stake-setup). */
  config: {
    hasConfig: boolean
    weeklyAmount: number | null
    currency: Currency
    forfeitMode: ForfeitMode
    armingWindowStart: string | null
    armingWindowEnd: string | null
    /** Charity NAME the forfeit is routed to (house default for MIDDLE, anti-charity for SAVAGE). */
    forfeitDestination: string | null
    /** Charity NAME corporate success donations are routed to (the user's preferred charity). */
    successDestination: string | null
  }
  /** Today's arming state. */
  today: {
    date: string
    isArmed: boolean
    armedAt: string | null
    sliceOutcome: SliceOutcome | null
    workoutId: string | null
    voiceNote: { id: string; transcript: string | null; recordedAt: string; durationSec: number | null } | null
    armingWindowStart: string | null
    armingWindowEnd: string | null
    withinArmingWindow: boolean
    /**
     * The explicit next-day commitment captured on the user's most recent call
     * (evening review / opt-in morning call), surfaced as a hint above the
     * morning voice-note recorder. null if no recent call captured one.
     */
    suggestedIntention: { text: string; capturedAt: string } | null
  }
  /** Mon→Sun grid for the current week. */
  week: { label: string; date: string; status: DayStatus; isToday: boolean }[]
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * getStakeState — compose the consumer PWA's daily/home state in one read.
 *
 * Pure read (no Stripe). Returns the active cycle's progress, the user's
 * stake config with charity NAMES resolved, today's arming state (+ the
 * canonical morning VoiceNote if armed), and a Mon→Sun week grid derived
 * from the user's workouts. Designed to be safe for brand-new users with no
 * cycle, no config, and no workouts (everything returns null / 'upcoming').
 */
export async function getStakeState(userId: string): Promise<StakeStateResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currency: true,
      stakeWeeklyAmount: true,
      forfeitMode: true,
      dislikedCharityId: true,
      preferredCharityId: true,
      armingWindowStart: true,
      armingWindowEnd: true,
    },
  })
  if (!user) throw new NotFoundError('User not found')

  const currency = (user.currency ?? 'GBP') as Currency
  const forfeitMode = user.forfeitMode
  const weeklyAmount = user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : null

  // ── Resolve charity names (forfeit + success destinations) ────────────────
  // SAVAGE forfeits route to the anti-charity; MIDDLE to the house default.
  const [houseCharity, namedCharities] = await Promise.all([
    forfeitMode === 'MIDDLE'
      ? prisma.charity.findFirst({ where: { isHouseDefault: true, isActive: true }, select: { name: true } })
      : Promise.resolve(null),
    prisma.charity.findMany({
      where: { id: { in: [user.dislikedCharityId, user.preferredCharityId].filter((x): x is string => !!x) } },
      select: { id: true, name: true },
    }),
  ])
  const nameById = new Map(namedCharities.map((c) => [c.id, c.name]))
  const forfeitDestination =
    forfeitMode === 'SAVAGE'
      ? (user.dislikedCharityId ? nameById.get(user.dislikedCharityId) ?? null : null)
      : (houseCharity?.name ?? null)
  const successDestination = user.preferredCharityId ? nameById.get(user.preferredCharityId) ?? null : null

  // ── Active cycle ──────────────────────────────────────────────────────────
  const cycleRow = await prisma.stakeCycle.findFirst({
    where: { userId, status: 'AUTHORIZED' },
    orderBy: { periodStart: 'desc' },
  })

  let cycle: StakeStateResult['cycle'] = null
  if (cycleRow) {
    const cycleWeekly = Number(cycleRow.stakeAmount)
    const dailySlice = round2(cycleWeekly / cycleRow.daysInCycle)
    const amountSafe = round2(dailySlice * cycleRow.daysCompleted)
    const undecidedDays = Math.max(0, cycleRow.daysInCycle - cycleRow.daysCompleted - cycleRow.daysForfeited)
    const amountAtRisk = round2(dailySlice * undecidedDays)
    cycle = {
      id: cycleRow.id,
      status: cycleRow.status,
      isFoundation: cycleRow.isFoundation,
      daysInCycle: cycleRow.daysInCycle,
      weeklyAmount: cycleWeekly,
      dailySlice,
      currency,
      periodStart: cycleRow.periodStart.toISOString(),
      periodEnd: cycleRow.periodEnd.toISOString(),
      daysArmed: cycleRow.daysArmed,
      daysCompleted: cycleRow.daysCompleted,
      daysForfeited: cycleRow.daysForfeited,
      graceUsed: cycleRow.graceUsed,
      graceTotal: STAKE_CONFIG.graceSkipsPerCycle,
      amountSafe,
      amountAtRisk,
    }
  }

  // ── Today's workout / arming state ────────────────────────────────────────
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const todaysWorkout = await prisma.workout.findFirst({
    where: { userId, plannedDate: { gte: todayStart, lte: todayEnd } },
    orderBy: { plannedDate: 'asc' },
    select: {
      id: true,
      armedAt: true,
      sliceOutcome: true,
      voiceNote: { select: { id: true, transcript: true, recordedAt: true, durationSec: true } },
    },
  })

  const withinArmingWindow = isWithinWindow(now, user.armingWindowStart, user.armingWindowEnd)
  const today: StakeStateResult['today'] = {
    date: todayStart.toISOString(),
    isArmed: !!todaysWorkout?.armedAt,
    armedAt: todaysWorkout?.armedAt ? todaysWorkout.armedAt.toISOString() : null,
    sliceOutcome: todaysWorkout?.sliceOutcome ?? null,
    workoutId: todaysWorkout?.id ?? null,
    voiceNote: todaysWorkout?.voiceNote
      ? {
          id: todaysWorkout.voiceNote.id,
          transcript: todaysWorkout.voiceNote.transcript,
          recordedAt: todaysWorkout.voiceNote.recordedAt.toISOString(),
          durationSec: todaysWorkout.voiceNote.durationSec,
        }
      : null,
    armingWindowStart: user.armingWindowStart,
    armingWindowEnd: user.armingWindowEnd,
    withinArmingWindow,
    suggestedIntention: null,
  }

  // ── Next-day intention hint (from the most recent call's insights) ────────
  // Surfaced above the morning VN recorder: "Last night you said you'll…".
  // We scan the few most recent COMPLETED calls and take the first that
  // captured a clean next_intention (insight.service writes this from the
  // evening review / opt-in morning call transcript).
  const recentCalls = await prisma.call.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { scheduledAt: 'desc' },
    take: 8,
    select: { callInsights: true, scheduledAt: true, createdAt: true },
  })
  for (const c of recentCalls) {
    const text = (c.callInsights as { next_intention?: unknown } | null)?.next_intention
    if (typeof text === 'string' && text.trim()) {
      today.suggestedIntention = {
        text: text.trim(),
        capturedAt: (c.scheduledAt ?? c.createdAt).toISOString(),
      }
      break
    }
  }

  // ── Mon→Sun week grid ─────────────────────────────────────────────────────
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfDay(addDays(weekStart, 6))
  const weekWorkouts = await prisma.workout.findMany({
    where: { userId, plannedDate: { gte: weekStart, lte: weekEnd } },
    select: { plannedDate: true, status: true, armedAt: true, sliceOutcome: true },
  })

  const cycleStartDay = cycleRow ? startOfDay(cycleRow.periodStart) : null
  const week = WEEKDAY_LABELS.map((label, i) => {
    const day = addDays(weekStart, i)
    const isToday = isSameDay(day, now)
    const isFuture = startOfDay(day) > todayStart
    const w = weekWorkouts.find((x) => isSameDay(x.plannedDate, day))

    let status: DayStatus = 'upcoming'
    if (w) {
      if (w.status === 'COMPLETED' || w.status === 'PARTIAL') status = 'complete'
      else if (w.sliceOutcome === 'FORFEITED') status = 'forfeited'
      else if (w.sliceOutcome === 'RELEASED') status = 'grace'
      else if (w.armedAt) status = 'armed'
      else if (!isFuture && !isToday) status = 'forfeited' // past, planned, never armed
    } else if (!isFuture && !isToday && cycleStartDay && startOfDay(day) >= cycleStartDay) {
      // Past day inside an active cycle with no workout at all = a missed day.
      status = 'forfeited'
    }

    return { label, date: startOfDay(day).toISOString(), status, isToday }
  })

  return {
    cycle,
    config: {
      hasConfig: weeklyAmount !== null,
      weeklyAmount,
      currency,
      forfeitMode,
      armingWindowStart: user.armingWindowStart,
      armingWindowEnd: user.armingWindowEnd,
      forfeitDestination,
      successDestination,
    },
    today,
    week,
  }
}

/**
 * isWithinWindow — best-effort check whether `now` (server time) falls inside the
 * user's HH:MM arming window. Timezone-naive; good enough for the UI hint, not for
 * settlement (settlement is driven by the deadline cron, not this).
 */
function isWithinWindow(now: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false
  const mins = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false
  return mins >= sh * 60 + sm && mins <= eh * 60 + em
}
