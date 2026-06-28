/**
 * Circle auto-assignment — Unit Tests
 *
 * Covers circleService.autoAssignToCircle(), the Day-Zero placement that puts
 * every new (non-coach) user into a peer accountability circle:
 *   1. Coaches are skipped (no circle).
 *   2. Idempotent — an already-placed user is not double-assigned.
 *   3. Existing open circles are filled fullest-first.
 *   4. When nothing has room, a fresh circle is seeded with the user as facilitator.
 *
 * All Prisma calls are fully mocked — no network, no DB.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    ivyCircle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    ivyCircleMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import circleService from '../services/circle.service'
import prisma from '../utils/prisma'

const db = prisma as unknown as {
  user: { findUnique: jest.Mock }
  ivyCircle: {
    findUnique: jest.Mock
    findMany: jest.Mock
    create: jest.Mock
    update: jest.Mock
    count: jest.Mock
  }
  ivyCircleMember: {
    findFirst: jest.Mock
    count: jest.Mock
    upsert: jest.Mock
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Sensible defaults for the addMember path (overridden per test where needed).
  db.ivyCircle.update.mockResolvedValue({})
  db.ivyCircleMember.upsert.mockImplementation(async ({ create }: any) => ({ id: 'mem_1', ...create }))
  db.ivyCircleMember.count.mockResolvedValue(0)
})

describe('autoAssignToCircle', () => {
  it('skips coaches — no circle assigned', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', track: 'fitness', companyId: null, subscriptionTier: 'COACH' })

    const res = await circleService.autoAssignToCircle('u1')

    expect(res).toBeNull()
    expect(db.ivyCircle.findMany).not.toHaveBeenCalled()
    expect(db.ivyCircle.create).not.toHaveBeenCalled()
  })

  it('is idempotent — returns the existing circle without creating a new one', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', track: 'fitness', companyId: null, subscriptionTier: 'PRO' })
    db.ivyCircleMember.findFirst.mockResolvedValue({ circleId: 'c_existing' })

    const res = await circleService.autoAssignToCircle('u1')

    expect(res).toEqual({ circleId: 'c_existing', created: false })
    expect(db.ivyCircle.findMany).not.toHaveBeenCalled()
    expect(db.ivyCircle.create).not.toHaveBeenCalled()
  })

  it('joins the fullest-but-not-full open circle (fullest-first)', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', track: 'fitness', companyId: null, subscriptionTier: 'PRO' })
    db.ivyCircleMember.findFirst.mockResolvedValue(null)
    db.ivyCircle.findMany.mockResolvedValue([
      { id: 'c_empty', maxSize: 8, _count: { members: 2 } },
      { id: 'c_full', maxSize: 8, _count: { members: 8 } },   // no room → excluded
      { id: 'c_almost', maxSize: 8, _count: { members: 7 } }, // fullest with room → chosen
    ])
    // addMember internals for the chosen circle
    db.ivyCircle.findUnique.mockResolvedValue({ id: 'c_almost', isActive: true, maxSize: 8 })
    db.ivyCircleMember.count.mockResolvedValue(7)

    const res = await circleService.autoAssignToCircle('u1')

    expect(res).toEqual({ circleId: 'c_almost', created: false })
    expect(db.ivyCircleMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ circleId: 'c_almost', userId: 'u1', role: 'member' }) }),
    )
    expect(db.ivyCircle.create).not.toHaveBeenCalled()
  })

  it('seeds a new circle as facilitator when nothing has room', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', track: 'focus', companyId: null, subscriptionTier: 'PRO' })
    db.ivyCircleMember.findFirst.mockResolvedValue(null)
    db.ivyCircle.findMany.mockResolvedValue([
      { id: 'c_full', maxSize: 8, _count: { members: 8 } }, // full → no candidates
    ])
    db.ivyCircle.count.mockResolvedValue(0) // scope count → first name in the pool
    db.ivyCircle.create.mockResolvedValue({ id: 'c_new', name: 'Dawn Runners', track: 'focus' })
    db.ivyCircle.findUnique.mockResolvedValue({ id: 'c_new', isActive: true, maxSize: 8 })
    db.ivyCircleMember.count.mockResolvedValue(0)

    const res = await circleService.autoAssignToCircle('u1')

    expect(res).toEqual({ circleId: 'c_new', created: true })
    expect(db.ivyCircle.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ track: 'focus', tier: 'peer', name: 'Dawn Runners' }) }),
    )
    expect(db.ivyCircleMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ circleId: 'c_new', userId: 'u1', role: 'facilitator' }) }),
    )
  })
})
