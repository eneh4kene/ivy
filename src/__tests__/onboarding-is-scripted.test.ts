/**
 * Onboarding is a set piece and must never be improvised.
 *
 * A Haiku brief REPLACES the flow slot in buildSystemPrompt. That is right for
 * the daily accountability calls — the flow is a shape and Haiku tunes the
 * approach. It is catastrophic for onboarding, where the script IS the product.
 *
 * The exemption existed and covered only COACH onboarding. A real client's
 * first call therefore ran with no script at all: no name capture, no
 * how-it-works, no save-my-number, no app, no channel question. It lasted
 * 2m43s against a 12-15 minute target, she was addressed as "Friend" because
 * nobody asked her name, and — with the flow's stake guard gone — Ivy invented
 * a £1 stake and told a client with no stake cycle her money was at risk.
 *
 * The decision now lives in ONE place. It used to be re-made at each call site,
 * and the two copies drifted.
 */

import { shouldUseBrief } from '../services/brief.service'
import { promptService } from '../services/prompt.service'

describe('which calls may be improvised', () => {
  it('never improvises onboarding — for a client OR a coach', () => {
    expect(shouldUseBrief('ONBOARDING')).toBe(false)
  })

  it('never improvises a ponder call', () => {
    expect(shouldUseBrief('COACH_PONDER')).toBe(false)
  })

  it('still briefs the daily accountability calls, where it belongs', () => {
    for (const t of ['EVENING_REVIEW', 'MORNING_PLANNING', 'RESCUE', 'WEEKLY_PLANNING', 'MONTHLY_CHECKIN']) {
      expect(shouldUseBrief(t)).toBe(true)
    }
  })
})

describe('the onboarding script actually reaches the model', () => {
  const ctx = {
    first_name: 'Sam', coach_name: 'Joseph', track: 'fitness',
    app_url: 'www.ivykeeps.life', comm_preference: 'TEXTS',
  }

  it('carries the beats that make it an onboarding call', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('HOW IT ALL WORKS')
    expect(prompt).toContain('SAVE MY NUMBER')
    expect(prompt).toContain('WHERE THE APP LIVES')
    expect(prompt).toContain('www.ivykeeps.life')
  })

  it('asks a text-preferred member whether they actually want that', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('you said text when you signed up')
  })

  it('holds the stake guard when the member has no stake', () => {
    // This is the line the improvised call lost, and losing it produced an
    // invented pound spoken to a real client.
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('Your word is the stake here')
    expect(prompt).toContain('do NOT pitch it')
  })

  it('a brief would REPLACE all of it — which is why onboarding must not get one', () => {
    // Pins the mechanism rather than trusting the guard alone: if this ever
    // stops being true the guard is pointless, and if the guard is removed this
    // test shows exactly what is lost.
    const withBrief = promptService.buildSystemPrompt('ONBOARDING', ctx, false, 'Brief: keep it warm and short.')
    expect(withBrief).toContain('Brief: keep it warm and short.')
    expect(withBrief).not.toContain('HOW IT ALL WORKS')
    expect(withBrief).not.toContain('WHERE THE APP LIVES')
  })
})

describe('she gets room to ask', () => {
  const ctx = { first_name: 'Sam', coach_name: 'Joseph', app_url: 'www.ivykeeps.life' }

  it('frames the beats as a conversation, not a checklist', () => {
    // The COACH onboarding flow has always said this; the client one never
    // did, so the client call read as a list being worked through.
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('THESE ARE BEATS, NOT A SCRIPT')
    expect(prompt).toContain('ticking boxes is how this call dies')
  })

  it('stops and asks what she wants to know', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('what do you want to ask me?')
    expect(prompt).toContain('SHE IS ALLOWED TO NOT UNDERSTAND')
  })

  it('asks again at the end, because the real question arrives last', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('Anything else you want to ask before I let you go?')
  })

  it('is ready for the two questions people actually ask', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false)
    expect(prompt).toContain('Are you a real person?')
    // A privacy question she is entitled to a straight answer on.
    expect(prompt).toContain('What does Joseph see?')
    expect(prompt).toContain('theirs')
    expect(prompt).toContain('Never bluff an answer')
  })
})

describe('the room is described as it IS, never as it might be', () => {
  const base = { first_name: 'Sam', coach_name: 'Joseph', app_url: 'www.ivykeeps.life' }

  it('says a one-person room is still filling, and forbids inventing anyone', () => {
    // The improvised call told her "Dawn Runners — they'll be doing sprints
    // together this season". One member, no game. Both invented.
    const prompt = promptService.buildSystemPrompt('ONBOARDING', {
      ...base, circle_name: 'Dawn Runners', circle_size: 1,
    }, false)
    expect(prompt).toContain('still filling')
    expect(prompt).toContain('Do NOT describe a game, a season, a challenge')
    expect(prompt).toContain('inventing them is the fastest way to lose their trust')
  })

  it('names a game only when one is actually running', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', {
      ...base, circle_name: 'Dawn Runners', circle_size: 5, circle_game_name: 'The Baton',
    }, false)
    expect(prompt).toContain('The Baton')
    expect(prompt).not.toContain('still filling')
  })

  it('says nothing at all when they are in no circle', () => {
    const prompt = promptService.buildSystemPrompt('ONBOARDING', base, false)
    expect(prompt).not.toContain('THE ROOM')
  })
})

describe('never promise a channel you do not use', () => {
  it('forbids saying "call" to a messages-only member', () => {
    // She was told "I'll call you Tuesday evening" while on text check-ins.
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      first_name: 'Sam', comm_preference: 'TEXTS',
    }, false)
    expect(prompt).toContain('they are on MESSAGES, not calls')
    expect(prompt).toContain('Never say you will "call" them')
  })

  it('says nothing about it to a member who does get calls', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      first_name: 'Sam', comm_preference: 'CALLS',
    }, false)
    expect(prompt).not.toContain('they are on MESSAGES, not calls')
  })
})
