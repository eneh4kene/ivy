/**
 * Turn-taking, and who actually receives it.
 *
 * Ivy had good conversational rules and they reached coaches only —
 * coachDeliveryRules() is wired to coach onboarding and the ponder call, so
 * every real member got one buried bullet ("Ask one question at a time") at
 * ~90% through an 8k-character prompt, losing to the numbered FLOW above it.
 *
 * Observed live (evening call, 1 Sept): she opened with a greeting, a verdict,
 * a question, an elaboration and a SECOND question before the member had said
 * a word — then asked "what time did you get it done, and was it a full
 * session or something lighter?" and finished her own sentence over his answer.
 *
 * These tests exist because the rules being WRITTEN was never the problem.
 */
import promptService from '../services/prompt.service';

const member = {
  user_name: 'Joseph',
  track: 'fitness',
  current_streak: 3,
  todays_plan: 'legs session',
  comm_preference: 'CALLS',
  todays_workout_status: 'COMPLETED',
  armed_today: true,
};

const build = (ctx: Record<string, unknown> = {}, type = 'EVENING_REVIEW') =>
  promptService.buildSystemPrompt(type, { ...member, ...ctx }, false);

describe('the conversational floor reaches members', () => {
  it('tells a member to talk in turns, not paragraphs', () => {
    expect(build()).toMatch(/Talk in turns, not paragraphs/);
  });

  it('ends the turn on the question instead of stacking', () => {
    const p = build();
    expect(p).toMatch(/ONE question per turn, and the question ENDS the turn/);
    expect(p).toMatch(/never bundle two questions into one breath/i);
  });

  it('treats silence as thinking rather than an absence to fill', () => {
    expect(build()).toMatch(/Silence after a question is them thinking, not them gone/);
  });

  it('yields the thread when they interrupt', () => {
    expect(build()).toMatch(/If they interrupt, they win/);
  });

  it('reaches the morning call too, not just the evening', () => {
    expect(build({}, 'MORNING_PLANNING')).toMatch(/ONE question per turn/);
  });

  // The rules did not regress out of the coach path when they were shared.
  it('still reaches a coach', () => {
    const p = promptService.buildSystemPrompt(
      'ONBOARDING',
      { ...member, subscription_tier: 'COACH' },
      false,
    );
    expect(p).toMatch(/Talk in turns, not paragraphs/);
    expect(p).toMatch(/ONE question per turn/);
  });
});

/**
 * The opening specifically. The FLOW section reads as a numbered script and
 * sits thousands of characters above any pacing rule, so it wins — which is
 * why this one is a tail directive rendered at the very end of the prompt,
 * the position this codebase has verified the model weights hardest.
 */
describe('the first turn', () => {
  it('is one greeting and one question, then silence', () => {
    const p = build();
    expect(p).toMatch(/YOUR FIRST TURN IS SHORT/);
    expect(p).toMatch(/Say hello and ask ONE thing/);
    expect(p).toMatch(/stop talking and wait, however long it takes/);
  });

  it('outranks the flow rather than politely competing with it', () => {
    const p = build();
    expect(p).toMatch(/this outranks the FLOW above/);
    // Rendered last: mid-prompt instructions lose to late ones here.
    expect(p.indexOf('YOUR FIRST TURN IS SHORT')).toBeGreaterThan(p.indexOf('FLOW:'));
  });

  it('forbids opening with a verdict on a day they have not described', () => {
    expect(build()).toMatch(/Do not pass judgment on their day before they have said a word/);
  });

  it('does not fire on chat, which has no turns to take', () => {
    expect(build({}, 'CHAT')).not.toMatch(/YOUR FIRST TURN IS SHORT/);
  });

  // The ponder call deliberately opens with value; leave that alone.
  it('does not fire on a coach call', () => {
    const p = promptService.buildSystemPrompt(
      'ONBOARDING',
      { ...member, subscription_tier: 'COACH' },
      false,
    );
    expect(p).not.toMatch(/YOUR FIRST TURN IS SHORT/);
  });
});

/**
 * "MISSED" is the status of a day nobody recorded, not a day we watched
 * someone skip. On an unarmed day no voice note existed, so nothing could ever
 * have moved the row off MISSED — stating it as fact is how she gets caught
 * being wrong by someone who trained that morning.
 */
describe('a miss she cannot actually verify', () => {
  const unrecorded = { todays_workout_status: 'MISSED', armed_today: false, unarmed_days_7d: 1 };

  it('calls it no record rather than a miss', () => {
    const p = build(unrecorded);
    expect(p).toContain('NO RECORD OF TODAY');
    expect(p).not.toContain('Evening Review — MISSED');
  });

  it('opens by asking what happened, not announcing it', () => {
    const p = build(unrecorded);
    expect(p).toMatch(/OPEN BY ASKING, NOT TELLING/);
    expect(p).toMatch(/you genuinely do not know what they did/i);
  });

  // A miss confirmed by a morning voice note IS a miss — don't soften that.
  it('still names a miss it can stand behind', () => {
    const p = build({ todays_workout_status: 'MISSED', armed_today: true });
    expect(p).toContain('Evening Review — MISSED');
    expect(p).not.toMatch(/OPEN BY ASKING, NOT TELLING/);
  });
});
