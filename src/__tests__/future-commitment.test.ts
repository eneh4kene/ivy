/**
 * Future-commitment capture.
 *
 * Writes a PLANNED workout, which arms the T-60 reminder machinery — so the
 * failure that matters is a FALSE POSITIVE planting a nudge for something
 * nobody agreed to.
 */
import futureCommitmentService from '../services/future-commitment.service';
import prisma from '../utils/prisma';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    workout: { findFirst: jest.fn(), create: jest.fn() },
  },
}));
jest.mock('../services/usage.service', () => ({ logUsage: jest.fn().mockResolvedValue(undefined) }));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  workout: { findFirst: jest.Mock; create: jest.Mock };
};

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class { messages = { create: (...a: unknown[]) => mockCreate(...a) }; },
}));
const modelSays = (o: unknown) =>
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(o) }], usage: {} });

const T = 'Agent: '.padEnd(120, 'x');

describe('future commitment capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'k';
    db.user.findUnique.mockResolvedValue({ timezone: 'Europe/London', track: 'fitness' });
    db.workout.findFirst.mockResolvedValue(null);
    db.workout.create.mockResolvedValue({});
  });

  it('plans a session when a day AND time were committed', async () => {
    modelSays({ committed: true, weekday: 'tuesday', time: '10:00', activity: 'legs at the gym' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plannedTime: '10:00', status: 'PLANNED', activity: 'legs at the gym' }),
    }));
  });

  it('does nothing when they only named a day', async () => {
    modelSays({ committed: true, weekday: 'tuesday', time: null });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it('does nothing when nothing was committed', async () => {
    modelSays({ committed: false, weekday: 'tuesday', time: '10:00' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it('rejects an invented weekday', async () => {
    modelSays({ committed: true, weekday: 'someday', time: '10:00' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed time', async () => {
    modelSays({ committed: true, weekday: 'tuesday', time: 'morning' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it('never overwrites a session the member already planned', async () => {
    db.workout.findFirst.mockResolvedValue({ id: 'existing' });
    modelSays({ committed: true, weekday: 'tuesday', time: '10:00' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it('always plans a date in the future', async () => {
    modelSays({ committed: true, weekday: 'tuesday', time: '10:00' });
    await futureCommitmentService.captureFromTranscript('u1', T);
    const planned = db.workout.create.mock.calls[0][0].data.plannedDate as Date;
    expect(planned.getTime()).toBeGreaterThan(Date.now());
  });

  it('ignores a transcript too short to contain a commitment', async () => {
    await futureCommitmentService.captureFromTranscript('u1', 'hi');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never throws on unparseable model output', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'nope' }], usage: {} });
    await expect(futureCommitmentService.captureFromTranscript('u1', T)).resolves.toBeUndefined();
  });
});
