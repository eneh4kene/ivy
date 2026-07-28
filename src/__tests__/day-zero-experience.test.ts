/**
 * Day-Zero experience — Unit Tests
 *
 * Covers userService.startDayZeroExperience(), the idempotent kickoff split into a
 * WELCOME half (circle + onboarding handoff CHAT message — fires on onboarding, NO
 * card needed, so Ivy reaches out during the free trial) and a MONEY half
 * (Foundation Run — only once a card / Stripe subscription is on file).
 *
 *   1. Coaches are skipped entirely.
 *   2. Deferred (no-op) when not onboarded.
 *   3. No card: welcome half (circle + handoff) fires; Foundation Run waits.
 *   4. Happy path (card on file): assigns circle, posts handoff, opens Foundation Run.
 *   5. Idempotent: existing handoff + existing cycle ⇒ neither is created again.
 *
 * The silent onboarding call was replaced by an in-app handoff message (call now /
 * pick a time / just text); the action buttons drive the actual call scheduling.
 *
 * All deps (Prisma, circle/chat/stake services) are mocked — no DB, no Stripe.
 */

const mockOpenFoundationCycle = jest.fn()
const mockComputeFoundationWindow = jest.fn()

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    message: { findFirst: jest.fn() },
    stakeCycle: { findFirst: jest.fn() },
  },
}))

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../services/circle.service', () => ({
  __esModule: true,
  default: { autoAssignToCircle: jest.fn().mockResolvedValue({ circleId: 'c1', created: true }) },
}))

jest.mock('../services/chat.service', () => ({
  __esModule: true,
  default: { postIvyMessage: jest.fn().mockResolvedValue({ id: 'msg1' }) },
}))

jest.mock('../services/season.service', () => ({
  __esModule: true,
  default: { createSeason: jest.fn() },
}))

jest.mock('../services/stake.service', () => ({
  __esModule: true,
  openFoundationCycle: (...args: any[]) => mockOpenFoundationCycle(...args),
  computeFoundationWindow: (...args: any[]) => mockComputeFoundationWindow(...args),
}))

// "Subscribed" no longer implies "card on file" (promo signups save none) —
// day-zero now asks Stripe directly. Default to card-present; the promo test
// flips it.
const mockCustomerHasCard = jest.fn()
jest.mock('../services/payment.service', () => ({
  __esModule: true,
  default: { customerHasCard: (...args: any[]) => mockCustomerHasCard(...args) },
}))

import userService from '../services/user.service'
import prisma from '../utils/prisma'
import circleService from '../services/circle.service'
import chatService from '../services/chat.service'

const db = prisma as unknown as {
  user: { findUnique: jest.Mock }
  message: { findFirst: jest.Mock }
  stakeCycle: { findFirst: jest.Mock }
}
const circle = circleService as unknown as { autoAssignToCircle: jest.Mock }
const chat = chatService as unknown as { postIvyMessage: jest.Mock }

const ONBOARDED_PAID = {
  id: 'u1',
  firstName: 'Sam',
  isOnboarded: true,
  phone: '+447700900000',
  timezone: 'Europe/London',
  eveningCallTime: '20:00',
  subscriptionTier: 'PRO',
  stakeWeeklyAmount: 14,
  stripeSubscriptionId: 'sub_123',
}

beforeEach(() => {
  jest.clearAllMocks()
  db.message.findFirst.mockResolvedValue(null)
  db.stakeCycle.findFirst.mockResolvedValue(null)
  mockComputeFoundationWindow.mockReturnValue({
    periodStart: new Date('2026-06-26T00:00:00Z'),
    periodEnd: new Date('2026-06-28T23:59:59Z'),
    daysInCycle: 3,
  })
  mockOpenFoundationCycle.mockResolvedValue({ cycleId: 'cyc1' })
  mockCustomerHasCard.mockResolvedValue(true)
})

const flush = () => new Promise((r) => setImmediate(r))

describe('startDayZeroExperience', () => {
  it('skips coaches entirely', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID, subscriptionTier: 'COACH' })

    await userService.startDayZeroExperience('u1')
    await flush()

    expect(circle.autoAssignToCircle).not.toHaveBeenCalled()
    expect(chat.postIvyMessage).not.toHaveBeenCalled()
    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
  })

  it('defers (no-op) when not onboarded', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID, isOnboarded: false })

    await userService.startDayZeroExperience('u1')
    await flush()

    expect(circle.autoAssignToCircle).not.toHaveBeenCalled()
    expect(chat.postIvyMessage).not.toHaveBeenCalled()
    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
  })

  it('no card: welcome half fires (circle + handoff) but Foundation Run waits', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID, stripeSubscriptionId: null, subscriptionTier: 'FREE' })

    await userService.startDayZeroExperience('u1')
    await flush()

    // Ivy reaches out during the trial — no card required.
    expect(circle.autoAssignToCircle).toHaveBeenCalledWith('u1')
    expect(chat.postIvyMessage).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      expect.objectContaining({ messageType: 'onboarding_handoff' }),
    )
    // ...but the money half holds until a card is on file.
    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
  })

  it('happy path: assigns circle, posts handoff, opens Foundation Run', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID })

    await userService.startDayZeroExperience('u1')
    await flush()

    expect(circle.autoAssignToCircle).toHaveBeenCalledWith('u1')
    expect(chat.postIvyMessage).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      expect.objectContaining({ messageType: 'onboarding_handoff' }),
    )
    expect(mockOpenFoundationCycle).toHaveBeenCalledWith('u1', expect.objectContaining({ daysInCycle: 3 }))
  })

  it('promo signup (subscribed, NO card): welcome half runs, Foundation Run deferred', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID })
    mockCustomerHasCard.mockResolvedValue(false)

    await userService.startDayZeroExperience('u1')
    await flush()

    // Ivy still shows up on day one…
    expect(circle.autoAssignToCircle).toHaveBeenCalledWith('u1')
    expect(chat.postIvyMessage).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
      expect.objectContaining({ messageType: 'onboarding_handoff' }),
    )
    // …but no off-session hold is attempted without a card (no scary failure).
    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
  })

  it('is idempotent: existing handoff + cycle ⇒ neither created again', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID })
    db.message.findFirst.mockResolvedValue({ id: 'existing_handoff' })
    db.stakeCycle.findFirst.mockResolvedValue({ id: 'existing_cycle' })

    await userService.startDayZeroExperience('u1')
    await flush()

    expect(chat.postIvyMessage).not.toHaveBeenCalled()
    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
    // circle assignment is itself idempotent — still safe to call
    expect(circle.autoAssignToCircle).toHaveBeenCalledWith('u1')
  })

  it('defers Foundation Run to Monday opener when the window is too short', async () => {
    db.user.findUnique.mockResolvedValue({ ...ONBOARDED_PAID })
    mockComputeFoundationWindow.mockReturnValue(null) // Sat/Sun signup → too few days

    await userService.startDayZeroExperience('u1')
    await flush()

    expect(mockOpenFoundationCycle).not.toHaveBeenCalled()
    // circle + handoff still happen
    expect(circle.autoAssignToCircle).toHaveBeenCalledWith('u1')
    expect(chat.postIvyMessage).toHaveBeenCalled()
  })
})
