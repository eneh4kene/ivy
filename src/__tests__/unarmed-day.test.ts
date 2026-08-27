/**
 * Unarmed-day handling.
 *
 * A missed voice note is a different failure from a missed session, and the two
 * used to arrive at the evening call looking identical. The escalation matters
 * as much as the detection: a first slip is logistics, a repeated one is usually
 * avoidance, and treating the second like the first just produces nagging.
 */
import promptService from '../services/prompt.service';

const base = {
  user_name: 'Joseph',
  track: 'fitness',
  current_streak: 3,
  todays_plan: 'legs session',
  comm_preference: 'CALLS',
};

const build = (ctx: Record<string, unknown>) =>
  promptService.buildSystemPrompt('EVENING_REVIEW', { ...base, ...ctx }, false);

describe('unarmed day handling', () => {
  it('says nothing about arming when they armed', () => {
    const p = build({ armed_today: true, todays_workout_status: 'MISSED' });
    expect(p).not.toContain('UNARMED TODAY');
  });

  it('says nothing when arming state is unknown', () => {
    // null means we could not tell — silence beats a wrong accusation.
    const p = build({ armed_today: null, todays_workout_status: 'MISSED' });
    expect(p).not.toContain('UNARMED TODAY');
  });

  it('separates "did you do it" from "did you record it"', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 0, todays_workout_status: 'MISSED' });
    expect(p).toContain('UNARMED TODAY');
    expect(p).toMatch(/did you actually do it/i);
  });

  it('keeps a first slip light', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 0, todays_workout_status: 'MISSED' });
    expect(p).toMatch(/First one — keep it light/i);
    expect(p).not.toMatch(/hard to say out loud/i);
  });

  it('asks what is getting in the way on a second slip', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 1, todays_workout_status: 'MISSED' });
    expect(p).toMatch(/2 unarmed days this week/i);
    expect(p).toMatch(/getting in the way of the recording/i);
  });

  // The point of the whole feature: repeated avoidance is not a memory problem.
  it('asks the avoidance question once it is a pattern', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 3, todays_workout_status: 'MISSED' });
    expect(p).toMatch(/4th unarmed day/i);
    expect(p).toMatch(/hard to say out loud/i);
    expect(p).toMatch(/do NOT ask them to remember harder/i);
  });

  it('always closes on tomorrow\'s RECORDING, not just the session', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 1, todays_workout_status: 'MISSED' });
    expect(p).toMatch(/voice note tomorrow morning/i);
  });

  it('handles an unknown-outcome evening the same way', () => {
    const p = build({ armed_today: false, unarmed_days_7d: 0, todays_workout_status: 'PLANNED' });
    expect(p).toContain('UNARMED TODAY');
  });

  it('names it warmly when they completed the day but never recorded', () => {
    const p = build({ armed_today: false, todays_workout_status: 'COMPLETED' });
    expect(p).toMatch(/you just didn't say it out loud/i);
  });

  it('does not mention arming on a completed day that WAS armed', () => {
    const p = build({ armed_today: true, todays_workout_status: 'COMPLETED' });
    expect(p).not.toMatch(/didn't say it out loud/i);
  });
});

/**
 * Coach context on every call.
 *
 * The schema says coachNotes are "notes Ivy surfaces in calls", but they used to
 * reach only the onboarding prompt — read once on day one and never again. The
 * boundary matters as much as the presence: these steer what she ASKS, and must
 * never turn her into a second opinion on the programme.
 */
describe('coach context', () => {
  const coached = {
    ...base,
    coach_name: 'Joe',
    coach_programme: '3-day upper/lower split',
    coach_notes: 'Watch his shoulder — he will push through pain',
    todays_workout_status: 'COMPLETED',
    armed_today: true,
  };

  it('reaches an ordinary evening call, not just onboarding', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', coached, false);
    expect(p).toContain('COACH CONTEXT');
    expect(p).toContain('3-day upper/lower split');
  });

  it('uses the coach notes to steer, and forbids quoting them', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', coached, false);
    expect(p).toMatch(/steer what you ask/i);
    expect(p).toMatch(/never quote them back/i);
  });

  it('hands programme decisions back to the coach', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', coached, false);
    expect(p).toMatch(/that's Joe's call/i);
    expect(p).toMatch(/never re-explain, adjudicate or second-guess/i);
  });

  it('says nothing about a coach for a member who has none', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', { ...base, todays_workout_status: 'COMPLETED', armed_today: true }, false);
    expect(p).not.toContain('COACH CONTEXT');
  });

  it('handles a coach who has written no notes yet', () => {
    const { coach_notes, coach_programme, ...noNotes } = coached;
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', noNotes, false);
    // Nothing useful to steer with — stay silent rather than emit an empty header.
    expect(p).not.toContain('COACH CONTEXT');
  });
});
