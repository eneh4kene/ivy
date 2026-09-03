/**
 * Two by Two — interdependence without opposition.
 *
 * A day banks for the room only when BOTH of a pair keep it. Nobody can win by
 * anyone else failing, and the only thing that crosses between two members is
 * whether a day counts — no money, which the stake fence forbids anyway.
 *
 * The load-bearing rules under test:
 *   - a lone kept day banks nothing; the pair's second half banks it
 *   - banking is idempotent (both partners fire an event for the same day)
 *   - the day is each member's OWN local day, so partners in different
 *     timezones still bank the same Tuesday
 *   - a partner's KEPT day is announced to them; a partner's MISS never is
 */

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    circleGame: { findFirst: jest.fn(), update: jest.fn() },
    circleGameEvent: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    ivyCircleMember: { findFirst: jest.fn(), findMany: jest.fn() },
    memberBlock: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  },
}))

const mockPostIvyMessage = jest.fn().mockResolvedValue(undefined)
jest.mock('../../services/chat.service', () => ({
  __esModule: true,
  default: { postIvyMessage: (...args: any[]) => mockPostIvyMessage(...args) },
}))

jest.mock('../../services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue({}),
  pushTemplates: { batonPassed: jest.fn().mockReturnValue({ title: '', body: '' }) },
}))

import prisma from '../../utils/prisma'
import circleGameService from '../../services/circle-game.service'

const mockPrisma = prisma as any
const CIRCLE_ID = 'circle-001'
const [AMARA, SAM, RUTH] = ['u-amara', 'u-sam', 'u-ruth']

function pairsGame(state: Record<string, any> = {}, rules: Record<string, any> = {}) {
  return {
    id: 'game-pairs-001',
    circleId: CIRCLE_ID,
    templateType: 'pairs',
    name: 'Two by Two',
    description: null,
    rules: { pairs: [[AMARA, SAM]], solo: [RUTH], target: 20, deadline_days: 14, ...rules },
    state: { banked: 0, pair_banked: {}, day_kept: {}, ...state },
    ivyInstruction: 'run it',
    status: 'active',
    createdAt: new Date(),
  }
}

/** The state written back by the last circleGame.update. */
function writtenState() {
  const calls = mockPrisma.circleGame.update.mock.calls
  return calls[calls.length - 1][0].data.state
}

/** Every chat message posted, as [userId, body] pairs. */
function posted(): [string, string][] {
  return mockPostIvyMessage.mock.calls.map((c: any[]) => [c[0], c[1]])
}

/**
 * Beats are deliberately fire-and-forget — a failed beat must never break game
 * state — so they land a few microtasks after the event resolves.
 */
const flush = () => new Promise((r) => setImmediate(r))

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.ivyCircleMember.findFirst.mockResolvedValue({ circleId: CIRCLE_ID })
  mockPrisma.ivyCircleMember.findMany.mockResolvedValue([
    { userId: AMARA, user: { firstName: 'Amara' } },
    { userId: SAM, user: { firstName: 'Sam' } },
    { userId: RUTH, user: { firstName: 'Ruth' } },
  ])
  mockPrisma.circleGame.update.mockResolvedValue({})
  mockPrisma.circleGameEvent.create.mockResolvedValue({ id: 'e1' })
  mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'Europe/London', firstName: 'Amara' })
  mockPrisma.memberBlock.findFirst.mockResolvedValue(null) // no blocks by default
})

describe('banking takes two', () => {
  it('a lone kept day banks nothing and nudges the partner', async () => {
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    await circleGameService.processArmingEvent(AMARA, true)
    await flush()

    expect(writtenState().banked).toBe(0)

    // The moment the mechanic exists for: Sam hears about Amara's KEPT day.
    const toSam = posted().filter(([uid]) => uid === SAM)
    expect(toSam).toHaveLength(1)
    expect(toSam[0][1]).toContain('yours is the one that banks it')
    // And nobody else is told anything — this beat is personal, not a broadcast.
    expect(posted().filter(([uid]) => uid !== SAM)).toHaveLength(0)
  })

  it('the second half of the pair banks the day for the room', async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    mockPrisma.circleGame.findFirst.mockResolvedValue(
      pairsGame({ day_kept: { [today]: [AMARA] } }),
    )

    await circleGameService.processArmingEvent(SAM, true)
    await flush()

    const state = writtenState()
    expect(state.banked).toBe(1)
    expect(state.pair_banked[[AMARA, SAM].sort().join('|')]).toBe(1)

    // Announced to the whole room, both names, no scolding.
    const bodies = posted().map(([, body]) => body)
    expect(bodies.some((b) => b.includes('both kept it') && b.includes('1 of 20'))).toBe(true)
  })

  it('banks once even though both partners fire an event', async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    const key = [AMARA, SAM].sort().join('|')
    mockPrisma.circleGame.findFirst.mockResolvedValue(
      pairsGame({
        day_kept: { [today]: [AMARA, SAM] },
        banked: 1,
        pair_banked: { [key]: 1 },
        banked_days: [`${key}@${today}`],
      }),
    )

    await circleGameService.processArmingEvent(SAM, true)

    expect(writtenState().banked).toBe(1)
  })

  it('an unpaired member banks their kept day alone', async () => {
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    await circleGameService.processArmingEvent(RUTH, true)

    expect(writtenState().banked).toBe(1)
  })
})

describe('the day is each member\'s own day', () => {
  it('two partners in different timezones bank the same date', async () => {
    // Amara keeps her Tuesday in London; Sam keeps his Tuesday in Denver,
    // which is already Wednesday in UTC. Bucketing on server time would put
    // them on different days and the pair would never bank.
    const tuesday = '2026-09-01'
    jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue(tuesday)
    mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'America/Denver', firstName: 'Sam' })
    mockPrisma.circleGame.findFirst.mockResolvedValue(
      pairsGame({ day_kept: { [tuesday]: [AMARA] } }),
    )

    await circleGameService.processArmingEvent(SAM, true)

    expect(writtenState().banked).toBe(1)
    jest.restoreAllMocks()
  })
})

describe('a miss is recorded, never reported', () => {
  it('tells nobody when a member misses, not even their partner', async () => {
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    await circleGameService.processArmingEvent(AMARA, false)
    await flush()

    expect(writtenState().banked).toBe(0)
    // Naming a miss to a partner would turn the mechanic into surveillance.
    expect(posted()).toHaveLength(0)
  })

  it('a miss does not un-bank a day the pair already earned', async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    const key = [AMARA, SAM].sort().join('|')
    mockPrisma.circleGame.findFirst.mockResolvedValue(
      pairsGame({ banked: 4, pair_banked: { [key]: 4 }, day_kept: { [today]: [AMARA, SAM] } }),
    )

    await circleGameService.processArmingEvent(AMARA, false)

    expect(writtenState().banked).toBe(4)
  })
})

describe('the room wins together', () => {
  it('hitting the target ends the game as a collective win', async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    mockPrisma.circleGame.findFirst.mockResolvedValue(
      pairsGame({ banked: 19, day_kept: { [today]: [AMARA] } }, { target: 20 }),
    )

    await circleGameService.processArmingEvent(SAM, true)
    await flush()

    const won = mockPrisma.circleGameEvent.create.mock.calls
      .find((c: any[]) => c[0].data.eventType === 'game_won')
    expect(won).toBeDefined()
    // No individual crown: this win belongs to the room, so it crowns nobody
    // and cannot start a defence run.
    expect(won![0].data.payload.collective).toBe(true)

    expect(posted().some(([, b]) => b.includes('not one of them counted alone'))).toBe(true)
  })
})

describe('a block silences the pair without breaking the game', () => {
  it('stops the named nudge, and still banks the day', async () => {
    // A block stops CONTACT. A beat arriving in your thread with the name of
    // the person you blocked in it IS contact — but banking needs no
    // interaction at all, so the game underneath carries on untouched.
    mockPrisma.memberBlock.findFirst.mockResolvedValue({ id: 'block-1' })
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    await circleGameService.processArmingEvent(AMARA, true)
    await flush()

    expect(posted().filter(([uid]) => uid === SAM)).toHaveLength(0)

    // Their half is still recorded — the pair can still bank.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
    expect(writtenState().day_kept[today]).toContain(AMARA)
  })

  it('keeps the partner out of the standing Ivy reads aloud', async () => {
    mockPrisma.memberBlock.findFirst.mockResolvedValue({ id: 'block-1' })
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    const active = await circleGameService.getActiveGameForUser(AMARA)

    expect(active!.stateSummary).not.toContain('Sam')
    expect(active!.stateSummary).toContain('Do NOT name their partner')
  })

  it('names the partner normally when there is no block', async () => {
    mockPrisma.circleGame.findFirst.mockResolvedValue(pairsGame())

    const active = await circleGameService.getActiveGameForUser(AMARA)

    expect(active!.stateSummary).toContain('Sam')
    expect(active!.stateSummary).not.toContain('Do NOT name')
  })
})
