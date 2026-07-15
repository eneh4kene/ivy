/**
 * Commitment-time capture — unit tests
 *
 *   W1 — writes plannedTime when the model returns a clear future HH:MM
 *   W2 — no-op when the model returns NONE
 *   W3 — no-op when today's workout already has a plannedTime (query excludes it)
 *   W4 — never overwrites: extracted time only lands on rows with plannedTime null
 *   W5 — skips a time already past in the user's timezone
 *   W6 — never throws when the model call fails (alerts instead)
 *   W7 — normalizes single-digit hours ("6:30" → "06:30")
 */

process.env.ANTHROPIC_API_KEY = 'test-key'

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    workout: { findFirst: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('../lib/ops-alert', () => ({
  opsAlert: jest.fn().mockResolvedValue(undefined),
  opsBatch: jest.fn(),
}))

jest.mock('../lib/analytics', () => ({
  serverAnalytics: { plannedTimeCaptured: jest.fn() },
}))

jest.mock('../services/usage.service', () => ({
  logUsage: jest.fn().mockResolvedValue(undefined),
}))

import prisma from '../utils/prisma'
import { opsAlert } from '../lib/ops-alert'
import { serverAnalytics } from '../lib/analytics'
import commitmentTimeService from '../services/commitment-time.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

function modelReplies(text: string) {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text }],
    usage: { input_tokens: 10, output_tokens: 3 },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
  // 10:00 UTC = 11:00 in Europe/London (BST) — evening times are still future.
  jest.setSystemTime(new Date('2026-07-15T10:00:00Z'))
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ timezone: 'Europe/London' })
  ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-1' })
  ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({ id: 'workout-1' })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('commitmentTimeService.captureFromText', () => {
  it('W1: writes plannedTime for a clear future time', async () => {
    modelReplies('18:00')

    await commitmentTimeService.captureFromText('user-1', 'I will run at 6pm today', 'voice_note')

    expect(mockPrisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { plannedTime: '18:00' },
    })
    expect(serverAnalytics.plannedTimeCaptured).toHaveBeenCalledWith('user-1', 'voice_note')
  })

  it('W2: no-op when the model returns NONE', async () => {
    modelReplies('NONE')

    await commitmentTimeService.captureFromText('user-1', 'I will train later today', 'call')

    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('W3/W4: no-op when no eligible workout (plannedTime already set or none today)', async () => {
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue(null)

    await commitmentTimeService.captureFromText('user-1', 'I will run at 6pm', 'call')

    // Query itself enforces plannedTime: null — model never even consulted.
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
    const query = (mockPrisma.workout.findFirst as jest.Mock).mock.calls[0][0]
    expect(query.where.plannedTime).toBeNull()
    expect(query.where.status).toBe('PLANNED')
  })

  it('W5: skips a time already past in the user timezone', async () => {
    modelReplies('07:00') // 07:00 London < 11:00 London now

    await commitmentTimeService.captureFromText('user-1', 'tomorrow at 7am', 'call')

    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('W6: never throws when the model call fails — alerts instead', async () => {
    mockCreate.mockRejectedValue(new Error('anthropic down'))

    await expect(
      commitmentTimeService.captureFromText('user-1', 'run at 6pm', 'voice_note')
    ).resolves.toBeUndefined()

    expect(opsAlert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'commitment-time', title: 'when_capture_failed' })
    )
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('W7: normalizes single-digit hours', async () => {
    // Early morning so a single-digit hour is still in the future:
    // 05:00 UTC = 06:00 London; "6:30" → 06:30 London, 30 min out.
    jest.setSystemTime(new Date('2026-07-15T05:00:00Z'))
    modelReplies('6:30')

    await commitmentTimeService.captureFromText('user-1', 'half six run', 'call')

    expect(mockPrisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { plannedTime: '06:30' },
    })
  })
})
