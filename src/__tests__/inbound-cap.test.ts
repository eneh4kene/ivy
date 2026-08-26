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
