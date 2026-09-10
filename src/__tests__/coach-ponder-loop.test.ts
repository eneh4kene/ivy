/**
 * Closing the coach ↔ Ivy loop.
 *
 * On their very first call Ivy promises coaches: "they adjust programmes out
 * loud — they say it, you apply it". The applier existed and ran after every
 * ponder call, but it only understood programme AREAS. A coach saying "give her
 * 10k steps on the days she can't train" or "I see Sam Tuesdays and Thursdays"
 * was heard, agreed with, and silently dropped — which made that promise only
 * two-thirds true, in a way nobody could see.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: { user: { findMany: jest.fn(), update: jest.fn() } },
}))

jest.mock('../lib/ops-alert', () => ({ opsAlert: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../lib/analytics', () => ({
  serverAnalytics: { programmeUpdated: jest.fn(), ponderCompleted: jest.fn() },
}))
jest.mock('../inngest/client', () => ({ inngest: { send: jest.fn().mockResolvedValue(undefined) } }))

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class { messages = { create: (...a: any[]) => mockCreate(...a) } },
}))

import prisma from '../utils/prisma'
import coachService from '../services/coach.service'

const mockPrisma = prisma as any
const COACH = 'coach-1'
const SAM = 'client-sam'

/** The extractor's reply, as the model would return it. */
const modelReturns = (updates: unknown) =>
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(updates) }] })

const writesFor = (id: string) =>
  mockPrisma.user.update.mock.calls.map((c: any[]) => c[0]).filter((u: any) => u.where.id === id)

beforeEach(() => {
  jest.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  mockPrisma.user.findMany.mockResolvedValue([
    { id: SAM, firstName: 'Sam', lastName: 'Okafor', programmeAreas: [] },
  ])
  mockPrisma.user.update.mockResolvedValue({})
})

describe('a floor stated out loud gets applied', () => {
  it('writes coachMinimum and reports it as a floor', async () => {
    modelReturns([{ clientId: SAM, kind: 'floor', instruction: '10k steps' }])

    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'Joe said give Sam 10k steps on days he cannot train.')

    // Stamped, because a floor set once and never revisited quietly stops
    // describing the person — the timestamp is what lets Ivy ask later.
    expect(writesFor(SAM)[0].data).toMatchObject({ coachMinimum: '10k steps' })
    expect(writesFor(SAM)[0].data.coachMinimumSetAt).toBeInstanceOf(Date)
    expect(applied).toEqual([
      expect.objectContaining({ clientId: SAM, kind: 'floor', instruction: '10k steps' }),
    ])
  })

  it('clears it on REMOVE', async () => {
    modelReturns([{ clientId: SAM, kind: 'floor', instruction: 'REMOVE' }])
    await coachService.extractAndApplyProgrammeUpdates(COACH, 'drop the floor for Sam')
    expect(writesFor(SAM)[0].data).toEqual({ coachMinimum: null, coachMinimumSetAt: null })
  })
})

describe('session days stated out loud get applied', () => {
  it('normalises and stores them', async () => {
    modelReturns([{ clientId: SAM, kind: 'sessions', instruction: 'Tuesday, THURSDAY' }])

    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'I see Sam Tuesdays and Thursdays')

    expect(writesFor(SAM)[0].data).toEqual({ coachSessionDays: JSON.stringify(['tuesday', 'thursday']) })
    expect(applied[0]).toMatchObject({ kind: 'sessions', instruction: 'tuesday, thursday' })
  })

  it('discards junk days rather than having Ivy anticipate a session that is not coming', async () => {
    modelReturns([{ clientId: SAM, kind: 'sessions', instruction: 'someday, whenever' }])
    await coachService.extractAndApplyProgrammeUpdates(COACH, 'vague')
    expect(writesFor(SAM)[0].data).toEqual({ coachSessionDays: null })
  })
})

describe('programme areas still work exactly as before', () => {
  it('applies an area update', async () => {
    modelReturns([{ clientId: SAM, kind: 'area', area: 'Lower body', instruction: '3x a week' }])

    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'put Sam on 3x lower body')

    expect(writesFor(SAM)[0].data.programmeAreas[0]).toMatchObject({ area: 'Lower body', instruction: '3x a week', updatedBy: 'ivy' })
    expect(applied[0]).toMatchObject({ kind: 'area' })
  })

  it('treats an update with no kind as an area — the old shape still parses', async () => {
    // Anything already in flight when this shipped must not silently no-op.
    modelReturns([{ clientId: SAM, area: 'Cardio', instruction: 'twice weekly' }])

    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'cardio twice weekly')

    expect(applied[0]).toMatchObject({ kind: 'area', area: 'Cardio' })
  })

  it('skips an area update with no area rather than writing a nameless one', async () => {
    modelReturns([{ clientId: SAM, kind: 'area', instruction: 'something' }])
    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'vague')
    expect(applied).toEqual([])
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})

describe('all three in one call', () => {
  it('applies each to its own field', async () => {
    modelReturns([
      { clientId: SAM, kind: 'area', area: 'Upper body', instruction: '2x' },
      { clientId: SAM, kind: 'floor', instruction: '10k steps' },
      { clientId: SAM, kind: 'sessions', instruction: 'thursday' },
    ])

    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'a productive ponder')

    expect(applied.map((a) => a.kind)).toEqual(['area', 'floor', 'sessions'])
    const writes = writesFor(SAM).map((w: any) => Object.keys(w.data)[0])
    expect(writes).toEqual(['programmeAreas', 'coachMinimum', 'coachSessionDays'])
  })

  it('ignores changes aimed at another coach\u2019s client', async () => {
    modelReturns([{ clientId: 'not-their-client', kind: 'floor', instruction: '10k steps' }])
    const applied = await coachService.extractAndApplyProgrammeUpdates(COACH, 'x')
    expect(applied).toEqual([])
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
