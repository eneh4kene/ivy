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
};

const build = (ctx: Record<string, unknown> = {}, type = 'EVENING_REVIEW') =>
  promptService.buildSystemPrompt(type, { ...member, ...ctx }, false);

describe('travel', () => {
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
