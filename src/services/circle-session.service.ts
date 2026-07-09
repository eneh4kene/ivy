/**
 * Async circle sessions — the moment members actually meet.
 *
 * Lifecycle: scheduled (created at sprint close by season.service) → open
 * (72h window; every member is invited to drop one win + one honest struggle)
 * → completed (room sealed; sharers keep the room, absentees get Ivy's
 * catch-up on their next call).
 *
 * The core mechanic: SHARING IS THE PRICE OF SEEING THE ROOM. Until you've
 * put your own win/struggle in, other people's shares are counted but hidden.
 * This keeps the room honest (no lurkers) and gives Ivy real, member-authored
 * material to weave into calls — not synthetic summaries.
 */
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import circleCatchupService from './circle-catchup.service';

const OPEN_WINDOW_HOURS = 72;

export interface SessionShareView {
  firstName: string;
  isYou: boolean;
  win: string;
  struggle: string;
}

class CircleSessionService {
  /** Sessions whose time has come: scheduled → open, everyone invited. */
  async openDueSessions(): Promise<number> {
    const due = await prisma.circleSprintSession.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: new Date() }, circleId: { not: null } },
      select: { id: true, circleId: true, sprintNumber: true, circle: { select: { name: true } } },
    });

    for (const session of due) {
      await prisma.circleSprintSession.update({
        where: { id: session.id },
        data: { status: 'open' },
      });

      const members = await prisma.ivyCircleMember.findMany({
        where: { circleId: session.circleId!, isActive: true },
        select: { userId: true },
      });

      const chatService = (await import('./chat.service')).default;
      for (const m of members) {
        chatService.postIvyMessage(
          m.userId,
          `Your ${session.circle?.name ?? 'circle'} session is open — drop one win and one honest struggle from this sprint. You'll see everyone else's the moment yours is in. The room closes in ${OPEN_WINDOW_HOURS} hours.`,
          { messageType: 'circle_session', metadata: { sessionId: session.id, action: 'session_open' } },
        ).catch((err) => logger.warn(`Session-open message failed for ${m.userId}:`, err));
      }
      logger.info(`Circle session ${session.id} opened (${members.length} members invited)`);
    }
    return due.length;
  }

  /** Sessions past their window: open → completed, room sealed, absentees get catch-up. */
  async closeExpiredSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - OPEN_WINDOW_HOURS * 3_600_000);
    const expired = await prisma.circleSprintSession.findMany({
      where: { status: 'open', scheduledAt: { lte: cutoff }, circleId: { not: null } },
      select: {
        id: true, circleId: true, sprintNumber: true,
        collectivePledge: true,
        circle: { select: { name: true } },
        shares: { select: { userId: true, win: true, struggle: true, user: { select: { firstName: true } } } },
      },
    });

    for (const session of expired) {
      const sharerIds = session.shares.map((s) => s.userId);
      const memberCount = await prisma.ivyCircleMember.count({
        where: { circleId: session.circleId!, isActive: true },
      });

      // Latest sprint pledge doubles as the collective pledge the catch-up
      // references — fall back to the standing promise of the room.
      let pledge = session.collectivePledge;
      if (!pledge) {
        const goal = await prisma.circleSprintGoal.findFirst({
          where: { circleId: session.circleId! },
          orderBy: { sprintNumber: 'desc' },
          select: { pledge: true },
        });
        pledge = goal?.pledge ?? 'Show up for each other, one day at a time';
      }

      await prisma.circleSprintSession.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          conductedAt: new Date(),
          participantUserIds: JSON.stringify(sharerIds),
          collectivePledge: pledge,
          // Member-authored highlights — Ivy weaves these into absentees'
          // catch-ups and future calls. Real words beat synthetic summaries.
          highlights: JSON.stringify(
            session.shares.map((s) => ({
              name: s.user.firstName,
              win: s.win.slice(0, 200),
              struggle: s.struggle.slice(0, 200),
            })),
          ),
        },
      });

      // Sharers get the seal; absentees get Ivy's catch-up on their next call.
      const chatService = (await import('./chat.service')).default;
      for (const sharerId of sharerIds) {
        chatService.postIvyMessage(
          sharerId,
          `${session.circle?.name ?? 'Circle'} session closed — ${sharerIds.length} of ${memberCount} stepped in. I'll be carrying the room's words into the week.`,
          { messageType: 'circle_session', metadata: { sessionId: session.id, action: 'session_closed' }, notify: false },
        ).catch((err) => logger.warn(`Session-close message failed for ${sharerId}:`, err));
      }

      await circleCatchupService.createCatchupsForAbsentees(session.id)
        .catch((err) => logger.warn(`Catch-up creation failed for session ${session.id}:`, err));

      logger.info(`Circle session ${session.id} completed: ${sharerIds.length}/${memberCount} shared`);
    }
    return expired.length;
  }

  /** The member's current session (latest for their circle) + room visibility rules. */
  async getCurrentSession(userId: string) {
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) return null;

    const session = await prisma.circleSprintSession.findFirst({
      where: { circleId: membership.circleId, status: { in: ['scheduled', 'open', 'completed'] } },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true, status: true, scheduledAt: true, sprintNumber: true,
        shares: { select: { userId: true, win: true, struggle: true, user: { select: { firstName: true } } } },
      },
    });
    if (!session) return null;

    const memberCount = await prisma.ivyCircleMember.count({
      where: { circleId: membership.circleId, isActive: true },
    });
    const mine = session.shares.find((s) => s.userId === userId) ?? null;

    // The room is visible only to those who put something in it.
    const room: SessionShareView[] | null = mine
      ? session.shares.map((s) => ({
          firstName: s.user.firstName,
          isYou: s.userId === userId,
          win: s.win,
          struggle: s.struggle,
        }))
      : null;

    return {
      id: session.id,
      status: session.status,
      opensAt: session.scheduledAt,
      closesAt: new Date(session.scheduledAt.getTime() + OPEN_WINDOW_HOURS * 3_600_000),
      sprintNumber: session.sprintNumber,
      memberCount,
      sharedCount: session.shares.length,
      myShare: mine ? { win: mine.win, struggle: mine.struggle } : null,
      room,
    };
  }

  /** Put your win + struggle in — unlocks the room. Upsert (edits allowed while open). */
  async submitShare(userId: string, win: string, struggle: string) {
    if (!win.trim() || !struggle.trim()) {
      throw new BadRequestError('Both a win and an honest struggle are required — that\'s the deal.');
    }

    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) throw new NotFoundError('You are not in a circle');

    const session = await prisma.circleSprintSession.findFirst({
      where: { circleId: membership.circleId, status: 'open' },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true },
    });
    if (!session) throw new BadRequestError('No session is open right now');

    await prisma.circleSessionShare.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      create: { sessionId: session.id, userId, win: win.trim().slice(0, 500), struggle: struggle.trim().slice(0, 500) },
      update: { win: win.trim().slice(0, 500), struggle: struggle.trim().slice(0, 500) },
    });

    return this.getCurrentSession(userId);
  }
}

export const circleSessionService = new CircleSessionService();
export default circleSessionService;
