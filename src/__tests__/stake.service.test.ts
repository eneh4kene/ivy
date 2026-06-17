/**
 * Stake Service — Guardrail Unit Tests
 *
 * These tests enforce the NON-NEGOTIABLE guardrails from §7 of
 * docs/product-pricing-rework.md.  Stripe and Prisma are fully mocked —
 * no network calls, no DB, no real money.
 *
 * Guardrails under test:
 *   G1 — Forfeited money NEVER credited to an Ivy-owned account.
 *          → captured amount always goes to a Donation with charityId, never
 *            to an internal/Ivy account.
 *   G2 — Released slices are NEVER captured.
 *          → Stripe capture is called ONLY with the forfeited sum;
 *            all-success cycles cancel the PI (zero capture).
 *   G3 — MIDDLE mode routes to a Charity.isHouseDefault charity.
 *   G4 — SAVAGE mode routes to user.dislikedCharityId.
 *   G5 — Grace skip suppresses exactly one forfeit per cycle; subsequent
 *          forfeits are not waived.
 *   G6 — Donations carry source=USER_STAKE, donationType=STAKE_FORFEIT
 *          (pass-through audit trail; never Ivy revenue).
 *
 * Additional tests:
 *   - openStakeCycle rejects stake < floor (£7/week)
 *   - openStakeCycle rejects duplicate open cycles
 *   - settleStakeCycle rejects non-AUTHORIZED cycles
 *   - SAVAGE with no dislikedCharityId throws (setup guard)
 *   - MIDDLE with no house charity throws (config guard)
 */

// ---------------------------------------------------------------------------
// Jest module mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

// Mock prisma
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stakeCycle: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workout: {
      updateMany: jest.fn(),
    },
    charity: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    donation: {
      create: jest.fn(),
    },
  },
}))

// Mock Stripe constructor.
// We create a stable stripe instance object so that clearMocks doesn't destroy
// the function references — clearMocks resets implementations but keeps the jest.fn()
// identity.  We re-apply mockResolvedValue in each test.
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    cancel: jest.fn(),
  },
  customers: {
    create: jest.fn(),
  },
}

// Shorthand aliases for convenience in tests
const mockStripeCreate = mockStripeInstance.paymentIntents.create
const mockStripeCapture = mockStripeInstance.paymentIntents.capture
const mockStripeCancel = mockStripeInstance.paymentIntents.cancel
const mockStripeCustomerCreate = mockStripeInstance.customers.create

jest.mock('stripe', () => {
  // Return a constructor that always returns our stable mockStripeInstance
  return jest.fn().mockReturnValue(mockStripeInstance)
})

// Mock every-org — we do NOT dispatch real donations in tests
jest.mock('../services/every-org.service', () => ({
  dispatchPendingDonationsForUser: jest.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '../utils/prisma'
import Stripe from 'stripe'
import {
  openStakeCycle,
  settleStakeCycle,
} from '../services/stake.service'
import { dispatchPendingDonationsForUser } from '../services/every-org.service'

// Convenience typed mock accessors
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const MockStripe = Stripe as jest.MockedClass<typeof Stripe>

// ---------------------------------------------------------------------------
// Global beforeEach — re-establish Stripe constructor mock after clearMocks
// clearMocks: true resets mockReturnValue implementations between tests.
// Re-setting it here ensures every test gets a valid Stripe instance.
// ---------------------------------------------------------------------------
beforeEach(() => {
  MockStripe.mockReturnValue(mockStripeInstance as any)
  // Default resolutions for Stripe calls (individual tests override as needed)
  mockStripeCreate.mockResolvedValue({ id: 'pi_test_001', status: 'requires_confirmation' })
  mockStripeCapture.mockResolvedValue({ id: 'pi_test_001', status: 'succeeded' })
  mockStripeCancel.mockResolvedValue({ id: 'pi_test_001', status: 'canceled' })
  mockStripeCustomerCreate.mockResolvedValue({ id: 'cus_test_001' })
  // Default donation create return
  ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
  // Default stakeCycle update
  ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({})
  // Default workout updateMany
  ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
})

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_USER = {
  id: 'user-001',
  email: 'test@ivy.app',
  firstName: 'Alice',
  lastName: 'Test',
  currency: 'GBP',
  stripeCustomerId: 'cus_existing',
  // Plain number — Prisma Decimal fields return objects in production, but since
  // prisma is fully mocked here the service receives whatever the mock returns.
  // The service calls Number() on these, so plain numbers work correctly.
  stakeWeeklyAmount: 14,
  forfeitMode: 'MIDDLE' as const,
  dislikedCharityId: null,
}

const HOUSE_CHARITY = { id: 'charity-house-001', isActive: true, isHouseDefault: true }
const SAVAGE_CHARITY = { id: 'charity-savage-001', isActive: true }

const FAKE_PI = {
  id: 'pi_test_001',
  status: 'requires_confirmation',
}

const FAKE_CYCLE_AUTHORIZED = {
  id: 'cycle-001',
  userId: 'user-001',
  status: 'AUTHORIZED' as const,
  stakeAmount: 14,           // plain number (Number(14) === 14)
  stripePaymentIntentId: 'pi_test_001',
  capturedAmount: 0,
  daysArmed: 5,
  daysCompleted: 5,
  daysForfeited: 0,
  graceUsed: 0,
  periodStart: new Date('2026-06-09'),
  periodEnd: new Date('2026-06-16'),
  workouts: [],
  user: { ...BASE_USER },
}

// ---------------------------------------------------------------------------
// Helpers to set up prisma mocks for the happy path
// ---------------------------------------------------------------------------

function setupOpenStakeMocks(userOverrides: Partial<typeof BASE_USER> = {}) {
  const user = { ...BASE_USER, ...userOverrides }
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user)
  ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(null) // no existing open cycle
  mockStripeCreate.mockResolvedValue(FAKE_PI)
  ;(mockPrisma.stakeCycle.create as jest.Mock).mockResolvedValue({
    id: 'cycle-001',
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 7 * 86400000),
    stakeAmount: 14,
    stripePaymentIntentId: 'pi_test_001',
    status: 'AUTHORIZED',
  })
}

// ---------------------------------------------------------------------------
// G-open: openStakeCycle tests
// ---------------------------------------------------------------------------

describe('openStakeCycle', () => {
  beforeEach(() => {
    // Set STRIPE_SECRET_KEY so getStripe() doesn't throw
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('creates a PaymentIntent with capture_method: manual (G2)', async () => {
    setupOpenStakeMocks()
    await openStakeCycle('user-001')

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: 'manual' })
    )
  })

  it('does NOT call capture() during openStakeCycle (G2 — no premature capture)', async () => {
    setupOpenStakeMocks()
    await openStakeCycle('user-001')
    expect(mockStripeCapture).not.toHaveBeenCalled()
  })

  it('persists StakeCycle with status AUTHORIZED', async () => {
    setupOpenStakeMocks()
    await openStakeCycle('user-001')

    expect(mockPrisma.stakeCycle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AUTHORIZED' }),
      })
    )
  })

  it('rejects stake below the £7/week minimum (§9 decision 2)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_USER,
      stakeWeeklyAmount: 5, // below £7 floor
    })

    await expect(openStakeCycle('user-001')).rejects.toThrow(/at least.*7.*week/i)
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })

  it('rejects null stakeWeeklyAmount', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_USER,
      stakeWeeklyAmount: null,
    })

    await expect(openStakeCycle('user-001')).rejects.toThrow(/at least/)
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })

  it('rejects if an AUTHORIZED cycle already exists (no duplicate cycles)', async () => {
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(BASE_USER)
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue({ id: 'cycle-existing' })

    await expect(openStakeCycle('user-001')).rejects.toThrow(/already has an open stake cycle/)
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })

  it('PaymentIntent metadata flags pass-through (G6 audit trail)', async () => {
    setupOpenStakeMocks()
    await openStakeCycle('user-001')

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          guardrail: 'PASS_THROUGH_NOT_IVY_REVENUE',
        }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// G1: Forfeited money never credited to an Ivy-owned account
// ---------------------------------------------------------------------------

describe('G1 — forfeited money never goes to an Ivy-owned account', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('creates Donation records with a real charityId, not an Ivy internal ID', async () => {
    // One forfeited workout; grace already used so this forfeit is NOT waived
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1, // grace already spent — the one forfeit must be captured
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 2 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    // charityId must be a real charity (HOUSE_CHARITY.id), not undefined/null/'ivy'
    expect(donationCall.data.charityId).toBe(HOUSE_CHARITY.id)
    expect(donationCall.data.charityId).not.toBe(undefined)
    expect(donationCall.data.charityId).not.toBe(null)
    // Must not look like an Ivy internal identifier
    expect(donationCall.data.charityId).not.toMatch(/^ivy/i)
  })

  it('never creates a Donation when captureAmount is 0 (all success — nothing to forfeit)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      workouts: [
        { id: 'w1', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w2', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 0 })
    mockStripeCancel.mockResolvedValue({ status: 'canceled' })

    await settleStakeCycle('cycle-001')

    expect(mockPrisma.donation.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// G2: Released slices are never captured
// ---------------------------------------------------------------------------

describe('G2 — released slices are never captured', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('cancels the PaymentIntent (never captures) when all slices are released', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      workouts: [
        { id: 'w1', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w2', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w3', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 0 })
    mockStripeCancel.mockResolvedValue({ status: 'canceled' })

    const result = await settleStakeCycle('cycle-001')

    expect(mockStripeCapture).not.toHaveBeenCalled()   // G2: never captured
    expect(mockStripeCancel).toHaveBeenCalledTimes(1)  // PI cancelled (released)
    expect(result.capturedAmount).toBe(0)
  })

  it('captures ONLY the forfeited portion, not the released portion (partial capture)', async () => {
    // 3 workouts: 1 forfeited (£2), 2 released (£2 each) → should capture £2, release £12
    // graceUsed: 1 so the single forfeit is NOT waived by grace
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      stakeAmount: 14,
      workouts: [
        { id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w2', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w3', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 2 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    const result = await settleStakeCycle('cycle-001')

    // Stripe capture called with ONLY the forfeited amount (£2 = 200 pence)
    expect(mockStripeCapture).toHaveBeenCalledWith(
      'pi_test_001',
      { amount_to_capture: 200 }
    )
    expect(mockStripeCancel).not.toHaveBeenCalled() // not cancelled — partial capture only
    expect(result.capturedAmount).toBe(2)
    expect(result.releasedAmount).toBe(12) // 14 - 2
  })

  it('result.releasedAmount is never negative', async () => {
    // Edge case: forfeited amount should never exceed stakeAmount
    // graceUsed: 1 ensures the forfeit is captured, not waived
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      stakeAmount: 14,
      workouts: [
        { id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    const result = await settleStakeCycle('cycle-001')
    expect(result.releasedAmount).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// G3: MIDDLE mode routes to house default charity
// ---------------------------------------------------------------------------

describe('G3 — MIDDLE forfeit mode routes to house-default charity', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('uses Charity.isHouseDefault for MIDDLE forfeit mode', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1, // grace already used — forfeit must be captured
      user: { ...BASE_USER, forfeitMode: 'MIDDLE' as const, dislikedCharityId: null },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    // Must query for isHouseDefault: true
    expect(mockPrisma.charity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHouseDefault: true }),
      })
    )

    // Donation must go to the house charity
    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    expect(donationCall.data.charityId).toBe(HOUSE_CHARITY.id)
  })

  it('throws if no house-default charity is configured (config guard)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      user: { ...BASE_USER, forfeitMode: 'MIDDLE' as const },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(null) // no house charity

    await expect(settleStakeCycle('cycle-001')).rejects.toThrow(/house-default charity/i)
    expect(mockStripeCapture).not.toHaveBeenCalled()
  })

  it('does NOT use user.dislikedCharityId for MIDDLE mode', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      user: { ...BASE_USER, forfeitMode: 'MIDDLE' as const, dislikedCharityId: 'charity-savage-001' },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    // Must go to HOUSE charity, not the disliked one (even though dislikedCharityId is set)
    expect(donationCall.data.charityId).toBe(HOUSE_CHARITY.id)
    expect(donationCall.data.charityId).not.toBe('charity-savage-001')
  })
})

// ---------------------------------------------------------------------------
// G4: SAVAGE mode routes to user's dislikedCharityId
// ---------------------------------------------------------------------------

describe('G4 — SAVAGE forfeit mode routes to user.dislikedCharityId', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('uses dislikedCharityId for SAVAGE forfeit mode', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      user: { ...BASE_USER, forfeitMode: 'SAVAGE' as const, dislikedCharityId: SAVAGE_CHARITY.id },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findUnique as jest.Mock).mockResolvedValue(SAVAGE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    expect(donationCall.data.charityId).toBe(SAVAGE_CHARITY.id)
  })

  it('does NOT route SAVAGE to the house-default charity', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      user: { ...BASE_USER, forfeitMode: 'SAVAGE' as const, dislikedCharityId: SAVAGE_CHARITY.id },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findUnique as jest.Mock).mockResolvedValue(SAVAGE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    // findFirst (house charity lookup) must NOT be called for SAVAGE
    expect(mockPrisma.charity.findFirst).not.toHaveBeenCalled()
    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    expect(donationCall.data.charityId).not.toBe(HOUSE_CHARITY.id)
  })

  it('throws if SAVAGE mode has no dislikedCharityId (setup guard)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      user: { ...BASE_USER, forfeitMode: 'SAVAGE' as const, dislikedCharityId: null },
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)

    await expect(settleStakeCycle('cycle-001')).rejects.toThrow(/dislikedCharityId/)
    expect(mockStripeCapture).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// G5: Grace skip suppresses exactly one forfeit per cycle
// ---------------------------------------------------------------------------

describe('G5 — grace skip suppresses exactly one forfeit per cycle', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('converts the first forfeited workout to RELEASED when grace is available', async () => {
    // 2 forfeited workouts; graceUsed=0 → first gets grace, second is captured
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 0,
      workouts: [
        { id: 'w-miss1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w-miss2', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 2 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    const result = await settleStakeCycle('cycle-001')

    // Only ONE forfeit donation (the second workout — w-miss1 got grace)
    expect(mockPrisma.donation.create).toHaveBeenCalledTimes(1)
    // Capture should be for ONE slice (£2), not two (£4)
    expect(mockStripeCapture).toHaveBeenCalledWith('pi_test_001', { amount_to_capture: 200 })
    expect(result.capturedAmount).toBe(2)

    // Grace workout should be updated to RELEASED
    const releaseCall = (mockPrisma.workout.updateMany as jest.Mock).mock.calls.find(
      (call: any[]) => call[0].data.sliceOutcome === 'RELEASED'
    )
    expect(releaseCall).toBeDefined()
    expect(releaseCall[0].where.id.in).toContain('w-miss1')
  })

  it('does NOT apply grace when graceUsed is already at the limit (1)', async () => {
    // graceUsed=1 → no grace remaining → all forfeited workouts are captured
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1, // already used
      workouts: [
        { id: 'w-miss1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 2 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    // One forfeit, no grace applied → donation created and capture called
    expect(mockPrisma.donation.create).toHaveBeenCalledTimes(1)
    expect(mockStripeCapture).toHaveBeenCalledWith('pi_test_001', { amount_to_capture: 200 })
  })

  it('grace suppresses exactly one, not two (even with 3 missed days)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 0,
      workouts: [
        { id: 'w-miss1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w-miss2', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w-miss3', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 4 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    const result = await settleStakeCycle('cycle-001')

    // 3 missed: 1 grace → 2 forfeited → 2 donations, capture £4
    expect(mockPrisma.donation.create).toHaveBeenCalledTimes(2)
    expect(mockStripeCapture).toHaveBeenCalledWith('pi_test_001', { amount_to_capture: 400 })
    expect(result.capturedAmount).toBe(4)
  })

  it('if graceUsed=0 and 0 forfeits, still no donation and PI is cancelled', async () => {
    // Perfect week — zero missed days
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 0,
      workouts: [
        { id: 'w1', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
        { id: 'w2', sliceOutcome: 'RELEASED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 0 })
    mockStripeCancel.mockResolvedValue({ status: 'canceled' })

    await settleStakeCycle('cycle-001')

    expect(mockPrisma.donation.create).not.toHaveBeenCalled()
    expect(mockStripeCapture).not.toHaveBeenCalled()
    expect(mockStripeCancel).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// G6: Donations carry source=USER_STAKE, donationType=STAKE_FORFEIT
// ---------------------------------------------------------------------------

describe('G6 — stake forfeits are never recognised as Ivy revenue', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('donation records have source=USER_STAKE and donationType=STAKE_FORFEIT', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    expect(donationCall.data.source).toBe('USER_STAKE')
    expect(donationCall.data.donationType).toBe('STAKE_FORFEIT')
  })

  it('donation records link back to the stakeCycleId (audit trail)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      id: 'cycle-001',
      graceUsed: 1,
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    const donationCall = (mockPrisma.donation.create as jest.Mock).mock.calls[0][0]
    expect(donationCall.data.stakeCycleId).toBe('cycle-001')
  })

  it('every-org dispatch is called to send forfeited money to charity (not held by Ivy)', async () => {
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1,
      workouts: [{ id: 'w1', sliceOutcome: 'FORFEITED', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' }],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED' })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    // Non-blocking dispatch must be triggered
    // (It's fire-and-forget so we wait a tick)
    await new Promise((r) => setTimeout(r, 0))
    expect(dispatchPendingDonationsForUser).toHaveBeenCalledWith('user-001')
  })
})

// ---------------------------------------------------------------------------
// Error / guard tests
// ---------------------------------------------------------------------------

describe('settleStakeCycle guards', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('throws if cycle not found', async () => {
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(settleStakeCycle('nonexistent')).rejects.toThrow(/not found/i)
  })

  it('throws if cycle is already SETTLED', async () => {
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue({
      ...FAKE_CYCLE_AUTHORIZED,
      status: 'SETTLED',
    })
    await expect(settleStakeCycle('cycle-001')).rejects.toThrow(/not in AUTHORIZED/i)
  })

  it('throws if cycle is VOIDED', async () => {
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue({
      ...FAKE_CYCLE_AUTHORIZED,
      status: 'VOIDED',
    })
    await expect(settleStakeCycle('cycle-001')).rejects.toThrow(/not in AUTHORIZED/i)
  })

  it('throws if no Stripe PaymentIntent on record', async () => {
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue({
      ...FAKE_CYCLE_AUTHORIZED,
      stripePaymentIntentId: null,
    })
    await expect(settleStakeCycle('cycle-001')).rejects.toThrow(/no Stripe PaymentIntent/i)
  })
})

// ---------------------------------------------------------------------------
// PENDING workout handling (unarmed = miss)
// ---------------------------------------------------------------------------

describe('PENDING workouts treated as forfeit at settlement', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('treats PENDING (unarmed) slices as forfeited at settlement time', async () => {
    // A workout that was never armed — sliceOutcome is still PENDING at cycle end
    const cycle = {
      ...FAKE_CYCLE_AUTHORIZED,
      graceUsed: 1, // grace already used — no waiver
      workouts: [
        { id: 'w-unarmed', sliceOutcome: 'PENDING', stakeSliceAmount: 2, stakeCycleId: 'cycle-001' },
      ],
    }
    ;(mockPrisma.stakeCycle.findUnique as jest.Mock).mockResolvedValue(cycle)
    ;(mockPrisma.charity.findFirst as jest.Mock).mockResolvedValue(HOUSE_CHARITY)
    ;(mockPrisma.workout.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.donation.create as jest.Mock).mockResolvedValue({ id: 'don-001' })
    ;(mockPrisma.stakeCycle.update as jest.Mock).mockResolvedValue({ ...cycle, status: 'SETTLED', capturedAmount: 2 })
    mockStripeCapture.mockResolvedValue({ status: 'succeeded' })

    await settleStakeCycle('cycle-001')

    expect(mockPrisma.donation.create).toHaveBeenCalledTimes(1)
    expect(mockStripeCapture).toHaveBeenCalledWith('pi_test_001', { amount_to_capture: 200 })
  })
})
