import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { sendPushToUser, pushTemplates } from './push.service';

class SeasonService {
  async getActiveSeason(userId: string) {
    return prisma.season.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { sprints: { orderBy: { number: 'asc' } } },
      orderBy: { number: 'desc' },
    });
  }

  async getAllSeasons(userId: string) {
    return prisma.season.findMany({
      where: { userId },
      include: { sprints: { orderBy: { number: 'asc' } } },
      orderBy: { number: 'desc' },
    });
  }

  async createSeason(userId: string, data: { goal: string; title?: string; startDate?: Date }) {
    const lastSeason = await prisma.season.findFirst({
      where: { userId },
      orderBy: { number: 'desc' },
    });
    const number = (lastSeason?.number ?? 0) + 1;
    const startDate = data.startDate ?? new Date();
    const endDate = new Date(startDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks

    const season = await prisma.season.create({
      data: {
        userId,
        number,
        title: data.title,
        goal: data.goal,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
    });

    // Auto-create 3 sprints — sprint 1 starts ACTIVE, 2 and 3 start UPCOMING
    const sprints = [];
    for (let i = 1; i <= 3; i++) {
      const sprintStart = new Date(startDate.getTime() + (i - 1) * 4 * 7 * 24 * 60 * 60 * 1000);
      const sprintEnd = new Date(sprintStart.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
      sprints.push(
        prisma.sprint.create({
          data: {
            seasonId: season.id,
            number: i,
            startDate: sprintStart,
            endDate: sprintEnd,
            status: i === 1 ? 'ACTIVE' : 'UPCOMING',
          },
        })
      );
    }
    await Promise.all(sprints);

    return prisma.season.findUnique({
      where: { id: season.id },
      include: { sprints: { orderBy: { number: 'asc' } } },
    });
  }

  async closeSeason(userId: string, seasonId: string) {
    const season = await prisma.season.findFirst({ where: { id: seasonId, userId } });
    if (!season) throw new Error('Season not found');

    return prisma.season.update({
      where: { id: seasonId },
      data: { status: 'CLOSING', closedAt: new Date() },
    });
  }

  async getCurrentSprint(userId: string) {
    const season = await this.getActiveSeason(userId);
    if (!season) return null;

    const now = new Date();
    // First try explicit ACTIVE status; fall back to date-based match
    return (
      season.sprints.find((s) => s.status === 'ACTIVE' && s.startDate <= now && s.endDate >= now) ??
      season.sprints.find((s) => s.startDate <= now && s.endDate >= now) ??
      null
    );
  }

  // Called by daily cron — advances sprint/season statuses based on current date
  async advanceStatuses(): Promise<void> {
    const now = new Date();

    // Activate upcoming sprints whose start date has passed
    await prisma.sprint.updateMany({
      where: { status: 'UPCOMING', startDate: { lte: now } },
      data: { status: 'ACTIVE' },
    });

    // Complete active sprints whose end date has passed
    const completedSprints = await prisma.sprint.findMany({
      where: { status: 'ACTIVE', endDate: { lt: now } },
      select: { id: true, seasonId: true },
    });

    if (completedSprints.length > 0) {
      await prisma.sprint.updateMany({
        where: { id: { in: completedSprints.map((s) => s.id) } },
        data: { status: 'COMPLETED', completedAt: now },
      });
    }

    // Sprint end events — trigger for newly completed sprints
    if (completedSprints.length > 0) {
      for (const sprint of completedSprints) {
        const season = await prisma.season.findUnique({
          where: { id: sprint.seasonId },
          select: { userId: true, number: true },
        });
        if (season) {
          await this.onSprintEnd(season.userId, sprint.seasonId, sprint.id).catch((err) =>
            logger.warn(`Sprint-end events failed for sprint ${sprint.id}:`, err)
          );
        }
      }
    }

    // Close seasons whose end date has passed
    const closingSeasons = await prisma.season.findMany({
      where: { status: 'ACTIVE', endDate: { lt: now } },
      select: { id: true, userId: true },
    });

    if (closingSeasons.length > 0) {
      await prisma.season.updateMany({
        where: { id: { in: closingSeasons.map((s) => s.id) } },
        data: { status: 'CLOSING' },
      });

      // Schedule Season Close call for each user
      for (const season of closingSeasons) {
        await this.onSeasonEnd(season.userId, season.id).catch((err) =>
          logger.warn(`Season Close scheduling failed for ${season.userId}:`, err)
        );
      }
    }
  }

  private async onSprintEnd(userId: string, _seasonId: string, sprintId: string): Promise<void> {
    // Push notification — sprint complete
    await sendPushToUser(userId, pushTemplates.seasonClose()).catch(() => {});

    const [user, sprint] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { preferredCharity: { select: { name: true } }, subscriptionTier: true },
      }),
      prisma.sprint.findUnique({ where: { id: sprintId }, select: { number: true } }),
    ]);

    if (user?.preferredCharity) {
      await sendPushToUser(userId, pushTemplates.impactStory(user.preferredCharity.name)).catch(() => {});
    }

    // If user is in a Circle, create/ensure a sprint session is scheduled
    if (sprint && ['ELITE', 'CONCIERGE', 'B2B'].includes(user?.subscriptionTier ?? '')) {
      await this.scheduleCircleSprintSession(userId, sprintId, sprint.number).catch((err) =>
        logger.warn(`Circle session scheduling failed for user ${userId}:`, err)
      );
    }

    logger.info(`Sprint-end events fired for user ${userId}, sprint ${sprintId}`);
  }

  /**
   * Creates a CircleSprintSession for the user's circle if one doesn't already exist
   * for this sprint. Scheduled 3 days after sprint end (gives the group time to settle).
   */
  private async scheduleCircleSprintSession(
    userId: string,
    sprintId: string,
    sprintNumber: number,
  ): Promise<void> {
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      include: {
        circle: {
          include: {
            members: {
              where: { isActive: true },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!membership) return; // user is not in a circle

    const circleId = membership.circle.id;

    // Idempotent — only create if no session exists for this sprint
    const existing = await prisma.circleSprintSession.findFirst({
      where: { circleId, sprintNumber },
    });
    if (existing) return;

    const participantIds = membership.circle.members.map((m) => m.userId);
    const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    await prisma.circleSprintSession.create({
      data: {
        circleId,
        sprintId,
        sprintNumber,
        facilitatorType: 'peer',
        scheduledAt,
        status: 'scheduled',
        participantUserIds: JSON.stringify(participantIds),
      },
    });

    // Notify all circle members
    for (const uid of participantIds) {
      await sendPushToUser(uid, {
        title: 'Circle session incoming',
        body: `Your group session for Sprint ${sprintNumber} is scheduled. Come with one win and one honest struggle.`,
        url: '/seasons',
      }).catch(() => {});
    }

    logger.info(`Circle sprint session scheduled for circle ${circleId}, sprint ${sprintNumber}`);
  }

  private async onSeasonEnd(userId: string, seasonId: string): Promise<void> {
    // Lazy-import to avoid circular dependency
    const callService = (await import('./call.service')).default;

    // Schedule Season Close call in 1 hour (gives user time to prepare)
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    await callService.scheduleCall(userId, 'SEASON_CLOSE', scheduledAt, { seasonId });

    // Push notification
    await sendPushToUser(userId, pushTemplates.seasonClose()).catch(() => {});

    logger.info(`Season Close call scheduled for user ${userId}, season ${seasonId}`);
  }

  async startNextSeason(userId: string, goal?: string): Promise<any> {
    const lastSeason = await prisma.season.findFirst({
      where: { userId },
      orderBy: { number: 'desc' },
    });

    // Mark current as CLOSED
    if (lastSeason && lastSeason.status === 'CLOSING') {
      await prisma.season.update({
        where: { id: lastSeason.id },
        data: { status: 'CLOSED' },
      });
    }

    // New season starts where the last one ended (or now)
    const startDate = lastSeason?.endDate
      ? new Date(lastSeason.endDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date();

    return this.createSeason(userId, {
      goal: goal || 'Build consistent habits this season',
      startDate,
    });
  }
}

export default new SeasonService();
