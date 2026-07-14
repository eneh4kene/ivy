import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { addHours } from 'date-fns';

class CircleCatchupService {
  /**
   * Called when a sprint session is marked complete.
   * Finds circle members who weren't in participantUserIds and writes
   * a pending catch-up record for each of them.
   */
  async createCatchupsForAbsentees(sessionId: string): Promise<void> {
    const session = await prisma.circleSprintSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        circleId: true,
        sprintNumber: true,
        participantUserIds: true,
        collectivePledge: true,
        highlights: true,
      },
    });

    if (!session?.circleId || !session.collectivePledge) {
      logger.warn(`Session ${sessionId} missing circleId or collectivePledge — skipping catch-up`);
      return;
    }

    let attendedIds: string[] = [];
    try {
      attendedIds = JSON.parse(session.participantUserIds);
    } catch {
      attendedIds = [];
    }

    const allMembers = await prisma.ivyCircleMember.findMany({
      where: { circleId: session.circleId, isActive: true },
      select: { userId: true },
    });

    const absentees = allMembers
      .map((m) => m.userId)
      .filter((id) => !attendedIds.includes(id));

    if (absentees.length === 0) {
      logger.info(`Session ${sessionId}: no absentees`);
      return;
    }

    const expiresAt = addHours(new Date(), 48);

    await Promise.allSettled(
      absentees.map((userId) =>
        prisma.circleCatchup.upsert({
          where: { userId_sessionId: { userId, sessionId } },
          create: {
            userId,
            sessionId,
            sprintNumber: session.sprintNumber ?? 0,
            collectivePledge: session.collectivePledge!,
            highlights: session.highlights ?? null,
            expiresAt,
          },
          update: {
            collectivePledge: session.collectivePledge!,
            highlights: session.highlights ?? null,
            expiresAt,
            coveredAt: null, // re-open if session was updated
          },
        })
      )
    );

    const { serverAnalytics } = await import('../lib/analytics');
    for (const userId of absentees) serverAnalytics.circleCatchupCreated(userId, session.circleId);

    logger.info(`Circle catch-ups created for ${absentees.length} absentee(s) — session ${sessionId}`);
  }

  /**
   * Returns the active pending catch-up for a user, or null.
   * Ignores expired and already-covered records.
   */
  async getPendingCatchup(userId: string): Promise<{
    sprintNumber: number;
    collectivePledge: string;
    highlights: string | null;
  } | null> {
    const record = await prisma.circleCatchup.findFirst({
      where: {
        userId,
        coveredAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { sprintNumber: true, collectivePledge: true, highlights: true },
    });

    return record ?? null;
  }

  /**
   * Marks all pending catch-ups for a user as covered.
   * Called after a completed call where Ivy covered the session.
   */
  async markCovered(userId: string): Promise<void> {
    const result = await prisma.circleCatchup.updateMany({
      where: { userId, coveredAt: null },
      data: { coveredAt: new Date() },
    });
    if (result.count > 0) {
      const { serverAnalytics } = await import('../lib/analytics');
      serverAnalytics.circleCatchupCovered(userId);
    }
  }
}

export const circleCatchupService = new CircleCatchupService();
export default circleCatchupService;
