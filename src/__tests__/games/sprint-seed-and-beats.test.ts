/**
 * The sprint seed and the beats that reach a call.
 *
 * Two changes under test, both aimed at the same thing — a game that can be
 * TALKED about rather than only reported:
 *
 *  1. seedSprintPact defaults to the BATON RELAY. The 80% Pact is a shared
 *     counter with no turn in it; the relay puts the baton in one person's
 *     hands for a window. The Pact remains the fallback for a room too small
 *     to pass a baton around.
 *  2. gameBeatsSince surfaces what MOVED since the last call, read back from
 *     the member's own chat thread — so a beat they never received can never
 *     leak into their call.
 */

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    circleGame: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    circleGameEvent: { findFirst: jest.fn(), findMany: jest.fn() },
    workout: { findMany: jest.fn() },
    ivyCircleMember: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    message: { findMany: jest.fn() },
    call: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

jest.mock('../../services/chat.service', () => ({
  __esModule: true,
  default: { postIvyMessage: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('../../services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue({}),
  pushTemplates: { batonPassed: jest.fn().mockReturnValue({ title: '', body: '' }) },
}))

import prisma from '../../utils/prisma'
import circleGameService from '../../services/circle-game.service'

const mockPrisma = prisma as any
const CIRCLE_ID = 'circle-001'

/** Members with names, in join order. */
function seedMembers(n: number) {
  const members = Array.from({ length: n }, (_, i) => ({
    userId: `u${i + 1}`,
    user: { firstName: `Member${i + 1}` },
  }))
  mockPrisma.ivyCircleMember.count.mockResolvedValue(n)
  mockPrisma.ivyCircleMember.findMany.mockResolvedValue(members)
  return members
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.circleGame.findFirst.mockResolvedValue(null)   // no game running
  mockPrisma.circleGame.count.mockResolvedValue(0)          // first game the room has had
  mockPrisma.circleGameEvent.findFirst.mockResolvedValue(null) // no reigning champion
  mockPrisma.circleGameEvent.findMany.mockResolvedValue([]) // no crown lineage
  mockPrisma.workout.findMany.mockResolvedValue([])         // no room record yet
  mockPrisma.user.findUnique.mockResolvedValue({ timezone: 'Europe/London' })
  mockPrisma.circleGame.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: 'game-001', ...data }),
  )
})

describe('seedSprintPact — the relay is the default game', () => {
  it('seeds a baton relay for a room big enough to pass one around', async () => {
    seedMembers(5)

    const game: any = await circleGameService.seedSprintPact(CIRCLE_ID)

    expect(game).not.toBeNull()
    const created = mockPrisma.circleGame.create.mock.calls[0][0].data
    expect(created.templateType).toBe('relay')
    expect(created.name).toBe('The Baton')
    // A real turn: someone holds it, for a bounded window, with lives at stake.
    expect(created.state.current_holder_id).toBe('u1')
    expect(created.state.lives_remaining).toBe(3)
    expect(created.rules.window_hours).toBe(24)
    // Ivy is told to lead with the holder, not with the scoreboard.
    expect(created.ivyInstruction).toContain('current holder')
  })

  it('falls back to the Pact when the room is too small for a relay', async () => {
    seedMembers(2)

    await circleGameService.seedSprintPact(CIRCLE_ID)

    const created = mockPrisma.circleGame.create.mock.calls[0][0].data
    expect(created.templateType).toBe('collective')
    expect(created.name).toBe('The 80% Pact')
  })

  it('alternates to Two by Two on the room\'s second game', async () => {
    // A room plays both shapes across a season rather than the same one
    // forever — and it is the only way pairs get played without being chosen.
    seedMembers(4)
    mockPrisma.circleGame.count.mockResolvedValue(1)

    await circleGameService.seedSprintPact(CIRCLE_ID)

    const created = mockPrisma.circleGame.create.mock.calls[0][0].data
    expect(created.templateType).toBe('pairs')
    expect(created.name).toBe('Two by Two')
    // Paired off in join order, no one left over in an even room.
    expect(created.rules.pairs).toEqual([['u1', 'u2'], ['u3', 'u4']])
    expect(created.rules.solo).toEqual([])
    // Ivy is forbidden from reporting a partner's miss.
    expect(created.ivyInstruction).toContain('NEVER tell anyone their partner missed')
  })

  it('stays on the relay when the room is too small to pair off cleanly', async () => {
    seedMembers(3)
    mockPrisma.circleGame.count.mockResolvedValue(1)

    await circleGameService.seedSprintPact(CIRCLE_ID)

    expect(mockPrisma.circleGame.create.mock.calls[0][0].data.templateType).toBe('relay')
  })

  it('leaves an odd member unpaired rather than forcing a trio', async () => {
    seedMembers(5)
    mockPrisma.circleGame.count.mockResolvedValue(1)

    await circleGameService.seedSprintPact(CIRCLE_ID)

    const created = mockPrisma.circleGame.create.mock.calls[0][0].data
    expect(created.rules.pairs).toEqual([['u1', 'u2'], ['u3', 'u4']])
    expect(created.rules.solo).toEqual(['u5'])
  })

  it('stays a no-op when a game is already running', async () => {
    seedMembers(5)
    mockPrisma.circleGame.findFirst.mockResolvedValue({ id: 'already-running' })

    expect(await circleGameService.seedSprintPact(CIRCLE_ID)).toBeNull()
    expect(mockPrisma.circleGame.create).not.toHaveBeenCalled()
  })
})

describe('gameBeatsSince — what moved, not where things stand', () => {
  // Private by design; the behaviour is what the call path consumes.
  const beatsFor = (userId: string) =>
    (circleGameService as any).gameBeatsSince(userId) as Promise<string | null>

  it('reads beats from the last call onward, oldest first', async () => {
    const lastCall = new Date('2026-09-02T20:00:00Z')
    mockPrisma.call.findFirst.mockResolvedValue({ createdAt: lastCall })
    mockPrisma.message.findMany.mockResolvedValue([
      { content: 'Sam dropped the baton — 2 lives left. Amara has it now.' },
      { content: 'Amara kept the day and passed the baton to Sam.' },
    ])

    const beats = await beatsFor('u1')

    // Reversed into the order they happened in — the order they were read in.
    expect(beats).toBe(
      'Amara kept the day and passed the baton to Sam. Sam dropped the baton — 2 lives left. Amara has it now.',
    )
    const where = mockPrisma.message.findMany.mock.calls[0][0].where
    expect(where.messageType).toBe('circle_game')
    expect(where.userId).toBe('u1')
    expect(where.createdAt.gte).toEqual(lastCall)
  })

  it('clamps a long absence to 7 days rather than reading back a fortnight', async () => {
    mockPrisma.call.findFirst.mockResolvedValue({ createdAt: new Date('2026-08-01T00:00:00Z') })
    mockPrisma.message.findMany.mockResolvedValue([{ content: 'The room is at 12 of 20.' }])

    await beatsFor('u1')

    const since: Date = mockPrisma.message.findMany.mock.calls[0][0].where.createdAt.gte
    const ageDays = (Date.now() - since.getTime()) / 86_400_000
    expect(ageDays).toBeLessThanOrEqual(7.01)
    expect(ageDays).toBeGreaterThan(6.9)
  })

  it('falls back to 48h for someone who has never had a call', async () => {
    mockPrisma.call.findFirst.mockResolvedValue(null)
    mockPrisma.message.findMany.mockResolvedValue([{ content: 'New game on the table: The Baton.' }])

    await beatsFor('u1')

    const since: Date = mockPrisma.message.findMany.mock.calls[0][0].where.createdAt.gte
    const ageDays = (Date.now() - since.getTime()) / 86_400_000
    expect(ageDays).toBeGreaterThan(1.9)
    expect(ageDays).toBeLessThanOrEqual(2.01)
  })

  it('returns null when nothing has happened — no empty aside to spend', async () => {
    mockPrisma.call.findFirst.mockResolvedValue({ createdAt: new Date() })
    mockPrisma.message.findMany.mockResolvedValue([])

    expect(await beatsFor('u1')).toBeNull()
  })
})

describe('crownLineage — a run, never a ranking', () => {
  it('counts consecutive wins by the same champion', async () => {
    mockPrisma.circleGameEvent.findMany.mockResolvedValue([
      { userId: 'u1', payload: { winner_id: 'u1' }, game: { templateType: 'relay' } },
      { userId: 'u1', payload: { winner_id: 'u1' }, game: { templateType: 'points_race' } },
      { userId: 'u2', payload: { winner_id: 'u2' }, game: { templateType: 'relay' } },
    ])

    expect(await circleGameService.crownLineage(CIRCLE_ID)).toEqual({ championId: 'u1', defences: 2 })
  })

  it('breaks the run on a collective win, which crowns nobody', async () => {
    mockPrisma.circleGameEvent.findMany.mockResolvedValue([
      { userId: null, payload: { collective: true }, game: { templateType: 'collective' } },
      { userId: 'u1', payload: { winner_id: 'u1' }, game: { templateType: 'relay' } },
    ])

    expect(await circleGameService.crownLineage(CIRCLE_ID)).toBeNull()
  })

  it('is silent for a room that has never finished a game', async () => {
    mockPrisma.circleGameEvent.findMany.mockResolvedValue([])
    expect(await circleGameService.crownLineage(CIRCLE_ID)).toBeNull()
  })
})

describe('roomRecord — the room against its own past, with nobody ranked', () => {
  const sprintMs = 14 * 86_400_000
  /** A kept day `sprintsAgo` sprints back (0 = the live sprint). */
  const keptAt = (sprintsAgo: number) => ({
    status: 'COMPLETED',
    armedAt: null,
    plannedDate: new Date(Date.now() - sprintsAgo * sprintMs - 86_400_000),
  })

  beforeEach(() => {
    mockPrisma.ivyCircleMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }])
  })

  it('reports the last finished sprint, the one before, and the best', async () => {
    mockPrisma.workout.findMany.mockResolvedValue([
      ...Array(3).fill(null).map(() => keptAt(0)),  // live sprint — excluded
      ...Array(9).fill(null).map(() => keptAt(1)),  // last finished
      ...Array(12).fill(null).map(() => keptAt(2)), // the best
    ])

    expect(await circleGameService.roomRecord(CIRCLE_ID)).toEqual({ last: 9, prior: 12, best: 12 })
  })

  it('counts an armed day that was never marked missed', async () => {
    mockPrisma.workout.findMany.mockResolvedValue([
      { status: 'PENDING', armedAt: new Date(), plannedDate: new Date(Date.now() - sprintMs - 86_400_000) },
      { status: 'MISSED', armedAt: new Date(), plannedDate: new Date(Date.now() - sprintMs - 86_400_000) },
    ])

    expect(await circleGameService.roomRecord(CIRCLE_ID)).toMatchObject({ last: 1 })
  })

  it('is silent until a sprint has actually finished', async () => {
    mockPrisma.workout.findMany.mockResolvedValue([keptAt(0), keptAt(0)])
    expect(await circleGameService.roomRecord(CIRCLE_ID)).toBeNull()
  })
})
