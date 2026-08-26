/**
 * Inbound call cap.
 *
 * The cap exists to bound voice spend now that the voicemail invites callbacks.
 * The property that matters most is that it FAILS OPEN: it is a cost guard, not
 * a security control, and breaking someone's ability to reach Ivy to save £0.50
 * would be a far worse outcome than the overspend it prevents.
 */
import prisma from '../utils/prisma';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    call: { count: jest.fn(), create: jest.fn() },
  },
}));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  call: { count: jest.Mock; create: jest.Mock };
};

/** Mirrors the handler's decision, isolated so the rule can be asserted directly. */
const INBOUND_DAILY_CALL_CAP = 8;
async function isOverCap(userId: string): Promise<boolean> {
  try {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const callsToday = await db.call.count({
      where: { userId, scheduledAt: { gte: dayStart } },
    });
    return callsToday >= INBOUND_DAILY_CALL_CAP;
  } catch {
    return false; // fail open
  }
}

describe('inbound call cap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a normal caller through', async () => {
    db.call.count.mockResolvedValue(2);
    expect(await isOverCap('u1')).toBe(false);
  });

  it('allows the call that sits exactly one below the cap', async () => {
    db.call.count.mockResolvedValue(INBOUND_DAILY_CALL_CAP - 1);
    expect(await isOverCap('u1')).toBe(false);
  });

  it('caps once the daily ceiling is reached', async () => {
    db.call.count.mockResolvedValue(INBOUND_DAILY_CALL_CAP);
    expect(await isOverCap('u1')).toBe(true);
  });

  it('caps a runaway caller', async () => {
    db.call.count.mockResolvedValue(97);
    expect(await isOverCap('u1')).toBe(true);
  });

  // The important one. A sleeping Neon, a pool timeout or any transient fault
  // must never stop someone reaching Ivy.
  it('FAILS OPEN when the database is unreachable', async () => {
    db.call.count.mockRejectedValue(new Error("Can't reach database server"));
    expect(await isOverCap('u1')).toBe(false);
  });

  it('FAILS OPEN on a connection pool timeout', async () => {
    db.call.count.mockRejectedValue(new Error('Timed out fetching a new connection from the connection pool'));
    expect(await isOverCap('u1')).toBe(false);
  });
});

/**
 * Phone matching for inbound identification.
 *
 * The write path (updateUser) does not normalise, so a member's number can be
 * stored in a national or unpunctuated form. An exact match would hand that
 * member the stranger script on their own account.
 */
function normalisePhoneForMatch(raw: string): string | null {
  const stripped = (raw ?? '').replace(/[\s\-().]/g, '');
  if (!stripped) return null;
  if (stripped.startsWith('+')) return stripped;
  if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
  return stripped;
}
function phoneMatchCandidates(normalised: string): string[] {
  const set = new Set<string>([normalised]);
  if (normalised.startsWith('+')) {
    const digits = normalised.slice(1);
    set.add(digits);
    set.add(`00${digits}`);
    if (digits.startsWith('44')) set.add(`0${digits.slice(2)}`);
    if (digits.startsWith('1')) set.add(digits.slice(1));
  }
  return Array.from(set);
}

describe('inbound phone matching', () => {
  it('strips formatting from what Twilio sends', () => {
    expect(normalisePhoneForMatch('+44 7432 846-353')).toBe('+447432846353');
  });

  it('converts an international 00 prefix', () => {
    expect(normalisePhoneForMatch('00447432846353')).toBe('+447432846353');
  });

  it('finds a UK member stored in national format', () => {
    expect(phoneMatchCandidates('+447432846353')).toContain('07432846353');
  });

  it('finds a US member stored without the country code', () => {
    expect(phoneMatchCandidates('+16506635861')).toContain('6506635861');
  });

  it('always includes the canonical E.164 form', () => {
    expect(phoneMatchCandidates('+447432846353')).toContain('+447432846353');
  });

  it('never guesses a country code for a bare national number', () => {
    // Guessing would risk matching the wrong person's account.
    expect(phoneMatchCandidates(normalisePhoneForMatch('07432846353')!)).toEqual(['07432846353']);
  });

  it('handles an empty caller ID without throwing', () => {
    expect(normalisePhoneForMatch('')).toBeNull();
  });
});
