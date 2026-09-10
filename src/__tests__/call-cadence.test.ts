/**
 * Call cadence — which days ring, and what happens on the days that don't.
 *
 * `callFrequency` has existed in the schema since the beginning, been validated
 * 1-7, and been read into Ivy's own prompt context as "calls_per_week", while
 * nothing in the scheduler ever honoured it: every onboarded member got a call
 * every single day. So Ivy has been stating a cadence the system did not keep.
 *
 * And the `preferredDays` path, which WAS honoured, returned early on a
 * non-preferred day — skipping the evening chat check-in too, so a member on
 * three days a week heard nothing at all on the other four.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    call: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
    message: { findFirst: jest.fn() },
  },
}))

const mockScheduleCall = jest.fn()
const mockCheckIn = jest.fn().mockResolvedValue(undefined)
const mockGetUserContext = jest.fn().mockResolvedValue({})

import prisma from '../utils/prisma'
import callService from '../services/call.service'

const mockPrisma = prisma as any
const USER = 'u-1'

/**
 * Weekdays computed RELATIVE to now, always 1-7 days ahead at 09:00.
 *
 * These were hard-coded absolute dates, which passed on the day they were
 * written and started failing the next morning: scheduleDailyCalls skips an
 * evening slot already in the past, so a fixture dated yesterday schedules
 * nothing and the failure looks like a regression in the scheduler.
 */
const DAY_INDEX = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
function nextWeekday(name: string): Date {
  const target = DAY_INDEX.indexOf(name)
  const d = new Date()
  const delta = ((target - d.getUTCDay() + 7) % 7) || 7 // always strictly ahead
  d.setUTCDate(d.getUTCDate() + delta)
  d.setUTCHours(9, 0, 0, 0)
  return d
}

const THURSDAY = nextWeekday('thursday')
const WEDNESDAY = nextWeekday('wednesday')
const SUNDAY = nextWeekday('sunday')

function user(over: Record<string, any> = {}) {
  return {
    id: USER,
    morningCallTime: null,
    eveningCallTime: '20:00',
    timezone: 'Europe/London',
    preferredDays: null,
    callFrequency: 3,
    coachId: null,
    morningCallOptIn: false,
    commStyle: null,
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.call.count.mockResolvedValue(0)
  // Intercept the two side effects rather than the whole DB.
  jest.spyOn(callService as any, 'scheduleCall').mockImplementation(mockScheduleCall.mockResolvedValue({ id: 'call-1' }))
  jest.spyOn(callService as any, 'scheduleEveningCheckIn').mockImplementation(mockCheckIn)
  jest.spyOn(callService as any, 'getUserContext').mockImplementation(mockGetUserContext)
})

afterEach(() => jest.restoreAllMocks())

describe('callFrequency is finally honoured', () => {
  it('calls on a cadence day', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user())

    await callService.scheduleDailyCalls(USER, THURSDAY) // Thursday is in the 3/wk set

    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
    expect(mockScheduleCall.mock.calls[0][1]).toBe('EVENING_REVIEW')
    expect(mockCheckIn).not.toHaveBeenCalled()
  })

  it('texts instead of calling on an off day — never goes silent', async () => {
    // The defect this replaces: the old early return skipped the check-in too,
    // so four days a week a member heard nothing.
    mockPrisma.user.findUnique.mockResolvedValue(user())

    await callService.scheduleDailyCalls(USER, WEDNESDAY) // not in the 3/wk set

    expect(mockScheduleCall).not.toHaveBeenCalled()
    expect(mockCheckIn).toHaveBeenCalledWith(USER)
  })

  it('always calls on Sunday, whatever the frequency', async () => {
    // Sunday is the last day of the week — the cycle opens Monday — so it is
    // where a week gets closed out. True with or without a stake; stakes are
    // optional, so settlement is the extra reason, never the reason.
    for (const freq of [1, 2, 3, 4, 5, 6]) {
      jest.clearAllMocks()
      mockPrisma.call.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue(user({ callFrequency: freq }))

      await callService.scheduleDailyCalls(USER, SUNDAY)

      expect(mockScheduleCall).toHaveBeenCalledTimes(1)
    }
  })

  it('calls every day at frequency 7', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ callFrequency: 7 }))

    await callService.scheduleDailyCalls(USER, WEDNESDAY)

    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
  })
})

describe('preferredDays is an explicit choice and overrides frequency', () => {
  it('honours the chosen days', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ preferredDays: JSON.stringify(['wednesday']), callFrequency: 3 }),
    )

    await callService.scheduleDailyCalls(USER, WEDNESDAY) // not a 3/wk day, but chosen

    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
  })

  it('a malformed row falls back to frequency instead of silencing them', async () => {
    // The parse used to be unguarded inside the per-user loop, so one bad value
    // meant that person got no calls at all.
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ preferredDays: '{not json', callFrequency: 3 }),
    )

    await callService.scheduleDailyCalls(USER, THURSDAY)

    expect(mockScheduleCall).toHaveBeenCalledTimes(1)
  })

  it('an empty array falls back to frequency', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      user({ preferredDays: '[]', callFrequency: 3 }),
    )

    await callService.scheduleDailyCalls(USER, WEDNESDAY)

    expect(mockScheduleCall).not.toHaveBeenCalled()
    expect(mockCheckIn).toHaveBeenCalled()
  })
})

describe('text-preferred members are unaffected', () => {
  it('still gets a chat check-in on a call day', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ commStyle: 'TEXTS' }))

    await callService.scheduleDailyCalls(USER, THURSDAY)

    expect(mockScheduleCall).not.toHaveBeenCalled()
    expect(mockCheckIn).toHaveBeenCalledWith(USER)
  })
})
