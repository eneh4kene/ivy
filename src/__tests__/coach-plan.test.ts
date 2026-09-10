/**
 * The two things only a coach can properly answer about a client: the floor on
 * a bad day, and when the two of them actually meet.
 *
 * minimumMode already existed but only the MEMBER could set it — and a floor
 * you set for yourself is negotiable with yourself at 9pm, which is exactly
 * when it needs not to be. Session days were not modelled at all, so Ivy had
 * no idea her daily loop ran alongside a weekly one.
 */

import { promptService } from '../services/prompt.service'

const client = { first_name: 'Sam', coach_name: 'Joe' }

describe('the floor', () => {
  it("is offered LAST, never as an opening bid", () => {
    // The whole risk: a minimum that becomes a ceiling. An Ivy who offers
    // "10k steps?" readily is not holding a floor, she is negotiating someone
    // down from a day they could still have kept in full.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...client, coach_minimum: '10k steps',
    }, false)
    expect(prompt).toContain('THE FLOOR')
    expect(prompt).toContain('10k steps')
    expect(prompt).toContain('OFFER IT LAST, NEVER FIRST')
    expect(prompt).toContain('negotiating them down')
  })

  it('says whose line it is when the coach set it', () => {
    // It carries more weight as the coach's line than as hers, and it is not
    // hers to soften or raise.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...client, coach_minimum: '10k steps',
    }, false)
    expect(prompt).toContain('set by Joe, not by them')
    expect(prompt).toContain('not yours to soften or raise')
  })

  it('frames a self-set floor as their own promise instead', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...client, minimum_action: 'twenty minutes of something',
    }, false)
    expect(prompt).toContain('they set this themselves')
    expect(prompt).toContain('a promise from them to them')
  })

  it("prefers the coach's floor over the member's own", () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...client, coach_minimum: '10k steps', minimum_action: 'five minutes',
    }, false)
    expect(prompt).toContain('10k steps')
    expect(prompt).not.toContain('five minutes')
  })

  it('never frames taking the floor as settling', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', { ...client, coach_minimum: '10k steps' }, false)
    expect(prompt).toContain('KEPT day, not a lesser one')
  })

  it('says nothing when there is no floor at all', () => {
    expect(promptService.buildSystemPrompt('EVENING_REVIEW', client, false)).not.toContain('THE FLOOR')
  })
})

describe('coach session days', () => {
  const withDays = { ...client, coach_session_days: JSON.stringify(['tuesday', 'thursday']) }

  it('builds toward the session and picks it up afterwards', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', withDays, false)
    expect(prompt).toContain('THEY SEE JOE ON: Tuesday, Thursday')
    expect(prompt).toContain('what do you want to be able to tell him?')
    expect(prompt).toContain('Did he change anything?')
  })

  it('is a PATTERN, never an appointment', () => {
    // Nothing here models cancellations, so asserting a specific session is the
    // same class of broken promise as telling someone their calls follow them
    // and then not moving them.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', withDays, false)
    expect(prompt).toContain('as a rule — you do not know about any individual week')
    expect(prompt).toContain('NEVER assert a session happened')
  })

  it('stays quiet when the value is malformed rather than guessing', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', { ...client, coach_session_days: '{not json' }, false)
    expect(prompt).not.toContain('THEY SEE')
  })

  it('needs a coach name to say anything', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      first_name: 'Sam', coach_session_days: JSON.stringify(['tuesday']),
    }, false)
    expect(prompt).not.toContain('THEY SEE')
  })
})

describe('coaches get none of it', () => {
  it('omits the whole block on a coach call', () => {
    const prompt = promptService.buildSystemPrompt('COACH_PONDER', {
      ...client, subscription_tier: 'COACH',
      coach_minimum: '10k steps', coach_session_days: JSON.stringify(['tuesday']),
    }, false)
    expect(prompt).not.toContain('THE FLOOR')
    expect(prompt).not.toContain('THEY SEE')
  })
})
