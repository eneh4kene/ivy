/**
 * Plan adjustment write-back.
 *
 * A phone call now mutates a member's schedule, so the failure that matters is
 * a FALSE POSITIVE: acting on a proposal nobody accepted, or on a value nobody
 * clearly said. Those tests carry the weight here.
 */
import planAdjustmentService from '../services/plan-adjustment.service';
import prisma from '../utils/prisma';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock('../services/usage.service', () => ({ logUsage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/ops-alert', () => ({ opsAlert: jest.fn().mockResolvedValue(undefined) }));

const db = prisma as unknown as { user: { findUnique: jest.Mock; update: jest.Mock } };

// Stand in for Haiku: whatever the model would have returned.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class { messages = { create: (...a: unknown[]) => mockCreate(...a) }; },
}));

const modelSays = (obj: unknown) =>
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

const TRANSCRIPT = 'Agent: '.padEnd(120, 'x'); // long enough to pass the length gate

describe('plan adjustment write-back', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    db.user.findUnique.mockResolvedValue({
      armingWindowStart: '07:00', armingWindowEnd: '09:00', eveningCallTime: '20:00', preferredDays: null,
    });
    db.user.update.mockResolvedValue({});
  });

  it('applies a clearly agreed window change', async () => {
    modelSays({ agreed: true, armingWindowStart: '06:00', armingWindowEnd: '08:00', summary: 'moved to mornings' });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ armingWindowStart: '06:00', armingWindowEnd: '08:00' }),
    }));
  });

  it('applies an agreed change of training days', async () => {
    modelSays({ agreed: true, preferredDays: ['monday', 'wednesday', 'friday'] });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ preferredDays: JSON.stringify(['monday', 'wednesday', 'friday']) }),
    }));
  });

  // The one that protects members from a misheard yes.
  it('does NOTHING when the member did not agree', async () => {
    modelSays({ agreed: false, armingWindowStart: '06:00' });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('drops a malformed time rather than writing it', async () => {
    modelSays({ agreed: true, armingWindowStart: 'mornings' });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('refuses a window whose end is not after its start', async () => {
    // Moving only the start could otherwise invert the window and silently
    // disable the whole arming loop.
    modelSays({ agreed: true, armingWindowStart: '11:00' }); // stored end is 09:00
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('ignores invented weekday names', async () => {
    modelSays({ agreed: true, preferredDays: ['someday', 'whenever'] });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('never writes programme or money fields even if the model returns them', async () => {
    modelSays({ agreed: true, track: 'focus', goal: 'something else', stakeWeeklyAmount: 999, eveningCallTime: '21:00' });
    await planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT);
    const data = db.user.update.mock.calls[0][0].data;
    expect(data).toEqual({ eveningCallTime: '21:00' });
    expect(data).not.toHaveProperty('track');
    expect(data).not.toHaveProperty('goal');
    expect(data).not.toHaveProperty('stakeWeeklyAmount');
  });

  it('ignores a transcript too short to contain an agreement', async () => {
    await planAdjustmentService.captureFromTranscript('u1', 'Agent: hi');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never throws when the model returns unparseable output', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }], usage: {} });
    await expect(planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT)).resolves.toBeUndefined();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('never throws when the database write fails', async () => {
    modelSays({ agreed: true, eveningCallTime: '21:00' });
    db.user.update.mockRejectedValue(new Error('db down'));
    await expect(planAdjustmentService.captureFromTranscript('u1', TRANSCRIPT)).resolves.toBeUndefined();
  });
});
