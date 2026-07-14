/**
 * ops-alert — unit tests
 *
 *   O1 — opsAlert never throws, even when every sink fails
 *   O2 — throttle: repeats of the same severity:source:title inside the window
 *        collapse into one Telegram send
 *   O3 — different titles are throttled independently
 *   O4 — opsBatch flush sends exactly ONE Telegram summary for N failures
 *   O5 — opsBatch flush with zero items sends nothing
 *   O6 — info alerts never reach Telegram
 *   O7 — OPS_ALERTS_MUTED silences Telegram but not Sentry
 */

jest.mock('../utils/telegram-admin', () => ({
  sendTelegramAdmin: jest.fn().mockResolvedValue(undefined),
}))

// No ops_events rows exist → persistence never dedups in these tests
// (cross-instance dedup is exercised via the mocked return values).
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    opsEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ops-1' }),
      update: jest.fn().mockResolvedValue({ id: 'ops-1' }),
    },
  },
}))

jest.mock('../lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}))

jest.mock('../lib/analytics', () => ({
  serverAnalytics: {
    systemFailure: jest.fn(),
  },
}))

import { opsAlert, opsBatch, __resetOpsThrottleForTests } from '../lib/ops-alert'
import { sendTelegramAdmin } from '../utils/telegram-admin'
import { Sentry } from '../lib/sentry'
import { config } from '../config'

const mockTelegram = sendTelegramAdmin as jest.MockedFunction<typeof sendTelegramAdmin>
const mockCaptureMessage = Sentry.captureMessage as jest.Mock
const mockCaptureException = Sentry.captureException as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  __resetOpsThrottleForTests()
})

describe('opsAlert', () => {
  it('O1: never throws even when every sink fails', async () => {
    mockTelegram.mockRejectedValueOnce(new Error('telegram down'))
    mockCaptureMessage.mockImplementationOnce(() => {
      throw new Error('sentry down')
    })

    await expect(
      opsAlert({ severity: 'critical', source: 'test', title: 'sink_failure' })
    ).resolves.toBeUndefined()
  })

  it('O2: repeats inside the window collapse into one Telegram send', async () => {
    for (let i = 0; i < 5; i++) {
      await opsAlert({ severity: 'warn', source: 'test', title: 'repeat', userId: `user-${i}` })
    }

    // Only the first send goes out; the rest are suppressed into the window.
    expect(mockTelegram).toHaveBeenCalledTimes(1)
    // But every occurrence still reaches Sentry.
    expect(mockCaptureMessage).toHaveBeenCalledTimes(5)
  })

  it('O3: different titles are throttled independently', async () => {
    await opsAlert({ severity: 'warn', source: 'test', title: 'alpha' })
    await opsAlert({ severity: 'warn', source: 'test', title: 'beta' })

    expect(mockTelegram).toHaveBeenCalledTimes(2)
  })

  it('O6: info alerts never reach Telegram', async () => {
    await opsAlert({ severity: 'info', source: 'test', title: 'fyi' })

    expect(mockTelegram).not.toHaveBeenCalled()
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
  })

  it('O7: OPS_ALERTS_MUTED silences Telegram but not Sentry', async () => {
    const original = config.ops.alertsMuted
    ;(config.ops as any).alertsMuted = true
    try {
      await opsAlert({ severity: 'critical', source: 'test', title: 'muted' })
      expect(mockTelegram).not.toHaveBeenCalled()
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
    } finally {
      ;(config.ops as any).alertsMuted = original
    }
  })

  it('cross-instance dedup: skips Telegram when an in-window OpsEvent row exists', async () => {
    const prismaMock = (await import('../utils/prisma')).default as any
    prismaMock.opsEvent.findFirst.mockResolvedValueOnce({ id: 'existing-row' })

    await opsAlert({ severity: 'warn', source: 'test', title: 'db_dedup' })

    expect(mockTelegram).not.toHaveBeenCalled()
    expect(prismaMock.opsEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-row' } })
    )
  })

  it('routes error objects to captureException with tags', async () => {
    const boom = new Error('boom')
    await opsAlert({ severity: 'warn', source: 'test', title: 'with_error', error: boom })

    expect(mockCaptureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({
        tags: expect.objectContaining({ ops_source: 'test', ops_title: 'with_error' }),
      })
    )
  })
})

describe('opsBatch', () => {
  it('O4: flush sends exactly ONE Telegram summary for N failures', async () => {
    const batch = opsBatch('cron-test')
    for (let i = 0; i < 7; i++) {
      batch.add({ severity: 'warn', title: 'item_failed', userId: `user-${i}`, error: new Error(`e${i}`) })
    }
    await batch.flush()

    expect(mockTelegram).toHaveBeenCalledTimes(1)
    const text = mockTelegram.mock.calls[0][0]
    expect(text).toContain('7 failures')
    expect(text).toContain('item_failed')
    // One aggregated Sentry event, not seven.
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
  })

  it('O5: flush with zero items sends nothing', async () => {
    const batch = opsBatch('cron-test')
    await batch.flush()

    expect(mockTelegram).not.toHaveBeenCalled()
    expect(mockCaptureMessage).not.toHaveBeenCalled()
  })

  it('escalates the batch to critical when any item is critical', async () => {
    const batch = opsBatch('cron-test')
    batch.add({ severity: 'warn', title: 'minor' })
    batch.add({ severity: 'critical', title: 'money_gone' })
    await batch.flush()

    const text = mockTelegram.mock.calls[0][0]
    expect(text).toContain('🔴')
  })

  it('a single alert after a batch flush is deduped against it', async () => {
    const batch = opsBatch('cron-test')
    batch.add({ severity: 'warn', title: 'same_title' })
    await batch.flush()
    expect(mockTelegram).toHaveBeenCalledTimes(1)

    await opsAlert({ severity: 'warn', source: 'cron-test', title: 'same_title' })
    // Suppressed into the window opened by the batch flush.
    expect(mockTelegram).toHaveBeenCalledTimes(1)
  })
})
