import prisma from '../utils/prisma';

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

    // Close seasons whose end date has passed and still ACTIVE
    await prisma.season.updateMany({
      where: { status: 'ACTIVE', endDate: { lt: now } },
      data: { status: 'CLOSING' },
    });
  }
}

export default new SeasonService();
