/**
 * stake-smoke.ts — on-demand verification of the stake money flow.
 *
 * Lets you exercise openStakeCycle / settleStakeCycle for a single user without
 * waiting for the Monday/Sunday cron. Run against STRIPE *TEST* keys only.
 *
 * Usage (ts-node):
 *   ts-node src/scripts/stake-smoke.ts status  <userId>
 *   ts-node src/scripts/stake-smoke.ts open    <userId>
 *   ts-node src/scripts/stake-smoke.ts settle  <userId>
 *
 *   status  — print the user's stake config, cycles, and this-week workouts
 *   open    — place the off-session weekly hold (subscriber must have a saved card)
 *   settle  — settle the user's open AUTHORIZED cycle (capture forfeits / release)
 *
 * Verification recipe:
 *   1. Subscribe a test user (card 4242 4242 4242 4242) so a card is saved.
 *   2. `open`  → check Stripe dashboard for a PaymentIntent in `requires_capture`.
 *   3. Arm/miss some days in the app (or edit workouts), then `settle`.
 *   4. Confirm partial capture + Donation rows + the rest released.
 *   SCA path: use a saved card 4000 0027 6000 3184 → `open` should mark the
 *   cycle FAILED and send a re-auth nudge (off_session cannot complete 3DS).
 */

import prisma from '../utils/prisma'
import { openStakeCycle, settleStakeCycle } from '../services/stake.service'
import { startOfDay, endOfDay, subDays, addDays } from 'date-fns'

async function status(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, currency: true, stripeCustomerId: true,
      stakeWeeklyAmount: true, forfeitMode: true, dislikedCharityId: true,
      armingWindowStart: true, armingWindowEnd: true,
    },
  })
  if (!user) throw new Error(`User ${userId} not found`)
  console.log('\n── User stake config ──')
  console.table({
    email: user.email,
    currency: user.currency,
    stripeCustomerId: user.stripeCustomerId,
    stakeWeeklyAmount: user.stakeWeeklyAmount ? Number(user.stakeWeeklyAmount) : null,
    forfeitMode: user.forfeitMode,
    dislikedCharityId: user.dislikedCharityId,
    armingWindow: `${user.armingWindowStart ?? '—'} → ${user.armingWindowEnd ?? '—'}`,
  })

  const cycles = await prisma.stakeCycle.findMany({
    where: { userId },
    orderBy: { periodStart: 'desc' },
    take: 5,
    select: {
      id: true, status: true, stakeAmount: true, capturedAmount: true,
      stripePaymentIntentId: true, daysArmed: true, daysForfeited: true,
      graceUsed: true, periodStart: true, periodEnd: true,
    },
  })
  console.log('\n── Recent stake cycles ──')
  console.table(cycles.map((c) => ({
    id: c.id, status: c.status,
    stake: Number(c.stakeAmount), captured: Number(c.capturedAmount),
    pi: c.stripePaymentIntentId, armed: c.daysArmed, forfeited: c.daysForfeited,
    grace: c.graceUsed,
    period: `${c.periodStart.toISOString().slice(0, 10)}…${c.periodEnd.toISOString().slice(0, 10)}`,
  })))

  const workouts = await prisma.workout.findMany({
    where: {
      userId,
      plannedDate: { gte: startOfDay(subDays(new Date(), 7)), lte: endOfDay(addDays(new Date(), 1)) },
    },
    orderBy: { plannedDate: 'asc' },
    select: {
      id: true, plannedDate: true, status: true, sliceOutcome: true,
      stakeCycleId: true, stakeSliceAmount: true, armedAt: true,
    },
  })
  console.log('\n── Workouts (last 7d) ──')
  console.table(workouts.map((w) => ({
    id: w.id, date: w.plannedDate.toISOString().slice(0, 10),
    status: w.status, slice: w.sliceOutcome,
    linked: w.stakeCycleId ? '✓' : '—',
    sliceAmt: w.stakeSliceAmount ? Number(w.stakeSliceAmount) : null,
    armed: w.armedAt ? '✓' : '—',
  })))
}

async function open(userId: string) {
  console.log(`Opening stake cycle for ${userId}…`)
  const res = await openStakeCycle(userId)
  console.log('✅ Opened:', res)
}

async function settle(userId: string) {
  const cycle = await prisma.stakeCycle.findFirst({
    where: { userId, status: 'AUTHORIZED' },
    orderBy: { periodStart: 'desc' },
    select: { id: true },
  })
  if (!cycle) throw new Error(`No open AUTHORIZED cycle for user ${userId}`)
  console.log(`Settling cycle ${cycle.id}…`)
  const res = await settleStakeCycle(cycle.id)
  console.log('✅ Settled:', res)
}

async function main() {
  const [action, userId] = process.argv.slice(2)
  if (!action || !userId) {
    console.error('Usage: ts-node src/scripts/stake-smoke.ts <status|open|settle> <userId>')
    process.exit(1)
  }
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    console.error('⛔ Refusing to run: STRIPE_SECRET_KEY is not a test key (sk_test_…).')
    process.exit(1)
  }

  switch (action) {
    case 'status': await status(userId); break
    case 'open':   await open(userId); break
    case 'settle': await settle(userId); break
    default:
      console.error(`Unknown action '${action}'. Use status | open | settle.`)
      process.exit(1)
  }
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('❌', err)
  await prisma.$disconnect()
  process.exit(1)
})
