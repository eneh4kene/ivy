/**
 * Call shapes and the variety governor.
 *
 * The flows vary CONTENT richly and structure not at all: evening_completed is
 * always confirm → detail → tomorrow, night 4 and night 400 alike. A shape is
 * layered on the flow to vary the kind of conversation, not what it covers.
 *
 * The governor's order is the design: ELIGIBILITY first, variety second.
 * Randomising freely reads as inconsistency rather than personality — worse
 * than sameness, which at least reads as reliable.
 *
 * And game state is NOT a shape. It is material every shape can use, and the
 * only material she has that is not a mirror of the person's own behaviour —
 * which is why it GATES she_leads and CONSTRAINS the shapes that assume there
 * is nothing to get to.
 */

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: { call: { findMany: jest.fn() } },
}))

import prisma from '../utils/prisma'
import callService from '../services/call.service'
import { SHAPES, promptService } from '../services/prompt.service'

const mockPrisma = prisma as any
const USER = 'u-1'

const pick = (ctx: Record<string, any>, callType = 'EVENING_REVIEW') =>
  (callService as any).pickCallShape(USER, callType, ctx) as Promise<string | null>

/** Run the picker many times to see the whole eligible set, not one sample. */
async function possibleShapes(ctx: Record<string, any>, runs = 250): Promise<Set<string>> {
  const seen = new Set<string>()
  for (let i = 0; i < runs; i++) {
    const s = await pick(ctx)
    if (s) seen.add(s)
  }
  return seen
}

const keptDay = { workout_status: 'COMPLETED', current_streak: 5 }

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.call.findMany.mockResolvedValue([]) // no history
})

describe('game state is material, not a shape', () => {
  it('never returns a game state as a shape', async () => {
    const shapes = await possibleShapes({ ...keptDay, circle_game_recent_beats: 'Amara passed the baton.' })
    for (const s of shapes) expect(Object.keys(SHAPES)).toContain(s)
  })

  it('gates she_leads on having something external to lead with', async () => {
    // Leading with nothing but their own record collapses into "let me tell you
    // about yourself", which is worse than asking.
    const without = await possibleShapes(keptDay)
    expect(without.has('she_leads')).toBe(false)

    const withBeats = await possibleShapes({ ...keptDay, circle_game_recent_beats: 'Amara took the lead.' })
    expect(withBeats.has('she_leads')).toBe(true)

    const withTheory = await possibleShapes({ ...keptDay, ivy_theory: "He doesn't decide Wednesday until Wednesday" })
    expect(withTheory.has('she_leads')).toBe(true)
  })

  it('rules out the no-agenda shapes when something is LIVE', async () => {
    // An agenda and "no agenda" cannot both be true, and a 15-second settle is
    // a lie when the baton is in their hands.
    const shapes = await possibleShapes({
      ...keptDay,
      circle_game_live_obligation: 'They are holding the baton — 3 hours left.',
      circle_game_recent_beats: 'Amara passed it to them.',
    })
    expect(shapes.has('settle_fast')).toBe(false)
    expect(shapes.has('open_floor')).toBe(false)
  })
})

describe('eligibility comes before variety', () => {
  it('never offers settle_fast on a missed day', async () => {
    const shapes = await possibleShapes({ workout_status: 'MISSED', current_streak: 0 })
    expect(shapes.has('settle_fast')).toBe(false)
  })

  it('never pushes at someone who is already struggling', async () => {
    // The pause protocol and high_risk_signals exist precisely to stop this.
    for (const fragile of [
      { high_risk_signals: 'goes quiet before a miss' },
      { season_type: 'memorial' },
      { struggle_signal: true },
    ]) {
      const shapes = await possibleShapes({
        workout_status: 'MISSED', current_streak: 0, recurring_blocker: 'evenings', ...fragile,
      })
      expect(shapes.has('push')).toBe(false)
    }
  })

  it('only marks when there is genuinely something to mark', async () => {
    expect((await possibleShapes({ ...keptDay, current_streak: 5 })).has('mark')).toBe(false)
    expect((await possibleShapes({ ...keptDay, current_streak: 30 })).has('mark')).toBe(true)
  })

  it('leaves set-piece calls unshaped', async () => {
    // Onboarding and season close have deliberate scripts; shaping them would
    // fight structure that was chosen on purpose.
    for (const t of ['ONBOARDING', 'SEASON_CLOSE', 'COACH_PONDER', 'RESCUE']) {
      expect(await pick(keptDay, t)).toBeNull()
    }
  })

  it('always has a floor to fall back to', async () => {
    // Every branch excluded — it must still return something usable.
    const shapes = await possibleShapes({ workout_status: 'MISSED', high_risk_signals: 'x', current_streak: 0 })
    expect(shapes.size).toBeGreaterThan(0)
  })
})

describe('the governor remembers', () => {
  it('never repeats the immediately previous shape', async () => {
    mockPrisma.call.findMany.mockResolvedValue([{ shape: 'settle_standard' }])
    const shapes = await possibleShapes({ ...keptDay, ivy_theory: 'a theory' })
    expect(shapes.has('settle_standard')).toBe(false)
  })

  it('holds the rare shapes back after a recent rare one', async () => {
    // A rare thing that fires on schedule is just a feature with a long
    // interval — the unpredictability IS the mechanism.
    mockPrisma.call.findMany.mockResolvedValue([{ shape: 'open_floor' }, { shape: 'settle_standard' }])
    const shapes = await possibleShapes({ ...keptDay, current_streak: 30 })
    expect(shapes.has('open_floor')).toBe(false)
    expect(shapes.has('push')).toBe(false)
    expect(shapes.has('mark')).toBe(false)
  })

  it('survives a DB failure by shaping nothing rather than throwing', async () => {
    mockPrisma.call.findMany.mockRejectedValue(new Error('db down'))
    await expect(pick(keptDay)).resolves.toBeTruthy()
  })
})

describe('the shape reaches the prompt without outranking hello', () => {
  it('renders the chosen shape', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', { first_name: 'Sam', call_shape: 'dig' }, false)
    expect(prompt).toContain('SHAPE — DIG')
    expect(prompt).toContain('You may SKIP the rest of the flow')
  })

  it('still loses to the opening rule', () => {
    // Nothing outranks "say hello and ask ONE thing" on a call.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', { first_name: 'Sam', call_shape: 'she_leads' }, false)
    const shapeAt = prompt.indexOf('SHAPE — YOU LEAD')
    const helloAt = prompt.indexOf('Say hello and ask ONE thing')
    expect(shapeAt).toBeGreaterThan(-1)
    expect(helloAt).toBeGreaterThan(shapeAt) // the opening rule lands last, where the prompt weights hardest
  })

  it('ignores an unknown shape rather than emitting a blank section', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', { first_name: 'Sam', call_shape: 'nonsense' }, false)
    expect(prompt).not.toContain('SHAPE —')
  })

  it('never shapes a chat or a coach call', () => {
    expect(promptService.buildSystemPrompt('CHAT', { call_shape: 'dig' }, false)).not.toContain('SHAPE —')
    expect(promptService.buildSystemPrompt('COACH_PONDER', { call_shape: 'dig', subscription_tier: 'COACH' }, false))
      .not.toContain('SHAPE —')
  })
})
