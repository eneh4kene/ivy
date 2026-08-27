/**
 * Integrity signals.
 *
 * These exist so a sponsor conversation can happen without overclaiming. The
 * failure that matters most is a FALSE ACCUSATION — flagging someone honest —
 * so the quiet cases carry as much weight here as the suspicious ones.
 */
import integrityService from '../services/integrity.service';
import prisma from '../utils/prisma';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: { call: { findMany: jest.fn() }, workout: { findMany: jest.fn() } },
}));

const db = prisma as unknown as { call: { findMany: jest.Mock }; workout: { findMany: jest.Mock } };

const call = (duration: number, chars: number, obstacles: string[] = []) => ({
  duration,
  transcript: 'x'.repeat(chars),
  callInsights: obstacles.length ? { obstacles_mentioned: obstacles } : null,
  callType: 'EVENING_REVIEW',
});
const workout = (status: string, armed: boolean) => ({ status, armedAt: armed ? new Date() : null });

const codes = (r: { signals: Array<{ code: string }> }) => r.signals.map((s) => s.code);

describe('integrity signals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts an accounted day only when there was a real conversation', async () => {
    db.call.findMany.mockResolvedValue([
      call(120, 900, ['work ran late']),  // real
      call(8, 40),                        // picked up and hung up
      call(90, 60),                       // connected, said nothing
    ]);
    db.workout.findMany.mockResolvedValue([]);
    const r = await integrityService.getReport('u1');
    expect(r.accountedDays).toBe(1);
  });

  it('stays quiet for a normal engaged member', async () => {
    db.call.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => call(140, 1200, i % 3 === 0 ? ['work ran late'] : []))
    );
    db.workout.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, () => workout('COMPLETED', true)),
      ...Array.from({ length: 3 }, () => workout('MISSED', false)),
    ]);
    const r = await integrityService.getReport('u1');
    expect(r.signals).toHaveLength(0);
  });

  it('flags a long clean run where no obstacle was ever mentioned', async () => {
    db.call.findMany.mockResolvedValue(Array.from({ length: 12 }, () => call(140, 1200)));
    db.workout.findMany.mockResolvedValue(Array.from({ length: 12 }, () => workout('COMPLETED', true)));
    const r = await integrityService.getReport('u1');
    expect(codes(r)).toContain('no_obstacles_ever');
  });

  it('flags calls too short to be an account', async () => {
    db.call.findMany.mockResolvedValue(Array.from({ length: 8 }, () => call(20, 1200, ['x'])));
    db.workout.findMany.mockResolvedValue([]);
    const r = await integrityService.getReport('u1');
    expect(codes(r)).toContain('calls_too_short');
  });

  it('flags kept days with no morning voice note behind them', async () => {
    db.call.findMany.mockResolvedValue([call(140, 1200, ['x'])]);
    db.workout.findMany.mockResolvedValue(Array.from({ length: 8 }, () => workout('COMPLETED', false)));
    const r = await integrityService.getReport('u1');
    const s = r.signals.find((x) => x.code === 'claimed_without_arming');
    expect(s?.weight).toBe('high');
  });

  // A perfect record is not itself suspicious — plenty of people have one.
  it('does NOT flag an unbroken record on its own', async () => {
    db.call.findMany.mockResolvedValue(
      Array.from({ length: 14 }, (_, i) => call(150, 1400, i % 2 === 0 ? ['tired'] : []))
    );
    db.workout.findMany.mockResolvedValue(Array.from({ length: 14 }, () => workout('COMPLETED', true)));
    const r = await integrityService.getReport('u1');
    expect(codes(r)).not.toContain('unbroken_record');
    expect(r.signals).toHaveLength(0);
  });

  it('raises the unbroken record only alongside another signal', async () => {
    // Perfect AND never a single obstacle — the combination is the tell.
    db.call.findMany.mockResolvedValue(Array.from({ length: 14 }, () => call(150, 1400)));
    db.workout.findMany.mockResolvedValue(Array.from({ length: 14 }, () => workout('COMPLETED', true)));
    const r = await integrityService.getReport('u1');
    expect(codes(r)).toContain('no_obstacles_ever');
    expect(codes(r)).toContain('unbroken_record');
  });

  it('says nothing about a member with almost no history', async () => {
    db.call.findMany.mockResolvedValue([call(120, 900)]);
    db.workout.findMany.mockResolvedValue([workout('COMPLETED', true)]);
    const r = await integrityService.getReport('u1');
    expect(r.signals).toHaveLength(0);
  });
});
