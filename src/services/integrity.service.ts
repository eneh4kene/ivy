/**
 * Integrity — what we can honestly say a kept day is, and when to doubt it.
 *
 * Kept days are self-reported. That is correct while the member's own money is
 * at risk (they only cheat themselves), and it inverts the moment a third party
 * pays per kept day: lying then costs nothing and sends money to a charity they
 * like. This service exists so a sponsor conversation can happen without either
 * overclaiming or waiting on hardware.
 *
 * Two ideas, both built on data we already hold:
 *
 * 1. ACCOUNTED DAYS — say what is true rather than manufacturing proof.
 *    Not "4,000 verified workouts" (unprovable, and a sponsor's lawyers will
 *    check) but "4,000 days a member spoke to a coach and accounted for their
 *    commitment". Every one is backed by a timestamped transcript we can
 *    produce on request. Honest, auditable, and still the stronger CSR story:
 *    accountability is the product, not exercise.
 *
 * 2. INTEGRITY SIGNALS — detect the implausible instead of verifying each day.
 *    Insurers do not audit every gym visit; they price the aggregate and
 *    investigate outliers. These are SIGNALS, never accusations: real people do
 *    have clean months and terse days. They exist to be looked at, not to
 *    punish, and nothing in the product acts on them automatically.
 *
 * Note on Circles: peer witness is excellent for motivation and weak for audit —
 * five friends confirming each other is trivially collusive once money is
 * involved. It is deliberately NOT used as a verification input here.
 */
import prisma from '../utils/prisma';

export interface IntegritySignal {
  code: string;
  detail: string;
  /** How much doubt this alone justifies. Signals are additive, not conclusive. */
  weight: 'low' | 'medium' | 'high';
}

export interface IntegrityReport {
  userId: string;
  windowDays: number;
  /** Days with a completed, transcribed conversation about the commitment. */
  accountedDays: number;
  /** Days the member claimed as kept. */
  claimedKeptDays: number;
  /** Claimed days that never had a morning voice note behind them. */
  claimedWithoutArming: number;
  medianCallSeconds: number | null;
  medianTranscriptChars: number | null;
  obstaclesMentioned: number;
  signals: IntegritySignal[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

class IntegrityService {
  async getReport(userId: string, windowDays = 30): Promise<IntegrityReport> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [calls, workouts] = await Promise.all([
      prisma.call.findMany({
        where: { userId, status: 'COMPLETED', createdAt: { gte: since } },
        select: { duration: true, transcript: true, callInsights: true, callType: true },
      }),
      prisma.workout.findMany({
        where: { userId, plannedDate: { gte: since } },
        select: { status: true, armedAt: true },
      }),
    ]);

    // An accounted day needs an actual conversation, not just a connected call:
    // a voicemail or a three-second pickup accounts for nothing.
    const accounted = calls.filter((c) => (c.transcript?.length ?? 0) > 200 && (c.duration ?? 0) >= 30);
    const kept = workouts.filter((w) => w.status === 'COMPLETED' || w.status === 'PARTIAL');
    const claimedWithoutArming = kept.filter((w) => w.armedAt == null).length;

    const durations = calls.map((c) => c.duration ?? 0).filter((d) => d > 0);
    const lengths = calls.map((c) => c.transcript?.length ?? 0).filter((n) => n > 0);
    const obstacles = calls.reduce((n, c) => {
      const ins = c.callInsights as { obstacles_mentioned?: string[] } | null;
      return n + (ins?.obstacles_mentioned?.length ?? 0);
    }, 0);

    const medSecs = median(durations);
    const medChars = median(lengths);

    const signals: IntegritySignal[] = [];

    // Real life has friction. A long clean run with nobody ever mentioning a
    // single obstacle is the shape of someone agreeing rather than reporting.
    if (kept.length >= 10 && obstacles === 0) {
      signals.push({
        code: 'no_obstacles_ever',
        detail: `${kept.length} kept days and not one obstacle mentioned in any call`,
        weight: 'medium',
      });
    }

    // Accounting for a day takes longer than confirming one.
    if (medSecs != null && calls.length >= 5 && medSecs < 45) {
      signals.push({
        code: 'calls_too_short',
        detail: `median completed call is ${medSecs}s across ${calls.length} calls — closer to ticking a box than an account`,
        weight: 'medium',
      });
    }

    if (medChars != null && calls.length >= 5 && medChars < 400) {
      signals.push({
        code: 'thin_accounts',
        detail: `median transcript is ${medChars} characters — little detail to stand behind`,
        weight: 'low',
      });
    }

    // The ritual is the claim's foundation. A "kept" day nobody armed is a day
    // claimed after the fact.
    if (kept.length >= 5 && claimedWithoutArming / kept.length > 0.5) {
      signals.push({
        code: 'claimed_without_arming',
        detail: `${claimedWithoutArming} of ${kept.length} kept days had no morning voice note behind them`,
        weight: 'high',
      });
    }

    // Alone this means someone is doing well. Alongside the others it is the
    // difference between a good month and a rubber stamp — which is why it is
    // only raised when something else already looks off.
    if (workouts.length >= 14 && kept.length === workouts.length && signals.length > 0) {
      signals.push({
        code: 'unbroken_record',
        detail: `${kept.length}/${workouts.length} days kept with no misses — notable only because other signals are present`,
        weight: 'low',
      });
    }

    return {
      userId,
      windowDays,
      accountedDays: accounted.length,
      claimedKeptDays: kept.length,
      claimedWithoutArming,
      medianCallSeconds: medSecs,
      medianTranscriptChars: medChars,
      obstaclesMentioned: obstacles,
      signals,
    };
  }

  /**
   * The number a sponsor can be quoted, across everyone. Deliberately counts
   * conversations, not workouts — it is the claim we can actually defend.
   */
  async getAccountedDaysTotal(windowDays = 30): Promise<{ accountedDays: number; members: number }> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const calls = await prisma.call.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: since } },
      select: { userId: true, duration: true, transcript: true },
    });
    const real = calls.filter((c) => (c.transcript?.length ?? 0) > 200 && (c.duration ?? 0) >= 30);
    return { accountedDays: real.length, members: new Set(real.map((c) => c.userId)).size };
  }
}

export const integrityService = new IntegrityService();
export default integrityService;
