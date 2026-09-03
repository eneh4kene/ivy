/**
 * Pair-to-pair messaging — the first member-to-member channel in the product.
 *
 * Everything before this was Ivy <-> user, so these tests pin the decisions
 * that are expensive to retrofit: only your partner, named, rate-limited,
 * blockable, reportable, and delivered into the one thread that already exists.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    peerMessage: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    memberBlock: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    memberReport: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

const mockPostIvyMessage = jest.fn().mockResolvedValue({ id: 'msg-1' })
jest.mock('../services/chat.service', () => ({
  __esModule: true,
  default: { postIvyMessage: (...args: any[]) => mockPostIvyMessage(...args) },
}))

const mockGetActiveGame = jest.fn()
const mockRecentlyEnded = jest.fn()
jest.mock('../services/circle-game.service', () => ({
  __esModule: true,
  default: {
    getActiveGameForUser: (...args: any[]) => mockGetActiveGame(...args),
    recentlyEndedPairsGame: (...args: any[]) => mockRecentlyEnded(...args),
    pairOf: jest.requireActual('../services/circle-game.service').default.pairOf.bind(
      jest.requireActual('../services/circle-game.service').default,
    ),
  },
}))

const mockOpsAlert = jest.fn().mockResolvedValue(undefined)
jest.mock('../lib/ops-alert', () => ({ opsAlert: (...args: any[]) => mockOpsAlert(...args) }))

import prisma from '../utils/prisma'
import peerMessageService, { DAILY_SEND_LIMIT, MAX_CONTENT_LENGTH } from '../services/peer-message.service'

const mockPrisma = prisma as any
const [AMARA, SAM, RUTH] = ['u-amara', 'u-sam', 'u-ruth']

function pairsGameActive() {
  mockGetActiveGame.mockResolvedValue({
    game: {
      id: 'game-pairs-001',
      name: 'Two by Two',
      templateType: 'pairs',
      rules: { pairs: [[AMARA, SAM]], solo: [RUTH], target: 20 },
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  pairsGameActive()
  mockRecentlyEnded.mockResolvedValue(null)
  mockPrisma.memberBlock.findMany.mockResolvedValue([])
  mockPrisma.peerMessage.count.mockResolvedValue(0)
  mockPrisma.peerMessage.create.mockResolvedValue({ id: 'pm-1' })
  mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Sam' })
})

describe('who you may write to', () => {
  it('resolves your pair partner from the running game', async () => {
    const partner = await peerMessageService.getPartner(AMARA)
    expect(partner).toMatchObject({ partnerId: SAM, firstName: 'Sam', contactBlocked: false })
  })

  it('gives an unpaired member no channel at all', async () => {
    // The right to message is granted by a shared outcome. A solo member in an
    // odd room does not have one.
    expect(await peerMessageService.getPartner(RUTH)).toBeNull()
  })

  it('gives no channel when the running game is not a pairs game', async () => {
    mockGetActiveGame.mockResolvedValue({ game: { id: 'g', name: 'The Baton', templateType: 'relay', rules: {} } })
    expect(await peerMessageService.getPartner(AMARA)).toBeNull()
  })
})

describe('the window closes slowly', () => {
  it('keeps the channel open after the sprint, and says how long is left', async () => {
    // Cutting it the instant the game ends severs a fortnight-old
    // conversation on a sprint roll — and past notes stay readable, so it
    // left people able to read what someone said and unable to answer.
    mockGetActiveGame.mockResolvedValue({ game: { id: 'g', name: 'The Baton', templateType: 'relay', rules: {} } })
    mockRecentlyEnded.mockResolvedValue({
      game: { id: 'game-pairs-001', name: 'Two by Two', templateType: 'pairs', rules: { pairs: [[AMARA, SAM]], solo: [RUTH] } },
      daysLeft: 4,
    })

    const partner = await peerMessageService.getPartner(AMARA)
    expect(partner).toMatchObject({ partnerId: SAM, closingInDays: 4 })
  })

  it('still sends during the grace window', async () => {
    mockGetActiveGame.mockResolvedValue(null)
    mockRecentlyEnded.mockResolvedValue({
      game: { id: 'game-pairs-001', name: 'Two by Two', templateType: 'pairs', rules: { pairs: [[AMARA, SAM]], solo: [RUTH] } },
      daysLeft: 1,
    })

    expect((await peerMessageService.sendToPartner(AMARA, 'good sprint — see you in the next one')).ok).toBe(true)
  })

  it('a live pairing always wins, so nobody holds two channels', async () => {
    // A new sprint's partner REPLACES the last one rather than stacking.
    mockRecentlyEnded.mockResolvedValue({
      game: { id: 'old', name: 'Two by Two', templateType: 'pairs', rules: { pairs: [[AMARA, RUTH]] } },
      daysLeft: 3,
    })

    const partner = await peerMessageService.getPartner(AMARA)
    expect(partner).toMatchObject({ partnerId: SAM, closingInDays: null })
    expect(mockRecentlyEnded).not.toHaveBeenCalled()
  })

  it('closes for good once the window has passed', async () => {
    mockGetActiveGame.mockResolvedValue(null)
    mockRecentlyEnded.mockResolvedValue(null)

    expect(await peerMessageService.getPartner(AMARA)).toBeNull()
    expect(await peerMessageService.sendToPartner(AMARA, 'hello')).toEqual({ ok: false, reason: 'no_partner' })
  })
})

describe('sending', () => {
  it('delivers into the partner\'s Ivy thread, attributed by name', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Amara' })

    const res = await peerMessageService.sendToPartner(AMARA, 'saw you kept Tuesday — nice one')

    expect(res.ok).toBe(true)
    const [toUserId, body, opts] = mockPostIvyMessage.mock.calls[0]
    expect(toUserId).toBe(SAM)
    // Named in the text itself, so it reads correctly with no custom UI.
    expect(body).toContain('Amara sent you a note')
    expect(body).toContain('saw you kept Tuesday — nice one')
    expect(opts.messageType).toBe('peer_message')
    expect(opts.notify).toBe(true)
    expect(opts.metadata.peer.fromUserId).toBe(AMARA)

    // Stored for moderation, linked to the delivered message.
    expect(mockPrisma.peerMessage.create.mock.calls[0][0].data).toMatchObject({
      fromUserId: AMARA, toUserId: SAM, deliveredMessageId: 'msg-1',
    })
  })

  it('refuses when either side has blocked the other, and says so', async () => {
    // Silent failure is worse than refusal: the sender should know it did not land.
    mockPrisma.memberBlock.findMany.mockResolvedValue([{ blockerId: SAM }])

    expect(await peerMessageService.sendToPartner(AMARA, 'hello')).toEqual({ ok: false, reason: 'blocked' })
    expect(mockPostIvyMessage).not.toHaveBeenCalled()
  })

  it('caps the daily count so a channel cannot become a hounding', async () => {
    mockPrisma.peerMessage.count.mockResolvedValue(DAILY_SEND_LIMIT)

    expect(await peerMessageService.sendToPartner(AMARA, 'hello')).toEqual({ ok: false, reason: 'rate_limited' })
    expect(mockPostIvyMessage).not.toHaveBeenCalled()
  })

  it('refuses an empty note and an over-long one', async () => {
    expect(await peerMessageService.sendToPartner(AMARA, '   ')).toEqual({ ok: false, reason: 'empty' })
    expect(await peerMessageService.sendToPartner(AMARA, 'x'.repeat(MAX_CONTENT_LENGTH + 1)))
      .toEqual({ ok: false, reason: 'too_long' })
    expect(mockPostIvyMessage).not.toHaveBeenCalled()
  })

  it('refuses when there is no partner to write to', async () => {
    expect(await peerMessageService.sendToPartner(RUTH, 'hello')).toEqual({ ok: false, reason: 'no_partner' })
  })
})

describe('block and report', () => {
  it('blocking is idempotent', async () => {
    mockPrisma.memberBlock.upsert.mockResolvedValue({ id: 'b1' })

    await peerMessageService.blockMember(AMARA, SAM)
    await peerMessageService.blockMember(AMARA, SAM)

    expect(mockPrisma.memberBlock.upsert).toHaveBeenCalledTimes(2)
    expect(mockPrisma.memberBlock.upsert.mock.calls[0][0].update).toEqual({})
  })

  it('refuses to block yourself', async () => {
    await expect(peerMessageService.blockMember(AMARA, AMARA)).rejects.toThrow()
  })

  it('reporting persists, auto-blocks, and pages a human', async () => {
    mockPrisma.memberReport.create.mockResolvedValue({ id: 'r1', reason: 'abusive' })
    mockPrisma.memberBlock.upsert.mockResolvedValue({ id: 'b1' })

    await peerMessageService.reportMember(AMARA, SAM, 'abusive', 'pm-1')

    expect(mockPrisma.memberReport.create.mock.calls[0][0].data).toMatchObject({
      reporterId: AMARA, reportedId: SAM, peerMessageId: 'pm-1',
    })
    // Someone who has just reported a member should not need a second action
    // to stop hearing from them.
    expect(mockPrisma.memberBlock.upsert).toHaveBeenCalled()
    // And it interrupts a person rather than sitting in a dashboard.
    expect(mockOpsAlert.mock.calls[0][0]).toMatchObject({
      severity: 'critical', source: 'peer-message', title: 'member_reported',
    })
  })

  it('takes no automated action against the reported member', async () => {
    // Whether a message crossed a line is not a judgement this system should
    // make on its own, and a wrong automated suspension is far more damaging
    // than a delayed human one.
    mockPrisma.memberReport.create.mockResolvedValue({ id: 'r1', reason: 'abusive' })
    mockPrisma.memberBlock.upsert.mockResolvedValue({ id: 'b1' })

    await peerMessageService.reportMember(AMARA, SAM, 'abusive')

    // The only write against SAM is the report itself — no suspension, no tier
    // change, nothing on their user row.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.anything() }),
    )
    const blocked = mockPrisma.memberBlock.upsert.mock.calls[0][0].create
    expect(blocked).toEqual({ blockerId: AMARA, blockedId: SAM })
  })
})
