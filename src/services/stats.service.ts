import prisma from '../utils/prisma';
import {
  CreateTransformationScoreInput,
  GetTransformationScoresQueryInput,
  CreateLifeMarkerInput,
  GetLifeMarkersQueryInput,
} from '../types/stats.schema';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { startOfWeek, startOfMonth, differenceInWeeks, differenceInMonths } from 'date-fns';

class StatsService {
  /**
   * Get user's current streak
   */
  async getStreak(userId: string) {
    const streak = await prisma.streak.findUnique({
      where: { userId },
    });

    if (!streak) {
      throw new NotFoundError('Streak not found');
    }

    return {
      currentStreak: streak.currentStreak,
      currentStreakStart: streak.currentStreakStart,
      longestStreak: streak.longestStreak,
      longestStreakStart: streak.longestStreakStart,
      longestStreakEnd: streak.longestStreakEnd,
      lastWorkoutDate: streak.lastWorkoutDate,
      bonuses: {
        sevenDayClaimed: streak.bonus7DayClaimed,
        thirtyDayClaimed: streak.bonus30DayClaimed,
        ninetyDayClaimed: streak.bonus90DayClaimed,
      },
    };
  }

  /**
   * Get comprehensive user statistics
   */
  async getUserStats(userId: string) {
    const [user, streak, workoutStats, donationStats, impactWallet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          track: true,
          goal: true,
          subscriptionTier: true,
          createdAt: true,
          onboardedAt: true,
        },
      }),
      prisma.streak.findUnique({ where: { userId } }),
      this.getWorkoutStats(userId),
      this.getDonationSummary(userId),
      prisma.impactWallet.findUnique({ where: { userId } }),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Calculate days since joined
    const daysSinceJoined = user.onboardedAt
      ? Math.floor((Date.now() - new Date(user.onboardedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        track: user.track,
        goal: user.goal,
        tier: user.subscriptionTier,
        daysSinceJoined,
      },
      streak: {
        current: streak?.currentStreak || 0,
        longest: streak?.longestStreak || 0,
        lastWorkout: streak?.lastWorkoutDate,
      },
      workouts: workoutStats,
      donations: {
        lifetimeTotal: Number(impactWallet?.lifetimeDonated || 0),
        currentMonth: Number(impactWallet?.currentMonthSpent || 0),
        count: donationStats.count,
      },
      impact: {
        monthlyLimit: Number(impactWallet?.monthlyLimit || 0),
        dailyCap: Number(impactWallet?.dailyCap || 0),
        remaining: Number(impactWallet?.monthlyLimit || 0) - Number(impactWallet?.currentMonthSpent || 0),
      },
    };
  }

  /**
   * Get workout statistics
   */
  private async getWorkoutStats(userId: string) {
    const [total, thisWeek, thisMonth, completionRate] = await Promise.all([
      prisma.workout.count({ where: { userId } }),
      prisma.workout.count({
        where: {
          userId,
          plannedDate: { gte: startOfWeek(new Date()) },
        },
      }),
      prisma.workout.count({
        where: {
          userId,
          plannedDate: { gte: startOfMonth(new Date()) },
        },
      }),
      this.calculateCompletionRate(userId),
    ]);

    const statusBreakdown = await prisma.workout.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    return {
      total,
      thisWeek,
      thisMonth,
      completionRate,
      byStatus: statusBreakdown.map((item) => ({
        status: item.status,
        count: item._count,
      })),
    };
  }

  /**
   * Calculate workout completion rate
   */
  private async calculateCompletionRate(userId: string): Promise<number> {
    const workouts = await prisma.workout.findMany({
      where: { userId },
      select: { status: true },
    });

    if (workouts.length === 0) return 0;

    const completed = workouts.filter(
      (w) => w.status === 'COMPLETED' || w.status === 'PARTIAL'
    ).length;

    return Math.round((completed / workouts.length) * 100);
  }

  /**
   * Get donation summary
   */
  private async getDonationSummary(userId: string) {
    const donations = await prisma.donation.aggregate({
      where: { userId },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total: Number(donations._sum.amount || 0),
      count: donations._count,
    };
  }

  /**
   * Create transformation score
   */
  async createTransformationScore(userId: string, data: CreateTransformationScoreInput) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Calculate week number since user started
    const weekNumber = user.onboardedAt
      ? differenceInWeeks(new Date(), new Date(user.onboardedAt)) + 1
      : 1;

    const score = await prisma.transformationScore.create({
      data: {
        userId,
        energyScore: data.energyScore,
        moodScore: data.moodScore,
        healthConfidence: data.healthConfidence,
        notes: data.notes,
        weekNumber,
      },
    });

    logger.info(`Transformation score created for user ${userId}: Week ${weekNumber}`);

    return score;
  }

  /**
   * Get transformation scores
   */
  async getTransformationScores(userId: string, query: GetTransformationScoresQueryInput) {
    const { startDate, endDate, limit = 50 } = query;

    const where: any = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const scores = await prisma.transformationScore.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Calculate trends
    const trends = this.calculateTransformationTrends(scores);

    return {
      scores,
      trends,
    };
  }

  /**
   * Calculate transformation trends
   */
  private calculateTransformationTrends(scores: any[]) {
    if (scores.length < 2) {
      return {
        energy: { change: 0, direction: 'stable' },
        mood: { change: 0, direction: 'stable' },
        healthConfidence: { change: 0, direction: 'stable' },
      };
    }

    const latest = scores[0];
    const earliest = scores[scores.length - 1];

    const calculateChange = (latestVal: number | null, earliestVal: number | null) => {
      if (latestVal === null || earliestVal === null) return { change: 0, direction: 'stable' };
      const change = latestVal - earliestVal;
      return {
        change: Math.abs(change),
        direction: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
      };
    };

    return {
      energy: calculateChange(latest.energyScore, earliest.energyScore),
      mood: calculateChange(latest.moodScore, earliest.moodScore),
      healthConfidence: calculateChange(latest.healthConfidence, earliest.healthConfidence),
    };
  }

  /**
   * Get latest transformation scores (most recent one)
   */
  async getLatestTransformationScore(userId: string) {
    const score = await prisma.transformationScore.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return score;
  }

  /**
   * Create life marker
   */
  async createLifeMarker(userId: string, data: CreateLifeMarkerInput) {
    const marker = await prisma.lifeMarker.create({
      data: {
        userId,
        marker: data.marker,
        category: data.category,
        significance: data.significance,
      },
    });

    logger.info(`Life marker created for user ${userId}: ${data.category} - ${data.significance}`);

    return marker;
  }

  /**
   * Get life markers
   */
  async getLifeMarkers(userId: string, query: GetLifeMarkersQueryInput) {
    const { category, significance, startDate, endDate, page = 1, limit = 20 } = query;

    const where: any = { userId };

    if (category) {
      where.category = category;
    }

    if (significance) {
      where.significance = significance;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [markers, total] = await Promise.all([
      prisma.lifeMarker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lifeMarker.count({ where }),
    ]);

    // Get category breakdown
    const categoryBreakdown = await prisma.lifeMarker.groupBy({
      by: ['category'],
      where: { userId },
      _count: true,
    });

    return {
      markers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      breakdown: {
        byCategory: categoryBreakdown.map((item) => ({
          category: item.category,
          count: item._count,
        })),
      },
    };
  }

  /**
   * Get weekly summary for a user
   */
  async getWeeklySummary(userId: string) {
    const weekStart = startOfWeek(new Date());

    const [workouts, donations, transformationScore] = await Promise.all([
      prisma.workout.findMany({
        where: {
          userId,
          plannedDate: { gte: weekStart },
        },
        orderBy: { plannedDate: 'asc' },
      }),
      prisma.donation.findMany({
        where: {
          userId,
          createdAt: { gte: weekStart },
        },
      }),
      prisma.transformationScore.findFirst({
        where: {
          userId,
          createdAt: { gte: weekStart },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const completedWorkouts = workouts.filter(
      (w) => w.status === 'COMPLETED' || w.status === 'PARTIAL'
    ).length;

    const totalDonated = donations.reduce((sum, d) => sum + Number(d.amount), 0);

    return {
      week: {
        start: weekStart,
        end: new Date(),
      },
      workouts: {
        planned: workouts.length,
        completed: completedWorkouts,
        rate: workouts.length > 0 ? Math.round((completedWorkouts / workouts.length) * 100) : 0,
      },
      donations: {
        total: totalDonated,
        count: donations.length,
      },
      transformation: transformationScore
        ? {
            energy: transformationScore.energyScore,
            mood: transformationScore.moodScore,
            healthConfidence: transformationScore.healthConfidence,
          }
        : null,
    };
  }

  /**
   * Get monthly summary for a user
   */
  async getMonthlySummary(userId: string) {
    const monthStart = startOfMonth(new Date());

    const [workouts, donations, streak, lifeMarkers] = await Promise.all([
      prisma.workout.findMany({
        where: {
          userId,
          plannedDate: { gte: monthStart },
        },
      }),
      prisma.donation.aggregate({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.lifeMarker.count({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    const completedWorkouts = workouts.filter(
      (w) => w.status === 'COMPLETED' || w.status === 'PARTIAL'
    ).length;

    return {
      month: {
        start: monthStart,
        end: new Date(),
      },
      workouts: {
        planned: workouts.length,
        completed: completedWorkouts,
        rate: workouts.length > 0 ? Math.round((completedWorkouts / workouts.length) * 100) : 0,
      },
      donations: {
        total: Number(donations._sum.amount || 0),
        count: donations._count,
      },
      streak: {
        current: streak?.currentStreak || 0,
        longest: streak?.longestStreak || 0,
      },
      lifeMarkers: {
        count: lifeMarkers,
      },
    };
  }
}

export default new StatsService();
