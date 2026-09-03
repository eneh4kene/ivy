/**
 * Travel, and what Ivy knows about where someone is.
 *
 * Asked before onboarding two US clients, one of whom had an interview in
 * another state the next day. Three separate gaps sat behind that question:
 * her weekday came from the server's UTC clock, travel was listed only beside
 * injury as a reason to pause, and nothing tells the member that the call time
 * does not follow them across a timezone.
 */
import promptService from '../services/prompt.service';

const member = {
  user_name: 'Joseph',
  track: 'fitness',
  current_streak: 3,
  comm_preference: 'CALLS',
  todays_workout_status: 'COMPLETED',
  armed_today: true,
  timezone: 'America/New_York',
  local_time: '20:05',
  travel_signal: true,   // a recent call surfaced a trip — the full block applies
};

const build = (ctx: Record<string, unknown> = {}, type = 'EVENING_REVIEW') =>
  promptService.buildSystemPrompt(type, { ...member, ...ctx }, false);

describe('travel — the full block, when a recent call surfaced a trip', () => {
  it('names the timezone her calls are actually pinned to', () => {
    const p = build();
    expect(p).toContain('America/New_York');
    expect(p).toMatch(/does NOT move when they do/);
  });

  it('tells them where to change it, since she cannot', () => {
    expect(build()).toMatch(/set it in the app under Settings/);
  });

  it('asks one question about it, not three', () => {
    expect(build()).toMatch(/ask ONE question: roughly what time would work/);
  });

  it('adapts the day instead of writing it off', () => {
    const p = build();
    expect(p).toMatch(/NOT automatically a write-off/);
    expect(p).toMatch(/find the version of their commitment that survives it/);
  });

  it('leads with the event they named, not with training', () => {
    const p = build();
    expect(p).toMatch(/LEAD with it next time/);
    expect(p).toMatch(/the training is the second question, not the first/);
  });

  // Travel that genuinely makes it impossible is still a real reason out.
  it('does not negotiate a minimum against a red-eye', () => {
    expect(build()).toMatch(/Do not negotiate a minimum against a red-eye/);
  });

  it('says nothing about travel to a coach, who has no sessions', () => {
    const p = promptService.buildSystemPrompt(
      'ONBOARDING',
      { ...member, subscription_tier: 'COACH' },
      false,
    );
    expect(p).not.toMatch(/IF THEY MENTION TRAVELLING/);
  });

  it('carries their wall clock so an odd calling hour is visible to her', () => {
    expect(build()).toMatch(/It is 20:05 where they are/);
  });

  // Nothing sets local_time on some paths; the block must still be coherent.
  it('survives a missing local time', () => {
    const { local_time, ...noClock } = member;
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', noClock, false);
    expect(p).toMatch(/IF THEY MENTION TRAVELLING/);
    expect(p).not.toMatch(/It is undefined where they are/);
  });
});

/**
 * The gate. The full block is 11% of the prompt and applies to nobody on most
 * calls, so it ships only when a recent call actually surfaced a trip — travel
 * is announced in advance, which is what makes yesterday's signal arrive in
 * time. But travel can still come up cold, and "she had no idea" is not a
 * saving worth making, so the gated-off case keeps one line.
 */
describe('travel — gated off for someone going nowhere', () => {
  const settled = (() => { const { travel_signal, ...rest } = member; return rest; })();
  const p = () => promptService.buildSystemPrompt('EVENING_REVIEW', settled, false);

  it('drops the full block', () => {
    expect(p()).not.toMatch(/IF THEY MENTION TRAVELLING/);
    expect(p()).not.toMatch(/find the version of their commitment that survives it/);
  });

  it('still knows what to say if it comes up cold', () => {
    expect(p()).toMatch(/IF TRAVEL COMES UP/);
    expect(p()).toContain('America/New_York');
    expect(p()).toMatch(/do NOT move when they do/);
    expect(p()).toMatch(/Settings/);
  });

  it('is dramatically shorter than carrying the whole block', () => {
    const gatedOn = promptService.buildSystemPrompt('EVENING_REVIEW', member, false);
    expect(p().length).toBeLessThan(gatedOn.length - 800);
  });
});

/**
 * Injury is deliberately NOT gated: nobody announces a torn hamstring on
 * yesterday's call. Only the stake sentence is conditional.
 */
describe('injury stays unconditional', () => {
  it('is present for someone with no prior signal at all', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', { user_name: 'Joseph', track: 'fitness' }, false);
    expect(p).toMatch(/IF THEY'RE INJURED, ILL, OR GENUINELY OUT/);
  });

  it('drops the white-knuckle-a-stake line for a member with no stake', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', { ...member, stake_weekly: null }, false);
    expect(p).not.toMatch(/white-knuckle a stake/);
    expect(p).toMatch(/rather than counted as misses/);
  });

  it('keeps it for a member with real money at risk', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', { ...member, stake_weekly: 14 }, false);
    expect(p).toMatch(/white-knuckle a stake/);
  });
});

/**
 * Billing shipped to everyone, including comped beta clients who have never
 * seen a card field and cannot have a charge to dispute.
 */
describe('billing is gated on ever having paid', () => {
  it('is absent for a comped client with no payment method', () => {
    expect(promptService.buildSystemPrompt('EVENING_REVIEW', member, false))
      .not.toMatch(/BILLING & MONEY DISPUTES/);
  });

  it('is present once they have a card on file', () => {
    expect(promptService.buildSystemPrompt('EVENING_REVIEW', { ...member, has_payment_method: true }, false))
      .toMatch(/BILLING & MONEY DISPUTES/);
  });

  // Whatever else is gated, the safety floor is not.
  it('never gates the crisis protocol', () => {
    for (const ctx of [member, { ...member, has_payment_method: true }, { user_name: 'X', track: 'fitness' }]) {
      expect(promptService.buildSystemPrompt('EVENING_REVIEW', ctx, false)).toMatch(/CRISIS PROTOCOL/);
    }
  });
});

/**
 * The onboarding call has the same stacking problem as the evening one, and a
 * denser script to recite it from.
 */
describe('onboarding pacing', () => {
  const ob = () => promptService.buildSystemPrompt('ONBOARDING', member, false);

  it('gets the first-turn rule like every other member call', () => {
    expect(ob()).toMatch(/YOUR FIRST TURN IS SHORT/);
  });

  it('gets the conversational floor', () => {
    expect(ob()).toMatch(/ONE question per turn/);
  });

  it('no longer puts two questions on one line in the understand beat', () => {
    const p = ob();
    expect(p).not.toContain("What's the real goal behind the goal? What changes if you get there?");
    expect(p).toMatch(/two turns, never one line/);
  });
});
