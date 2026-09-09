/**
 * Interiority — the one thing in the prompt that is HERS.
 *
 * Everything else Ivy is handed is a fact about the user. A standing theory is
 * a view she formed, which she is allowed to be wrong about, and which she
 * returns to. That lifecycle is the feature: a note she cannot revisit or drop
 * is just another memory.
 *
 * A relationship where one side has no inner life flattens however good their
 * recall is, which is why a well-informed call can still feel like a form.
 */

import { promptService } from '../services/prompt.service'

const base: Record<string, any> = { first_name: 'Sam', current_streak: 4 }

describe('a standing theory', () => {
  const ctx = {
    ...base,
    ivy_theory: "He doesn't decide Wednesday until Wednesday (formed from: three missed Wednesdays, all unplanned)",
    ivy_theory_age_days: 5,
  }

  it('is surfaced as hers, with its age', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', ctx, false)
    expect(prompt).toContain('WHAT YOU THINK')
    expect(prompt).toContain("doesn't decide Wednesday until Wednesday")
    expect(prompt).toContain('formed 5 days ago')
    expect(prompt).toContain('This is YOURS')
  })

  it('is NOT to be raised every call', () => {
    // A theory aired nightly is an interrogation, and one raised on a schedule
    // reads as a feature rather than a thought.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', ctx, false)
    expect(prompt).toContain('Do NOT bring it up every call')
    expect(prompt).toContain('real opening')
  })

  it('licenses her to be wrong out loud', () => {
    // Being wrong is the evidence there was a mind behind it. Defending it
    // against the person whose life it is would be the actual failure.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', ctx, false)
    expect(prompt).toContain('willing to be WRONG')
    expect(prompt).toContain('Never defend it against them')
  })

  it('survives a Haiku brief replacing the flow', () => {
    // The brief owns tone and the flow slot; interiority lives outside it, or
    // it would vanish on exactly the outbound calls that matter most.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', ctx, false, 'Brief: keep it short.')
    expect(prompt).toContain('Brief: keep it short.')
    expect(prompt).toContain('WHAT YOU THINK')
  })
})

describe('no standing theory', () => {
  it('invites her to form one without requiring it', () => {
    // A manufactured theory is worse than none: a guess wearing the costume of
    // having paid attention.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', base, false)
    expect(prompt).toContain('YOU HAVE NO STANDING THEORY')
    expect(prompt).toContain('Do NOT manufacture one')
  })
})

describe('relationship stage', () => {
  it('carries how long they have known each other', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...base,
      relationship_stage: 'You have spoken 14 times over 30 days. You know each other now: stop explaining the mechanics, name them.',
    }, false)
    expect(prompt).toContain('HOW LONG YOU HAVE KNOWN THEM')
    expect(prompt).toContain('stop explaining the mechanics')
  })

  it('is omitted when there is no history to speak of', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', base, false)
    expect(prompt).not.toContain('HOW LONG YOU HAVE KNOWN THEM')
  })
})

describe('coaches get none of it', () => {
  it('omits interiority on a coach call', () => {
    // A coach is a partner, not someone being coached — theories about their
    // patterns would be presumptuous and off-register.
    const prompt = promptService.buildSystemPrompt('COACH_PONDER', {
      ...base,
      subscription_tier: 'COACH',
      ivy_theory: 'Something about them',
      relationship_stage: 'You have spoken 14 times.',
    }, false)
    expect(prompt).not.toContain('WHAT YOU THINK')
    expect(prompt).not.toContain('HOW LONG YOU HAVE KNOWN THEM')
  })
})
