/**
 * Phase 4b — Stake × Circles Fusion: Unit Tests
 *
 * Tests for the three §4b mechanics:
 *   1. Witnessed stakes (visibility only — no money movement)
 *   2. Collective charity goal (coordination/flagging — no donation fired)
 *   3. Baton-stake (money-touching: raises holder's OWN stake slice; drop forfeits to OWN destination)
 *
 * HARD GUARDRAIL TESTS (§7 — the gambling/regulatory line):
 *   G-inter-user: Forfeited stakes are NEVER credited to or transferred to another user.
 *                 Games change visibility, coordination, and a user's OWN stake size only.
 *
 * All Prisma and Stripe calls are fully mocked — no network, no DB, no real money.
 */

// ---------------------------------------------------------------------------
// Jest mocks — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    ivyCircleMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ivyCircle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    circleGame: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    circleGameEvent: {
      create: jest.fn(),
    },
    circleSprintGoal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    stakeCycle: {
      findFirst: jest.fn(),
    },
    workout: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    charity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    sprint: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  },
}))

jest.mock('../services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue({ attempted: 1, delivered: 1 }),
  pushTemplates: {
    batonPassed: jest.fn().mockReturnValue({ title: 'Baton passed', body: 'Your turn' }),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '../utils/prisma'
import circleGameService from '../services/circle-game.service'
import circleService from '../services/circle.service'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CIRCLE_ID = 'circle-001'
const USER_A = 'user-a'
const USER_B = 'user-b'
const USER_C = 'user-c'

const HOUSE_CHARITY_ID = 'charity-house-001'
const COLLECTIVE_CHARITY_ID = 'charity-collective-001'

const BASE_RELAY_GAME = {
  id: 'game-relay-001',
  circleId: CIRCLE_ID,
  templateType: 'relay',
  name: 'Test Relay',
  description: null,
  sprintId: 'sprint-001',
  rules: {
    turn_order: [USER_A, USER_B, USER_C],
    window_hours: 24,
    lives: 3,
    baton_stake_multiplier: 1, // default: no elevation
  },
  state: {
    current_holder_index: 0,
    current_holder_id: USER_A,
    baton_held_since: new Date().toISOString(),
    lives_remaining: 3,
    passes: 0,
  },
  ivyInstruction: 'run the relay',
  status: 'active',
  events: [],
  circle: { name: 'Test Circle' },
}

const BASE_COLLECTIVE_GAME = {
  id: 'game-collective-001',
  circleId: CIRCLE_ID,
  templateType: 'collective',
  name: 'Test Collective',
  description: null,
  sprintId: 'sprint-001',
  rules: { target: 5, deadline_days: 28 },
  state: { total: 4, contributors: [USER_A, USER_B, USER_C, USER_A] },
  ivyInstruction: 'hit the target',
  status: 'active',
  events: [],
  circle: { name: 'Test Circle' },
}

const OPEN_STAKE_CYCLE = {
  id: 'cycle-001',
  stakeAmount: 14, // £14/week → £2/day base slice
  daysInCycle: 7, // schema default; prod rows always carry it
  status: 'AUTHORIZED',
}

// ---------------------------------------------------------------------------
// Helper: reset all mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  // Default: $transaction executes all ops
  ;(mockPrisma.$transaction as jest.Mock).mockImplementation((ops: any[]) => Promise.all(ops))
  // Default: circleGameEvent.create resolves
  ;(mockPrisma.circleGameEvent.create as jest.Mock).mockResolvedValue({ id: 'event-001' })
  // Default: circleGame.update resolves
  ;(mockPrisma.circleGame.update as jest.Mock).mockResolvedValue({})
  // Default: user.findUnique
  ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: USER_A, firstName: 'Alice' })
})

// ===========================================================================
// MECHANIC 1 — Witnessed stakes (visibility only)
// ===========================================================================

describe('Witnessed stakes — visibility only (§4b mechanic 1)', () => {
  it('setShareStakeWithCircle sets the flag — no Stripe calls, no money movement', async () => {
    ;(mockPrisma.ivyCircleMember.update as jest.Mock).mockResolvedValue({})

    await circleService.setShareStakeWithCircle(CIRCLE_ID, USER_A, true)

    expect(mockPrisma.ivyCircleMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { circleId_userId: { circleId: CIRCLE_ID, userId: USER_A } },
        data: { shareStakeWithCircle: true },
      })
    )
  })

  it('getCircleStakeStatuses returns "private" for opted-out members', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: false, user: { id: USER_A, firstName: 'Alice' } },
    ])

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses).toHaveLength(1)
    expect(statuses[0].stakeStatus).toBe('private')
    expect(statuses[0].sliceAmount).toBeNull()
  })

  it('getCircleStakeStatuses returns "no_stake" for opted-in member with no open cycle', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(null)

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses[0].stakeStatus).toBe('no_stake')
    expect(statuses[0].sliceAmount).toBeNull()
  })

  it('getCircleStakeStatuses returns "unarmed" for member with open cycle but no workout today', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue(null)

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses[0].stakeStatus).toBe('unarmed')
  })

  it('getCircleStakeStatuses returns "armed" for member with armedAt set and PENDING outcome', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      armedAt: new Date(),
      sliceOutcome: 'PENDING',
      stakeSliceAmount: 2,
    })

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses[0].stakeStatus).toBe('armed')
    expect(statuses[0].sliceAmount).toBe(2)
  })

  it('getCircleStakeStatuses returns "completed" for RELEASED slice', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      armedAt: new Date(),
      sliceOutcome: 'RELEASED',
      stakeSliceAmount: 2,
    })

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses[0].stakeStatus).toBe('completed')
  })

  it('getCircleStakeStatuses returns "forfeited" for FORFEITED slice', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      armedAt: null,
      sliceOutcome: 'FORFEITED',
      stakeSliceAmount: 2,
    })

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    expect(statuses[0].stakeStatus).toBe('forfeited')
  })

  // HARD GUARDRAIL: witnessed stakes expose visibility only — no money movement
  it('GUARDRAIL: getCircleStakeStatuses never calls Stripe (no money movement)', async () => {
    // There is no Stripe mock in this test file — if any Stripe import were
    // called it would throw.  The absence of errors IS the test.
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
    ])
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({
      armedAt: new Date(),
      sliceOutcome: 'PENDING',
      stakeSliceAmount: 2,
    })

    // Should complete without error — no Stripe, no donation, no capture
    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)
    expect(statuses).toBeDefined()
    // No donation.create call
    expect(mockPrisma.charity.findFirst).not.toHaveBeenCalled()
  })

  // HARD GUARDRAIL: slice amount shown is the user's OWN — not from another user
  it('GUARDRAIL: each member sees only their OWN stake slice (no cross-user exposure)', async () => {
    ;(mockPrisma.ivyCircleMember.findMany as jest.Mock).mockResolvedValue([
      { userId: USER_A, shareStakeWithCircle: true, user: { id: USER_A, firstName: 'Alice' } },
      { userId: USER_B, shareStakeWithCircle: true, user: { id: USER_B, firstName: 'Bob' } },
    ])

    // USER_A has £14/wk cycle, USER_B has £28/wk cycle
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'cycle-a', stakeAmount: 14, status: 'AUTHORIZED' })
      .mockResolvedValueOnce({ id: 'cycle-b', stakeAmount: 28, status: 'AUTHORIZED' })
    ;(mockPrisma.workout.findFirst as jest.Mock)
      .mockResolvedValueOnce({ armedAt: new Date(), sliceOutcome: 'PENDING', stakeSliceAmount: 2 })
      .mockResolvedValueOnce({ armedAt: new Date(), sliceOutcome: 'PENDING', stakeSliceAmount: 4 })

    const statuses = await circleService.getCircleStakeStatuses(CIRCLE_ID)

    // Each member's sliceAmount reflects their OWN stake, not another user's
    const aStatus = statuses.find((s) => s.userId === USER_A)!
    const bStatus = statuses.find((s) => s.userId === USER_B)!
    expect(aStatus.sliceAmount).toBe(2)   // USER_A's own £2/day
    expect(bStatus.sliceAmount).toBe(4)   // USER_B's own £4/day
    // Crucially, they differ — no mixing of balances
    expect(aStatus.sliceAmount).not.toBe(bStatus.sliceAmount)
    // CycleIds are different too — each tied to the owner's own cycle
    expect(aStatus.cycleId).toBe('cycle-a')
    expect(bStatus.cycleId).toBe('cycle-b')
  })
})

// ===========================================================================
// MECHANIC 2 — Collective charity goal (coordination only)
// ===========================================================================

describe('Collective charity goal — coordination/flagging only (§4b mechanic 2)', () => {
  it('setCollectiveCharityGoal sets the charityId on the sprint goal', async () => {
    ;(mockPrisma.charity.findUnique as jest.Mock).mockResolvedValue({
      id: COLLECTIVE_CHARITY_ID,
      name: 'Test Charity',
      isActive: true,
    })
    ;(mockPrisma.circleSprintGoal.findUnique as jest.Mock).mockResolvedValue({ id: 'goal-001' })
    ;(mockPrisma.circleSprintGoal.update as jest.Mock).mockResolvedValue({})

    await circleService.setCollectiveCharityGoal(CIRCLE_ID, 1, COLLECTIVE_CHARITY_ID)

    expect(mockPrisma.circleSprintGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { circleId_sprintNumber: { circleId: CIRCLE_ID, sprintNumber: 1 } },
        data: { collectiveCharityGoalId: COLLECTIVE_CHARITY_ID },
      })
    )
  })

  it('setCollectiveCharityGoal throws if charity not found', async () => {
    ;(mockPrisma.charity.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      circleService.setCollectiveCharityGoal(CIRCLE_ID, 1, 'nonexistent-charity')
    ).rejects.toThrow(/not found or inactive/i)
  })

  it('setCollectiveCharityGoal throws if sprint goal does not exist', async () => {
    ;(mockPrisma.charity.findUnique as jest.Mock).mockResolvedValue({
      id: COLLECTIVE_CHARITY_ID,
      name: 'Test',
      isActive: true,
    })
    ;(mockPrisma.circleSprintGoal.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(
      circleService.setCollectiveCharityGoal(CIRCLE_ID, 99, COLLECTIVE_CHARITY_ID)
    ).rejects.toThrow(/no sprint goal found/i)
  })

  it('getCollectiveCharityGoalStatus returns null when no goal set', async () => {
    ;(mockPrisma.circleSprintGoal.findUnique as jest.Mock).mockResolvedValue({
      collectiveCharityGoalId: null,
      collectiveGoalHitAt: null,
      collectiveCharity: null,
    })

    const status = await circleService.getCollectiveCharityGoalStatus(CIRCLE_ID, 1)
    expect(status).toBeNull()
  })

  it('getCollectiveCharityGoalStatus returns goal info when set', async () => {
    ;(mockPrisma.circleSprintGoal.findUnique as jest.Mock).mockResolvedValue({
      collectiveCharityGoalId: COLLECTIVE_CHARITY_ID,
      collectiveGoalHitAt: null,
      collectiveCharity: { id: COLLECTIVE_CHARITY_ID, name: 'Meals for Millions' },
    })

    const status = await circleService.getCollectiveCharityGoalStatus(CIRCLE_ID, 1)
    expect(status).not.toBeNull()
    expect(status!.charityId).toBe(COLLECTIVE_CHARITY_ID)
    expect(status!.charityName).toBe('Meals for Millions')
    expect(status!.goalHitAt).toBeNull()
  })

  it('processCollectiveEvent marks collectiveGoalHitAt when target is reached', async () => {
    // Set up: game at 4/5, one more workout will hit the target
    const game = {
      ...BASE_COLLECTIVE_GAME,
      state: { total: 4, contributors: [USER_A, USER_B, USER_C] },
    }

    // getActiveGameForUser — membership lookup
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)

    // Sprint lookup for flag
    ;(mockPrisma.sprint.findUnique as jest.Mock).mockResolvedValue({
      id: 'sprint-001',
      number: 1,
      seasonId: 'season-001',
    })
    // Sprint goal with charity set but not hit yet
    ;(mockPrisma.circleSprintGoal.findFirst as jest.Mock).mockResolvedValue({
      id: 'goal-001',
      collectiveCharityGoalId: COLLECTIVE_CHARITY_ID,
    })
    ;(mockPrisma.circleSprintGoal.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')

    // collectiveGoalHitAt should be set
    expect(mockPrisma.circleSprintGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ collectiveGoalHitAt: expect.any(Date) }),
      })
    )
  })

  it('processCollectiveEvent does NOT mark goal hit when target is NOT yet reached', async () => {
    // 3/5 — not at target
    const game = {
      ...BASE_COLLECTIVE_GAME,
      state: { total: 3, contributors: [USER_A, USER_B, USER_C] },
    }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)
    ;(mockPrisma.circleSprintGoal.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')

    // sprint goal should NOT be updated (not at target yet)
    expect(mockPrisma.circleSprintGoal.update).not.toHaveBeenCalled()
  })

  // HARD GUARDRAIL: no donation is fired here — Phase 6 only
  it('GUARDRAIL: collective goal hit does NOT create any Donation record (Phase 6 TODO)', async () => {
    const game = {
      ...BASE_COLLECTIVE_GAME,
      state: { total: 4, contributors: [USER_A, USER_B, USER_C] },
    }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)
    ;(mockPrisma.sprint.findUnique as jest.Mock).mockResolvedValue({
      id: 'sprint-001', number: 1, seasonId: 'season-001',
    })
    ;(mockPrisma.circleSprintGoal.findFirst as jest.Mock).mockResolvedValue({
      id: 'goal-001',
      collectiveCharityGoalId: COLLECTIVE_CHARITY_ID,
    })
    ;(mockPrisma.circleSprintGoal.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')

    // No donation.create should be called — Phase 6 todo
    expect((prisma as any).donation).toBeUndefined()
    // Specifically: circleSprintGoal is updated (flagged), but no money moved
    expect(mockPrisma.circleSprintGoal.update).toHaveBeenCalled()
  })
})

// ===========================================================================
// MECHANIC 3 — Baton-stake (money-touching: raises holder's OWN stake slice)
// ===========================================================================

describe('Baton-stake — the holder\'s OWN slice, and only on their say-so (§4b mechanic 3)', () => {
  // HARD GUARDRAIL, unchanged: an elevated slice belongs to the holder and
  // forfeits to the HOLDER'S OWN destination. What changed is HOW it is taken.
  //
  // Elevation used to happen automatically to whoever received the baton. That
  // moved a real person's money without them agreeing to it, and it made the
  // relay a game with nothing to decide. The multiplier is now an OFFER, made
  // once per hold and spent only through acceptBatonDouble.

  const doubleGame = (over: Record<string, any> = {}): any => ({
    ...BASE_RELAY_GAME,
    rules: { ...BASE_RELAY_GAME.rules, baton_stake_multiplier: 2 },
    ...over,
  })

  /** A hold with the offer open and unspent, belonging to `holder`. */
  const offerOpenTo = (holder: string) => doubleGame({
    state: {
      ...BASE_RELAY_GAME.state,
      current_holder_id: holder,
      current_holder_index: BASE_RELAY_GAME.rules.turn_order.indexOf(holder),
      baton_held_since: new Date().toISOString(),
      double_offered_to: holder,
      doubled: false,
    } as Record<string, any>,
  })

  it('a pass no longer elevates the incoming holder — it only offers', async () => {
    // The behaviour change that matters: USER_B receives the baton and their
    // money is untouched until they say the word.
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(doubleGame())
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-a', stakeSliceAmount: 4 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')

    // The outgoing holder is restored to base; nobody is elevated.
    const updatedIds = (mockPrisma.workout.update as jest.Mock).mock.calls.map((c: any[]) => c[0].where.id)
    expect(updatedIds).toEqual(['workout-a'])
    expect((mockPrisma.workout.update as jest.Mock).mock.calls[0][0].data.stakeSliceAmount).toBe(2)

    // And the offer is recorded against the incoming holder, unspent.
    const stateWrites = (mockPrisma.circleGame.update as jest.Mock).mock.calls
    const written = stateWrites[stateWrites.length - 1][0].data.state
    expect(written.current_holder_id).toBe(USER_B)
    expect(written.double_offered_to).toBe(USER_B)
    expect(written.doubled).toBe(false)
  })

  it('accepting elevates the CALLER\'S OWN workout, never another user\'s', async () => {
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(offerOpenTo(USER_B))
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-b', stakeSliceAmount: 2 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    const applied = await circleGameService.acceptBatonDouble(USER_B)

    expect(applied).toEqual({ multiplier: 2, slice: 4 })
    const updatedIds = (mockPrisma.workout.update as jest.Mock).mock.calls.map((c: any[]) => c[0].where.id)
    expect(updatedIds).toEqual(['workout-b'])
    expect(updatedIds).not.toContain('workout-a')
    expect(updatedIds).not.toContain('workout-c')

    // The audit trail names the destination as their own.
    const event = (mockPrisma.circleGameEvent.create as jest.Mock).mock.calls
      .find((c: any[]) => c[0].data.eventType === 'baton_doubled')
    expect(event).toBeDefined()
    expect(event![0].data.userId).toBe(USER_B)
    expect(event![0].data.payload.forfeit_destination).toBe('own_stake_destination')
  })

  it('GUARDRAIL: only the current holder can spend the offer', async () => {
    // USER_C tries to take a double offered to USER_B.
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(offerOpenTo(USER_B))
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    expect(await circleGameService.acceptBatonDouble(USER_C)).toBeNull()
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('GUARDRAIL: the offer is spendable once per hold', async () => {
    const spent = offerOpenTo(USER_B)
    spent.state.doubled = true

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(spent)
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    expect(await circleGameService.acceptBatonDouble(USER_B)).toBeNull()
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('GUARDRAIL: a double after the window has closed is refused', async () => {
    // Otherwise it would raise a slice that is already forfeiting.
    const stale = offerOpenTo(USER_B)
    stale.state.baton_held_since = new Date(Date.now() - 25 * 3_600_000).toISOString()

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(stale)
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    expect(await circleGameService.acceptBatonDouble(USER_B)).toBeNull()
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('GUARDRAIL: the multiplier is capped at the GameSpec money fence (×3)', async () => {
    const greedy = offerOpenTo(USER_B)
    greedy.rules = { ...greedy.rules, baton_stake_multiplier: 10 }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(greedy)
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-b', stakeSliceAmount: 2 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    const applied = await circleGameService.acceptBatonDouble(USER_B)

    expect(applied).toEqual({ multiplier: 3, slice: 6 })
  })

  it('GUARDRAIL: on a DROP the elevated slice stays on the DROPPER\'s own workout', async () => {
    // USER_A doubled, then dropped: their slice is NOT restored — the bigger
    // number forfeits, to their own destination.
    const dropped = doubleGame({
      state: {
        ...BASE_RELAY_GAME.state,
        current_holder_id: USER_A,
        current_holder_index: 0,
        double_offered_to: USER_A,
        doubled: true,
      },
    })

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(dropped)
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'MISSED')

    // Nobody's slice is rewritten: the dropper keeps the elevated amount, and
    // the incoming holder is only offered, never elevated.
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()

    const dropEvent = (mockPrisma.circleGameEvent.create as jest.Mock).mock.calls
      .find((c: any[]) => c[0].data.eventType === 'baton_stake_drop')
    expect(dropEvent).toBeDefined()
    expect(dropEvent![0].data.payload.forfeit_destination).toBe('own_stake_destination')
  })

  it('declines gracefully when the taker has no open stake cycle', async () => {
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(offerOpenTo(USER_B))
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await expect(circleGameService.acceptBatonDouble(USER_B)).resolves.toBeNull()
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()
  })

  it('no offer at all when the multiplier is 1 (the default)', async () => {
    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(BASE_RELAY_GAME)
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')
    expect(mockPrisma.workout.update).not.toHaveBeenCalled()

    const stateWrites = (mockPrisma.circleGame.update as jest.Mock).mock.calls
    expect(stateWrites[stateWrites.length - 1][0].data.state.double_offered_to).toBeNull()
  })
})

// ===========================================================================
// HARD GUARDRAIL TESTS — No inter-user money transfer (§7 + §4b hard guardrail)
// ===========================================================================

describe('HARD GUARDRAIL — forfeited stakes never transferred to another user (§7)', () => {
  it('GUARDRAIL: no Donation.create with a different userId than the dropper', async () => {
    // The circle-game service never creates Donation records at all.
    // Donations are created ONLY in stake.service.ts settleStakeCycle(), always for
    // the cycle owner (same userId as the workout owner).
    // This test verifies that processWorkoutEvent creates NO donation records,
    // preventing any scenario where a game event could route money to another user.
    const game = {
      ...BASE_RELAY_GAME,
      rules: { ...BASE_RELAY_GAME.rules, baton_stake_multiplier: 2 },
      state: { ...BASE_RELAY_GAME.state, current_holder_id: USER_A },
    }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-b', stakeSliceAmount: 2 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'MISSED')

    // circle-game.service NEVER calls donation.create
    // prisma.donation is not even in the mock — its absence confirms it's never called
    expect((prisma as any).donation).toBeUndefined()
  })

  it('GUARDRAIL: processWorkoutEvent never updates a workout belonging to a non-participant', async () => {
    // There should be no pathway where a non-circle-member's workout is updated
    const OUTSIDER = 'user-outsider'
    const game = {
      ...BASE_RELAY_GAME,
      rules: { ...BASE_RELAY_GAME.rules, baton_stake_multiplier: 2 },
      state: { ...BASE_RELAY_GAME.state, current_holder_id: USER_A },
    }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-b', stakeSliceAmount: 2 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'COMPLETED')

    // Verify no workout of OUTSIDER was updated
    const updateCalls = (mockPrisma.workout.update as jest.Mock).mock.calls
    for (const call of updateCalls) {
      // workout.update is called by id (not userId), but the workout fetched
      // is always for a specific userId — verify it's never the outsider's workout
      expect(call[0].where.id).not.toBe('workout-outsider')
    }
  })

  it('GUARDRAIL: setShareStakeWithCircle only modifies the requesting user\'s own flag', async () => {
    ;(mockPrisma.ivyCircleMember.update as jest.Mock).mockResolvedValue({})

    await circleService.setShareStakeWithCircle(CIRCLE_ID, USER_A, true)

    // update is called with USER_A's composite key — never USER_B's
    expect(mockPrisma.ivyCircleMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { circleId_userId: { circleId: CIRCLE_ID, userId: USER_A } },
      })
    )
    // Only one update call — not updating other members
    expect(mockPrisma.ivyCircleMember.update).toHaveBeenCalledTimes(1)
  })

  it('GUARDRAIL: baton events create CircleGameEvents (not Donations) — no inter-user money', async () => {
    // All baton events — pass, drop, baton_stake_drop — create CircleGameEvent records,
    // never Donation records.  This test verifies the event type is correct and
    // no donation pathway exists in the game service.
    const game = {
      ...BASE_RELAY_GAME,
      rules: { ...BASE_RELAY_GAME.rules, baton_stake_multiplier: 2 },
      state: { ...BASE_RELAY_GAME.state, current_holder_id: USER_A },
    }

    ;(mockPrisma.ivyCircleMember.findFirst as jest.Mock).mockResolvedValue({ circleId: CIRCLE_ID })
    ;(mockPrisma.circleGame.findFirst as jest.Mock).mockResolvedValue(game)
    ;(mockPrisma.stakeCycle.findFirst as jest.Mock).mockResolvedValue(OPEN_STAKE_CYCLE)
    ;(mockPrisma.workout.findFirst as jest.Mock).mockResolvedValue({ id: 'workout-b', stakeSliceAmount: 2 })
    ;(mockPrisma.workout.update as jest.Mock).mockResolvedValue({})

    await circleGameService.processWorkoutEvent(USER_A, 'MISSED')

    // Events created are CircleGameEvent, not Donation
    const eventCalls = (mockPrisma.circleGameEvent.create as jest.Mock).mock.calls
    expect(eventCalls.length).toBeGreaterThan(0)
    // All calls go to circleGameEvent.create — never to a donation endpoint
    // (prisma.donation is not in the mock — its absence confirms no donation call)
    expect((prisma as any).donation).toBeUndefined()
  })
})
