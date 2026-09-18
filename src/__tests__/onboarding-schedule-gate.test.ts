/**
 * eveningCallTime is the master switch for the ENTIRE daily loop.
 *
 * scheduleDailyCalls wraps the call AND the text check-in in
 * `if (user.eveningCallTime)`, so a member who completes onboarding without one
 * is never contacted again — by any channel, silently. markUserAsOnboarded
 * SELECTED the field and never checked it, and a real client sat in that state
 * for a week looking entirely healthy: PRO, phone verified, in a circle,
 * zero calls.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn(), update: jest.fn() } },
}))

jest.mock('../lib/analytics', () => ({ serverAnalytics: { onboardingCompletedServer: jest.fn() } }))

import prisma from '../utils/prisma'
import userService, { DEFAULT_EVENING_CALL_TIME } from '../services/user.service'

const mockPrisma = prisma as any
const USER = 'u-1'

const base = {
  id: USER, goal: 'run a 10k', morningCallTime: null, eveningCallTime: '19:00',
  phone: '+447700900000', subscriptionTier: 'PRO', timezone: 'Europe/London',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.user.update.mockResolvedValue({ id: USER, isOnboarded: true, onboardedAt: new Date() })
})

/** The data passed to the onboarding update. */
const written = () => mockPrisma.user.update.mock.calls[0][0].data

describe('a member can never finish onboarding uncontactable', () => {
  it('defaults the evening time when they have none', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...base, eveningCallTime: null })

    await userService.markUserAsOnboarded(USER)

    expect(written().eveningCallTime).toBe(DEFAULT_EVENING_CALL_TIME)
    expect(written().isOnboarded).toBe(true)
  })

  it('leaves a time they actually chose alone', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(base)

    await userService.markUserAsOnboarded(USER)

    expect(written().eveningCallTime).toBeUndefined()
  })

  it('DEFAULTS rather than blocking — silence is the worse failure', async () => {
    // Blocking would fail onboarding for anyone already past the schedule step.
    // A call at a slightly wrong hour is recoverable in one sentence; a call
    // that never comes is never reported, because nobody chases one they did
    // not know to expect.
    mockPrisma.user.findUnique.mockResolvedValue({ ...base, eveningCallTime: null })

    await expect(userService.markUserAsOnboarded(USER)).resolves.toBeTruthy()
  })

  it('still refuses without a phone', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...base, phone: null })
    await expect(userService.markUserAsOnboarded(USER)).rejects.toThrow(/phone number is required/i)
  })

  it('does not impose a call time on a coach', async () => {
    // Coaches receive ponder calls, not the daily loop.
    mockPrisma.user.findUnique.mockResolvedValue({ ...base, subscriptionTier: 'COACH', phone: null, eveningCallTime: null })

    await userService.markUserAsOnboarded(USER)

    expect(written().eveningCallTime).toBeUndefined()
  })
})
