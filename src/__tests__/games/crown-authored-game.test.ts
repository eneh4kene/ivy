/**
 * The crown's second spoil: the winner writes the room's next game.
 *
 * The GameSpec compiler has been built, fenced and tested since June and had
 * never been reachable from anywhere in the product. These tests cover the
 * ignition — the right, what spends it, and what must NOT spend it.
 */

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    circleGame: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    circleGameEvent: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    ivyCircleMember: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    workout: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
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

const mockCompileGame = jest.fn()
jest.mock('../../services/games/compiler', () => {
  const actual = jest.requireActual('../../services/games/compiler')
  return { ...actual, compileGame: (...args: any[]) => mockCompileGame(...args) }
})

const mockPersistSpecGame = jest.fn()
jest.mock('../../services/games/runtime', () => ({
  ...jest.requireActual('../../services/games/runtime'),
  createSpecGame: (...args: any[]) => mockPersistSpecGame(...args),
}))

import prisma from '../../utils/prisma'
import circleGameService from '../../services/circle-game.service'
import { SpecValidationError } from '../../services/games/compiler'

const mockPrisma = prisma as any
const CIRCLE_ID = 'circle-001'
const WINNER = 'user-winner'
const WON_GAME_ID = 'game-won-001'

/** A win by `winner` inside the 14-day crown window, with `state` on the won game. */
function crownWin(state: Record<string, unknown> = {}) {
  mockPrisma.ivyCircleMember.findFirst.mockResolvedValue({ circleId: CIRCLE_ID })
  mockPrisma.circleGameEvent.findMany.mockResolvedValue([
    {
      userId: WINNER,
      createdAt: new Date(Date.now() - 2 * 86_400_000),
      payload: { winner_id: WINNER },
      game: { id: WON_GAME_ID, name: 'The Baton', state },
    },
  ])
  mockPrisma.circleGame.findUnique.mockResolvedValue({ state })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.ivyCircleMember.findMany.mockResolvedValue([
    { userId: WINNER, user: { firstName: 'Amara' } },
    { userId: 'user-b', user: { firstName: 'Sam' } },
  ])
  mockPrisma.circleGame.findFirst.mockResolvedValue({ id: 'game-running', name: 'The Baton' })
  mockPrisma.circleGame.update.mockResolvedValue({})
  mockCompileGame.mockResolvedValue({
    spec: { name: 'Tuesday Tax' },
    attempts: 1,
  })
  mockPersistSpecGame.mockResolvedValue({
    id: 'game-new-001',
    name: 'Tuesday Tax',
    description: 'Miss a Tuesday, pick someone else’s charity.',
  })
})

describe('getCrownRights — the two spoils are independent', () => {
  it('offers both when neither has been spent', async () => {
    crownWin({})
    expect(await circleGameService.getCrownRights(WINNER)).toEqual({
      canClaimPledge: true,
      canAuthorGame: true,
    })
  })

  it('still offers the game after the pledge has been named', async () => {
    // Spending one spoil must not silently retire the other.
    crownWin({ pledge_claimed: true })
    expect(await circleGameService.getCrownRights(WINNER)).toEqual({
      canClaimPledge: false,
      canAuthorGame: true,
    })
  })

  it('still offers the pledge after the game has been written', async () => {
    crownWin({ game_authored: true })
    expect(await circleGameService.getCrownRights(WINNER)).toEqual({
      canClaimPledge: true,
      canAuthorGame: false,
    })
  })

  it('goes quiet once both are spent', async () => {
    crownWin({ pledge_claimed: true, game_authored: true })
    expect(await circleGameService.getCrownRights(WINNER)).toBeNull()
  })

  it('offers nothing to someone who did not win', async () => {
    crownWin({})
    expect(await circleGameService.getCrownRights('user-b')).toBeNull()
  })
})

describe('authorCrownGame', () => {
  it('compiles the game, starts it, and retires the running one', async () => {
    crownWin({})

    const built = await circleGameService.authorCrownGame(WINNER, 'whoever misses a Tuesday picks someone else’s charity')

    expect(mockCompileGame).toHaveBeenCalledWith('whoever misses a Tuesday picks someone else’s charity')
    expect(built).toMatchObject({ name: 'Tuesday Tax', replaced: 'The Baton' })

    // The outgoing game is completed — one active game per circle.
    const updates = mockPrisma.circleGame.update.mock.calls.map((c: any[]) => c[0])
    expect(updates.some((u: any) => u.where.id === 'game-running' && u.data.status === 'completed')).toBe(true)
    // And the right is spent on the WON game, not the new one.
    expect(updates.some((u: any) => u.where.id === WON_GAME_ID && u.data.state.game_authored === true)).toBe(true)
  })

  it('spends the game right without clobbering a pledge already claimed', async () => {
    crownWin({ pledge_claimed: true })

    await circleGameService.authorCrownGame(WINNER, 'a game about Tuesdays')

    const spend = mockPrisma.circleGame.update.mock.calls
      .map((c: any[]) => c[0])
      .find((u: any) => u.where.id === WON_GAME_ID)
    expect(spend.data.state).toEqual({ pledge_claimed: true, game_authored: true })
  })

  it('refuses someone without the right, before spending a compile call', async () => {
    crownWin({ game_authored: true })

    expect(await circleGameService.authorCrownGame(WINNER, 'a game about Tuesdays')).toBeNull()
    expect(mockCompileGame).not.toHaveBeenCalled()
  })

  it('leaves the right UNSPENT when the game cannot be compiled', async () => {
    // A failed compile is a conversation ("describe it another way"), not a
    // forfeited prize.
    crownWin({})
    mockCompileGame.mockRejectedValue(new SpecValidationError('nope', ['needs a referee']))

    await expect(
      circleGameService.authorCrownGame(WINNER, 'whoever tries hardest wins'),
    ).rejects.toBeInstanceOf(SpecValidationError)

    expect(mockPersistSpecGame).not.toHaveBeenCalled()
    expect(mockPrisma.circleGame.update).not.toHaveBeenCalled()
  })

  it('starts the game cleanly when the room has none running', async () => {
    crownWin({})
    mockPrisma.circleGame.findFirst.mockResolvedValue(null)

    const built = await circleGameService.authorCrownGame(WINNER, 'a game about Tuesdays')

    expect(built).toMatchObject({ replaced: null })
    const updates = mockPrisma.circleGame.update.mock.calls.map((c: any[]) => c[0])
    expect(updates.every((u: any) => u.where.id !== 'game-running')).toBe(true)
  })
})
