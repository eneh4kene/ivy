/**
 * Arming Service — Unit Tests (Phase 3)
 *
 * Tests cover:
 *   A1 — sendArmingPrompt: sends push when subscriptions exist
 *   A2 — sendArmingPrompt: falls back to SMS when no push subscriptions
 *   A3 — sendArmingPrompt: sends nothing (no error) when no push AND no phone
 *   A4 — sendArmingReminder: skips if user is already armed
 *   A5 — sendArmingReminder: sends push if unarmed
 *   A6 — sendArmingFinalNotice: skips if already armed
 *   A7 — sendArmingFinalNotice: fires push + buddy nudge + ARMING_CHASE when enabled and cap not reached
 *   A8 — ARMING_CHASE monthly cap: skips call when cap (8) is reached
 *   A9 — ARMING_CHASE monthly cap: resets at new calendar month
 *   A10 — enforceArmingDeadline: marks unarmed workout MISSED + FORFEITED
 *   A11 — enforceArmingDeadline: no-ops if already armed
 *   A12 — enforceArmingDeadline: no-ops if no workout found
 *   A13 — runArmingForStage: only acts on users whose window matches the current time
 *   A14 — openStakeCyclesForActiveUsers: calls openStakeCycle per eligible user
 *   A15 — settleExpiredStakeCycles: calls settleStakeCycle for overdue AUTHORIZED cycles
 *
 * All Prisma, push, messaging, and call service calls are fully mocked.
 * No real network calls, no real Stripe, no real Twilio/Retell/push.
 */

// ---------------------------------------------------------------------------
// Jest module mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    workout: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    stakeCycle: { findMany: jest.fn(), count: jest.fn() },
    pushSubscription: { count: jest.fn() },
    voiceNote: { create: jest.fn() },
  },
}))

jest.mock('../services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue({ attempted: 1, delivered: 1 }),
  armingPushTemplates: {},
}))

jest.mock('../services/messaging.service', () => ({
  __esModule: true,
  default: {
    sendSMSMessage: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('../services/call.service', () => ({
  __esModule: true,
  default: {
    scheduleCall: jest.fn().mockResolvedValue({ id: 'call-1' }),
  },
}))

jest.mock('../services/stake.service', () => ({
  openStakeCycle: jest.fn().mockResolvedValue({ cycleId: 'cycle-1' }),
  openFoundationCycle: jest.fn().mockResolvedValue({ cycleId: 'foundation-1' }),
  settleStakeCycle: jest.fn().mockResolvedValue({ status: 'SETTLED' }),
  linkWorkoutToCycle: jest.fn().mockResolvedValue(undefined),
}))

// Mock nodemailer for buddy nudge
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '../utils/prisma'
import { sendPushToUser } from '../services/push.service'
import messagingService from '../services/messaging.service'
import callService from '../services/call.service'
import * as stakeService from '../services/stake.service'
import {
  sendArmingPrompt,
  sendArmingReminder,
  sendArmingFinalNotice,
  enforceArmingDeadline,
  runArmingForStage,
  openStakeCyclesForActiveUsers,
  settleExpiredStakeCycles,
  ARMING_CHASE_MONTHLY_CAP,
} from '../services/arming.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockSendPush = sendPushToUser as jest.MockedFunction<typeof sendPushToUser>
const mockSendSMS = messagingService.sendSMSMessage as jest.MockedFunction<typeof messagingService.sendSMSMessage>
const mockScheduleCall = callService.scheduleCall as jest.MockedFunction<typeof callService.scheduleCall>
const mockOpenCycle = stakeService.openStakeCycle as jest.MockedFunction<typeof stakeService.openStakeCycle>
const mockOpenFoundation = stakeService.openFoundationCycle as jest.MockedFunction<typeof stakeService.openFoundationCycle>
const mockSettleCycle = stakeService.settleStakeCycle as jest.MockedFunction<typeof stakeService.settleStakeCycle>

const MOCK_USER_BASE = {
  id: 'user-1',
  firstName: 'Alex',
  phone: '+447900000001',
  currency: 'GBP',
  timezone: 'Europe/London',
  stakeWeeklyAmount: { toNumber: () => 14, valueOf: () => 14 } as any,
  armingWindowStart: '07:00',
  armingWindowEnd: '09:00',
  armingChaseEnabled: false,
  chaseCallsThisMonth: 0,
  chaseCapMonthStart: null as Date | null,
  commStyle: 'ADAPTIVE' as const,
  accountabilityBuddy: null as any,
}

beforeEach(() => {
  jest.clearAllMocks()
  // Push "delivery" is now the provider-accepted send count, not a sub count.
  mockSendPush.mockResolvedValue({ attempted: 1, delivered: 1 })
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER_BASE)
  ;(mockPrisma.pushSubscription.count as jest.Mock).mockResolvedValue(1)
  ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
    id: 'workout-1',
    status: 'PLANNED',
    armedAt: null,
    sliceOutcome: 'PENDING',
    stakeSliceAmount: null,
  })
})

// ---------------------------------------------------------------------------
// A1 — sendArmingPrompt: sends push when subscriptions exist
// ---------------------------------------------------------------------------
describe('sendArmingPrompt', () => {
  it('A1: sends push notification when push delivery succeeds', async () => {
    mockSendPush.mockResolvedValue({ attempted: 2, delivered: 2 })

    await sendArmingPrompt('user-1')

    expect(mockSendPush).toHaveBeenCalledTimes(1)
    const [calledUserId, payload] = mockSendPush.mock.calls[0]
    expect(calledUserId).toBe('user-1')
    expect(payload.tag).toBe('arming-prompt')
    expect(mockSendSMS).not.toHaveBeenCalled()
  })

  // A2 — SMS fallback when push delivers nothing (no subs, or all sends failed)
  it('A2: falls back to SMS when push delivers to no device', async () => {
    mockSendPush.mockResolvedValue({ attempted: 0, delivered: 0 })

    await sendArmingPrompt('user-1')

    expect(mockSendSMS).toHaveBeenCalledTimes(1)
    const [calledUserId, msgText, msgType] = mockSendSMS.mock.calls[0]
    expect(calledUserId).toBe('user-1')
    expect(msgText).toContain('voice note')
    expect(msgType).toBe('reminder')
  })

  // A3 — No push delivery, no phone
  it('A3: sends nothing (no throw) when push delivers nothing and no phone number', async () => {
    mockSendPush.mockResolvedValue({ attempted: 0, delivered: 0 })
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_USER_BASE,
      phone: null,
    })

    await expect(sendArmingPrompt('user-1')).resolves.toBeUndefined()
    expect(mockSendSMS).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// A4-A5 — sendArmingReminder
// ---------------------------------------------------------------------------
describe('sendArmingReminder', () => {
  it('A4: skips reminder if user is already armed (armedAt set)', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      id: 'workout-1',
      status: 'COMPLETED',
      armedAt: new Date(),
      sliceOutcome: 'PENDING',
      stakeSliceAmount: null,
    })

    await sendArmingReminder('user-1', new Date())

    expect(mockSendPush).not.toHaveBeenCalled()
    expect(mockSendSMS).not.toHaveBeenCalled()
  })

  it('A5: sends loss-framed push reminder when user is still unarmed', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      id: 'workout-1',
      status: 'PLANNED',
      armedAt: null,
      sliceOutcome: 'PENDING',
      stakeSliceAmount: null,
    })

    await sendArmingReminder('user-1', new Date())

    expect(mockSendPush).toHaveBeenCalledTimes(1)
    const [, payload] = mockSendPush.mock.calls[0]
    expect(payload.tag).toBe('arming-reminder')
    expect(payload.body).toContain('on the line')
  })
})

// ---------------------------------------------------------------------------
// A6-A8 — sendArmingFinalNotice + ARMING_CHASE cap
// ---------------------------------------------------------------------------
describe('sendArmingFinalNotice', () => {
  it('A6: skips final notice if user is already armed', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      id: 'workout-1',
      armedAt: new Date(),
      status: 'PLANNED',
      sliceOutcome: 'PENDING',
      stakeSliceAmount: null,
    })

    await sendArmingFinalNotice('user-1', new Date())

    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('A7: sends final notice + buddy nudge + ARMING_CHASE when opt-in and under cap', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_USER_BASE,
      armingChaseEnabled: true,
      chaseCallsThisMonth: 3,
      chaseCapMonthStart: new Date(), // same month
      accountabilityBuddy: {
        id: 'buddy-1',
        buddyName: 'Sam',
        buddyEmail: 'sam@example.com',
        isActive: true,
      },
    })
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    await sendArmingFinalNotice('user-1', new Date())

    // Push should fire for final notice
    expect(mockSendPush).toHaveBeenCalledTimes(1)
    const [, payload] = mockSendPush.mock.calls[0]
    expect(payload.tag).toBe('arming-final-notice')

    // ARMING_CHASE call should be scheduled
    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
    const [calledUserId, callType] = mockScheduleCall.mock.calls[0]
    expect(calledUserId).toBe('user-1')
    expect(callType).toBe('ARMING_CHASE')

    // Monthly counter should be incremented
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ chaseCallsThisMonth: { increment: 1 } }),
      }),
    )
  })

  it('A8: ARMING_CHASE skipped when monthly cap is reached', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_USER_BASE,
      armingChaseEnabled: true,
      chaseCallsThisMonth: ARMING_CHASE_MONTHLY_CAP, // at cap
      chaseCapMonthStart: new Date(), // same month
    })
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    await sendArmingFinalNotice('user-1', new Date())

    // Push still fires for the notice itself
    expect(mockSendPush).toHaveBeenCalledTimes(1)
    // But NO chase call — cap reached
    expect(mockScheduleCall).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// A9 — Monthly cap reset
// ---------------------------------------------------------------------------
describe('ARMING_CHASE monthly cap reset', () => {
  it('A9: resets counter when chaseCapMonthStart is in a prior month', async () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...MOCK_USER_BASE,
      armingChaseEnabled: true,
      chaseCallsThisMonth: ARMING_CHASE_MONTHLY_CAP, // would be at cap under old month
      chaseCapMonthStart: lastMonth, // LAST month — should trigger reset
    })
    // update called for reset, then for increment
    ;(mockPrisma.user.update as jest.Mock).mockResolvedValue({})

    await sendArmingFinalNotice('user-1', new Date())

    // After reset, count is 0 and chase call should fire
    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
    const [, callType] = mockScheduleCall.mock.calls[0]
    expect(callType).toBe('ARMING_CHASE')
  })
})

// ---------------------------------------------------------------------------
// A10-A12 — enforceArmingDeadline
// ---------------------------------------------------------------------------
describe('enforceArmingDeadline', () => {
  it('A10: marks unarmed PLANNED workout as MISSED + FORFEITED', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      id: 'workout-1',
      status: 'PLANNED',
      armedAt: null,
      sliceOutcome: 'PENDING',
      stakeSliceAmount: null,
    })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await enforceArmingDeadline('user-1', new Date())

    expect(mockPrisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { status: 'MISSED', sliceOutcome: 'FORFEITED' },
    })
  })

  it('A11: no-ops if the workout is already armed', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      id: 'workout-1',
      status: 'PLANNED',
      armedAt: new Date(), // already armed
      sliceOutcome: 'PENDING',
      stakeSliceAmount: null,
    })

    await enforceArmingDeadline('user-1', new Date())

    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('A12: no-ops if no workout exists for the day', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue(null)

    await enforceArmingDeadline('user-1', new Date())

    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// A13 — runArmingForStage: respects the ±7.5-min tolerance window
// ---------------------------------------------------------------------------
describe('runArmingForStage', () => {
  it('A13: only fires for users whose window matches within ±7.5 minutes', async () => {
    const now = new Date('2026-01-05T07:01:00Z') // Monday, 07:01 UTC

    // User 1 — window 07:00-09:00 UTC (tolerance matches for PROMPT at 07:00)
    // User 2 — window 10:00-12:00 UTC (way off — should NOT fire)
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'user-match',
        timezone: 'UTC',
        armingWindowStart: '07:00',
        armingWindowEnd: '09:00',
      },
      {
        id: 'user-no-match',
        timezone: 'UTC',
        armingWindowStart: '10:00',
        armingWindowEnd: '12:00',
      },
    ])

    // loadArmingUser for user-match
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER_BASE)
    ;(mockPrisma.pushSubscription.count as jest.Mock).mockResolvedValue(1)

    await runArmingForStage('PROMPT', now)

    // sendPushToUser should only have been called once (for user-match)
    expect(mockSendPush).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// A14 — openStakeCyclesForActiveUsers
// ---------------------------------------------------------------------------
describe('openStakeCyclesForActiveUsers', () => {
  it('A14: calls openStakeCycle for each eligible RETURNING user (prior cycle exists)', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'user-a' },
      { id: 'user-b' },
    ])
    // Both have a prior cycle → normal full-price weekly open (not Foundation Run).
    ;(mockPrisma.stakeCycle.count as jest.Mock).mockResolvedValue(1)
    mockOpenCycle.mockResolvedValue({
      cycleId: 'cycle-1',
      paymentIntentId: 'pi_1',
      stakeAmount: 14,
      currency: 'GBP',
      periodStart: new Date(),
      periodEnd: new Date(),
    })

    await openStakeCyclesForActiveUsers()

    expect(mockOpenCycle).toHaveBeenCalledTimes(2)
    expect(mockOpenCycle).toHaveBeenCalledWith('user-a')
    expect(mockOpenCycle).toHaveBeenCalledWith('user-b')
    expect(mockOpenFoundation).not.toHaveBeenCalled()
  })

  it('A14a: a first-time user (no prior cycle) gets a Foundation Run, not a normal cycle', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-new' }])
    ;(mockPrisma.stakeCycle.count as jest.Mock).mockResolvedValue(0)

    await openStakeCyclesForActiveUsers()

    expect(mockOpenFoundation).toHaveBeenCalledWith('user-new')
    expect(mockOpenCycle).not.toHaveBeenCalled()
  })

  it('A14b: skips users with existing open cycles gracefully (no throw)', async () => {
    ;(mockPrisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-a' }])
    ;(mockPrisma.stakeCycle.count as jest.Mock).mockResolvedValue(1)
    mockOpenCycle.mockRejectedValue(new Error('already has an open stake cycle'))

    // Should not throw
    await expect(openStakeCyclesForActiveUsers()).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// A15 — settleExpiredStakeCycles
// ---------------------------------------------------------------------------
describe('settleExpiredStakeCycles', () => {
  it('A15: calls settleStakeCycle for each overdue AUTHORIZED cycle', async () => {
    ;(mockPrisma.stakeCycle.findMany as jest.Mock).mockResolvedValue([
      { id: 'cycle-1', userId: 'user-a' },
      { id: 'cycle-2', userId: 'user-b' },
    ])
    mockSettleCycle.mockResolvedValue({
      cycleId: 'cycle-1',
      capturedAmount: 4,
      releasedAmount: 10,
      forfeitDonationIds: ['don-1'],
      status: 'SETTLED',
    })

    await settleExpiredStakeCycles()

    expect(mockSettleCycle).toHaveBeenCalledTimes(2)
    expect(mockSettleCycle).toHaveBeenCalledWith('cycle-1')
    expect(mockSettleCycle).toHaveBeenCalledWith('cycle-2')
  })

  it('A15b: continues settling remaining cycles even if one fails', async () => {
    ;(mockPrisma.stakeCycle.findMany as jest.Mock).mockResolvedValue([
      { id: 'cycle-bad', userId: 'user-a' },
      { id: 'cycle-good', userId: 'user-b' },
    ])
    mockSettleCycle
      .mockRejectedValueOnce(new Error('Stripe error'))
      .mockResolvedValueOnce({
        cycleId: 'cycle-good',
        capturedAmount: 0,
        releasedAmount: 14,
        forfeitDonationIds: [],
        status: 'SETTLED',
      })

    await expect(settleExpiredStakeCycles()).resolves.toBeUndefined()
    expect(mockSettleCycle).toHaveBeenCalledTimes(2)
  })
})
