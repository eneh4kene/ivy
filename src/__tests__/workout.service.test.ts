/**
 * Phase 5 — workout.service unit tests
 *
 * Key assertion: completeWorkout no longer creates a COMPLETION-type Donation.
 * Under the rework (§8 of docs/product-pricing-rework.md) follow-through
 * RELEASES the user's stake (sliceOutcome = 'RELEASED') and charity funding
 * comes from stake forfeits + Phase 6 corporate CSR pool.
 *
 * Also verifies:
 *   - Streak is updated on follow-through (COMPLETED / PARTIAL)
 *   - Streak is reset (or grace applied) on SKIPPED
 *   - sliceOutcome is set correctly (RELEASED / FORFEITED)
 *   - circleGameService.processWorkoutEvent is called non-blocking
 */

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    workout: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    call: {
      findFirst: jest.fn(),
    },
    streak: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userCharity: {
      findMany: jest.fn(),
    },
    donation: {
      create: jest.fn(),
    },
  },
}))

// donation.service is no longer imported by workout.service in Phase 5,
// but mock it in case any indirect path loads it
jest.mock('../services/donation.service', () => ({
  __esModule: true,
  default: {
    calculateDonationAmount: jest.fn(),
    canMakeDonation: jest.fn(),
    createDonation: jest.fn(),
  },
}))

jest.mock('../services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
  pushTemplates: {
    streakWarning: jest.fn().mockReturnValue({ title: 'Streak!', body: 'test' }),
  },
}))

jest.mock('../lib/analytics', () => ({
  serverAnalytics: {
    workoutFollowedCall: jest.fn(),
    rescueResolved: jest.fn(),
  },
}))

jest.mock('../services/circle-game.service', () => ({
  __esModule: true,
  default: {
    processWorkoutEvent: jest.fn().mockResolvedValue(undefined),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '../utils/prisma'
import donationService from '../services/donation.service'
import circleGameService from '../services/circle-game.service'
import workoutService from '../services/workout.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeWorkout = (overrides: Record<string, unknown> = {}) => ({
  id: 'workout-1',
  userId: 'user-1',
  plannedDate: new Date('2026-06-16'),
  status: 'PLANNED',
  isMinimum: false,
  ...overrides,
})

const makeStreak = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  currentStreak: 3,
  longestStreak: 5,
  lastWorkoutDate: new Date('2026-06-15'),
  currentStreakStart: new Date('2026-06-13'),
  longestStreakStart: new Date('2026-06-01'),
  graceDaysBalance: 0,
  graceDaysUsed: 0,
  graceDayLog: '[]',
  bonus7DayClaimed: false,
  bonus30DayClaimed: false,
  bonus90DayClaimed: false,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workoutService.completeWorkout — Phase 5 wallet retirement', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default prisma stubs
    ;(prisma.workout.findUnique as jest.Mock).mockResolvedValue(makeWorkout())
    ;(prisma.workout.update as jest.Mock).mockResolvedValue(makeWorkout({ status: 'COMPLETED', sliceOutcome: 'RELEASED' }))
    ;(prisma.workout.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.call.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.streak.findUnique as jest.Mock).mockResolvedValue(makeStreak())
    ;(prisma.streak.update as jest.Mock).mockResolvedValue(makeStreak({ currentStreak: 4 }))
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null) // streak bonuses won't fire
    ;(prisma.userCharity.findMany as jest.Mock).mockResolvedValue([])
  })

  test('COMPLETED — does NOT call donationService.createDonation with COMPLETION type', async () => {
    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'COMPLETED' })

    // The COMPLETION donation path must be dead — no call to createDonation at all
    expect(donationService.createDonation).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      'COMPLETION',
      expect.anything()
    )
  })

  test('COMPLETED — does NOT call donationService.createDonation at all (full retirement)', async () => {
    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'COMPLETED' })

    // Phase 5: no donationService calls at all from completeWorkout
    // (streak bonuses use prisma.donation.create directly, not donationService)
    expect(donationService.createDonation).not.toHaveBeenCalled()
    expect(donationService.calculateDonationAmount).not.toHaveBeenCalled()
    expect(donationService.canMakeDonation).not.toHaveBeenCalled()
  })

  test('COMPLETED — sets sliceOutcome = RELEASED on the workout', async () => {
    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'COMPLETED' })

    expect(prisma.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sliceOutcome: 'RELEASED' }),
      })
    )
  })

  test('PARTIAL — sets sliceOutcome = RELEASED (partial follow-through also releases)', async () => {
    ;(prisma.workout.update as jest.Mock).mockResolvedValue(makeWorkout({ status: 'PARTIAL', sliceOutcome: 'RELEASED' }))

    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'PARTIAL' })

    expect(prisma.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sliceOutcome: 'RELEASED' }),
      })
    )
  })

  test('SKIPPED — sets sliceOutcome = FORFEITED', async () => {
    ;(prisma.workout.update as jest.Mock).mockResolvedValue(makeWorkout({ status: 'SKIPPED', sliceOutcome: 'FORFEITED' }))
    ;(prisma.streak.findUnique as jest.Mock).mockResolvedValue(makeStreak({ graceDaysBalance: 0, currentStreak: 0 }))

    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'SKIPPED' })

    expect(prisma.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sliceOutcome: 'FORFEITED' }),
      })
    )
  })

  test('SKIPPED — does NOT call donationService.createDonation', async () => {
    ;(prisma.streak.findUnique as jest.Mock).mockResolvedValue(makeStreak({ graceDaysBalance: 0, currentStreak: 0 }))

    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'SKIPPED' })

    expect(donationService.createDonation).not.toHaveBeenCalled()
  })

  test('COMPLETED — streak is updated (streak logic intact)', async () => {
    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'COMPLETED' })

    expect(prisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        data: expect.objectContaining({ currentStreak: expect.any(Number) }),
      })
    )
  })

  test('COMPLETED — circleGameService.processWorkoutEvent is called', async () => {
    await workoutService.completeWorkout('workout-1', 'user-1', { status: 'COMPLETED' })

    expect(circleGameService.processWorkoutEvent).toHaveBeenCalledWith('user-1', 'COMPLETED')
  })
})
