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
import timezoneService from '../services/timezone.service';
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
    db.user.findUnique.mockResolvedValue({ timezone: 'America/New_York', firstName: 'Joseph' });
    db.user.update.mockResolvedValue({});
  });

  it('moves them when they have actually arrived somewhere else', async () => {
    answer('America/Chicago');
    await run();
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timezone: 'America/Chicago' } }),
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
      expect.objectContaining({ data: { timezone: 'America/Chicago' } }),
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
    await expect(run()).resolves.toBeUndefined();
  });

  it('never throws when the model fails', async () => {
    (timezoneService as unknown as { client: unknown }).client = {
      messages: { create: jest.fn().mockRejectedValue(new Error('haiku down')) },
    };
    await expect(run()).resolves.toBeUndefined();
  });

  it('does nothing for a user who no longer exists', async () => {
    answer('America/Chicago');
    db.user.findUnique.mockResolvedValue(null);
    await run();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
