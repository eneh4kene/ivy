/**
 * Timezone write-back guardrails.
 *
 * Call times are stored as a LOCAL wall clock, so moving the zone is the whole
 * fix — 20:00 stays 20:00 where they actually are. That also means a WRONG
 * write is expensive in a way a missed one is not: it silently relocates every
 * future call, which is the same failure the hourly-scheduler fix just closed.
 *
 * So these tests are mostly about refusing to write.
 */
import timezoneService, { chatMayMentionTravel } from '../services/timezone.service';
import prisma from '../utils/prisma';

const create = jest.fn();

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    callMemory: { create: (...a: unknown[]) => create(...a) },
  },
}));
jest.mock('../lib/ops-alert', () => ({ opsAlert: jest.fn() }));
jest.mock('../services/usage.service', () => ({ logUsage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/analytics', () => ({ serverAnalytics: { timezoneAutoUpdated: jest.fn() } }));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};

/** Stub the one Haiku call the service makes. */
const answer = (text: string) => {
  (timezoneService as unknown as { client: unknown }).client = {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    },
  };
};

const run = (transcript = 'some words about being somewhere') =>
  timezoneService.captureFromTranscript('u1', transcript);

describe('timezone write-back', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({});
    db.user.findUnique.mockResolvedValue({ timezone: 'America/New_York', firstName: 'Joseph', homeTimezone: null });
    db.user.update.mockResolvedValue({});
  });

  it('moves them when they have actually arrived somewhere else', async () => {
    answer('America/Chicago');
    await run();
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/Chicago', homeTimezone: 'America/New_York' } }),
    );
  });

  it('tells them it happened, via a memory the next call reads', async () => {
    answer('America/Chicago');
    await run();
    const memory = create.mock.calls[0][0].data.content as string;
    expect(memory).toMatch(/Chicago/);
    expect(memory).toMatch(/usual local time/);
  });

  it('does nothing when the model says NONE', async () => {
    answer('NONE');
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  // A hallucinated zone would be stored forever and break every future call.
  it('discards a zone that is not real', async () => {
    answer('America/Boston');
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('discards a bare place name', async () => {
    answer('Chicago');
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('does not rewrite the zone they are already on', async () => {
    answer('America/New_York');
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('tolerates a model that adds punctuation', async () => {
    answer('"America/Chicago".');
    await run();
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/Chicago', homeTimezone: 'America/New_York' } }),
    );
  });

  it('ignores an empty transcript without calling the model', async () => {
    answer('America/Chicago');
    await timezoneService.captureFromTranscript('u1', '   ');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  // Every caller is fire-and-forget; a throw here would surface as an
  // unhandled rejection in the webhook.
  it('never throws when the database fails', async () => {
    answer('America/Chicago');
    db.user.update.mockRejectedValue(new Error('db down'));
    await expect(run()).resolves.toBeNull();
  });

  it('never throws when the model fails', async () => {
    (timezoneService as unknown as { client: unknown }).client = {
      messages: { create: jest.fn().mockRejectedValue(new Error('haiku down')) },
    };
    await expect(run()).resolves.toBeNull();
  });

  it('does nothing for a user who no longer exists', async () => {
    answer('America/Chicago');
    db.user.findUnique.mockResolvedValue(null);
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

/**
 * The chat prefilter. A call transcript is a rare event worth one Haiku call;
 * a chat message is not — most are "yeah" and "ok". This decides only whether
 * to ASK, so it errs generous: a false positive costs one cheap model call, a
 * false negative means someone's calls stay in the wrong country.
 */
describe('the chat prefilter', () => {
  const travels = [
    "just landed in Denver",
    "I'm in Chicago all week",
    "flying out tomorrow morning",
    "we're in Lisbon until Sunday",
    "off to Boston for an interview",
    "still jetlagged tbh",
    "back home now, normal service resumes",
    "at the hotel, gym looks decent",
  ];
  for (const t of travels) {
    it(`asks about: "${t}"`, () => expect(chatMayMentionTravel(t)).toBe(true));
  }

  const ordinary = [
    "yeah did it",
    "ok",
    "missed today, work ran late",
    "can we move tomorrow to 7",
    "shoulder still sore",
    "smashed the deadlifts",
  ];
  for (const t of ordinary) {
    it(`stays quiet on: "${t}"`, () => expect(chatMayMentionTravel(t)).toBe(false));
  }
});

describe('the chat path itself', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({});
    db.user.findUnique.mockResolvedValue({ timezone: 'America/New_York', firstName: 'Joseph', homeTimezone: null });
    db.user.update.mockResolvedValue({});
  });

  it('moves them and reports the move, so the reply can say so', async () => {
    answer('America/Denver');
    const moved = await timezoneService.captureFromTranscript('u1', 'just landed in Denver', 'chat');
    expect(moved).toEqual({ from: 'America/New_York', to: 'America/Denver' });
  });

  it('reports nothing when nothing moved', async () => {
    answer('NONE');
    await expect(
      timezoneService.captureFromTranscript('u1', 'flying out at some point', 'chat'),
    ).resolves.toBeNull();
  });
});

/**
 * The return leg. Travel used to be a one-way door: "landed in Denver" moved
 * them, and "I'm back home" had nothing to resolve to — home is a fact only we
 * hold, not something a model can infer — so they stayed on Denver time
 * indefinitely. That is a worse state than never having moved at all.
 */
describe('coming home again', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({});
    db.user.update.mockResolvedValue({});
  });

  it('remembers where they left from on the way out', async () => {
    db.user.findUnique.mockResolvedValue({ timezone: 'America/New_York', firstName: 'J', homeTimezone: null });
    answer('America/Denver');
    await run('landed in Denver');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/Denver', homeTimezone: 'America/New_York' } }),
    );
  });

  it('restores home and forgets the trip when they get back', async () => {
    db.user.findUnique.mockResolvedValue({ timezone: 'America/Denver', firstName: 'J', homeTimezone: 'America/New_York' });
    answer('America/New_York');
    await run("I'm back home");
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/New_York', homeTimezone: null } }),
    );
  });

  it('tells the model what home is, so "back home" can resolve at all', async () => {
    db.user.findUnique.mockResolvedValue({ timezone: 'America/Denver', firstName: 'J', homeTimezone: 'America/New_York' });
    answer('America/New_York');
    await run("I'm back home");
    const sent = ((timezoneService as unknown as { client: { messages: { create: jest.Mock } } })
      .client.messages.create.mock.calls[0][0].messages[0].content) as string;
    expect(sent).toMatch(/currently AWAY from home/);
    expect(sent).toContain('America/New_York');
  });

  // Otherwise the second trip records a hotel as home and they never get back.
  it('keeps the original home when they move on to a THIRD place', async () => {
    db.user.findUnique.mockResolvedValue({ timezone: 'America/Denver', firstName: 'J', homeTimezone: 'America/New_York' });
    answer('America/Chicago');
    await run('now in Chicago for two days');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/Chicago', homeTimezone: 'America/New_York' } }),
    );
  });

  it('says they are back, not that they have gone somewhere new', async () => {
    db.user.findUnique.mockResolvedValue({ timezone: 'America/Denver', firstName: 'J', homeTimezone: 'America/New_York' });
    answer('America/New_York');
    await run("I'm back home");
    expect(create.mock.calls[0][0].data.content).toMatch(/Back home in New York/);
  });
});
