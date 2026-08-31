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

/**
 * Promises about being back in touch.
 *
 * Observed live: Ivy closed a call with "I'm checking in on his recovery
 * tomorrow morning" for a member with no morning call — he would get an
 * automated voice-note prompt and not hear from her until the following
 * evening. She had no idea when she next spoke to anyone.
 */
describe('contact promises', () => {
  it('forbids a morning check-in when there is no morning call', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...base,
      next_contact: 'an automated voice-note prompt at 07:00 (NOT a conversation — you do not speak to them), then the evening call at 20:00',
      morning_is_a_conversation: false,
      todays_workout_status: 'COMPLETED',
      armed_today: true,
    }, false);
    expect(p).toMatch(/There is NO morning call/i);
    expect(p).toMatch(/do not say "I'll check in tomorrow morning"/i);
    expect(p).toMatch(/when we speak tomorrow evening/i);
  });

  it('allows it when a morning call really is scheduled', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...base,
      next_contact: 'a morning call at 07:00, then the evening call at 20:00',
      morning_is_a_conversation: true,
      todays_workout_status: 'COMPLETED',
      armed_today: true,
    }, false);
    expect(p).toMatch(/a promise you can keep/i);
    expect(p).not.toMatch(/There is NO morning call/i);
  });

  it('says nothing when no contact is scheduled at all', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...base, next_contact: null, todays_workout_status: 'COMPLETED', armed_today: true,
    }, false);
    expect(p).not.toContain('WHEN YOU ARE NEXT IN TOUCH');
  });
});

/**
 * Pressing, and knowing when to stop.
 *
 * Observed live: a member deflected a request for a specific commitment, Ivy
 * pushed twice more, he stopped answering and the call ended on inactivity —
 * his last experience of her was being harangued. Also, she attributed a Sunday
 * miss to "the second time Monday has eaten it": a confident, checkable error,
 * which is the fastest way to make every count she cites worthless.
 */
describe('pressing and precision', () => {
  const withBlockers = {
    ...base,
    todays_workout_status: 'MISSED',
    armed_today: true,
    day_of_week: 'Sunday',
    recurring_blockers: [{ blocker: 'work ran late', times_seen: 2, last_seen: '2026-08-30' }],
  };

  it('permits one push, then requires acceptance', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', withBlockers, false);
    expect(p).toMatch(/ASK ONCE, THEN LET IT GO/);
    expect(p).toMatch(/Never ask a third time/i);
  });

  it('tells her today\'s weekday so she cannot misattribute a pattern', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', withBlockers, false);
    expect(p).toMatch(/TODAY IS Sunday/);
    expect(p).toMatch(/check that before attributing a miss to a particular day/i);
  });

  it('still names the blocker with its real count', () => {
    const p = promptService.buildSystemPrompt('EVENING_REVIEW', withBlockers, false);
    expect(p).toMatch(/"work ran late" \(2x\)/);
  });
});
