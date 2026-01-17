import prisma from '../utils/prisma';
import { CreateWorkoutInput, UpdateWorkoutInput, CompleteWorkoutInput, GetWorkoutsQueryInput } from '../types/workout.schema';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { startOfDay, endOfDay, differenceInDays, parseISO } from 'date-fns';

class WorkoutService {
  /**
   * Create a new workout plan
   */
  async createWorkout(userId: string, data: CreateWorkoutInput) {
    const workout = await prisma.workout.create({
      data: {
        userId,
        plannedDate: new Date(data.plannedDate),
        plannedTime: data.plannedTime,
        activity: data.activity,
        duration: data.duration,
        isMinimum: data.isMinimum || false,
        status: 'PLANNED',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info(`Workout created: ${workout.id} for user ${userId}`);

    return workout;
  }

  /**
   * Get workout by ID
   */
  async getWorkoutById(workoutId: string, userId?: string) {
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!workout) {
      throw new NotFoundError('Workout not found');
    }

    // If userId provided, ensure workout belongs to user
    if (userId && workout.userId !== userId) {
      throw new BadRequestError('Workout does not belong to user');
    }

    return workout;
  }

  /**
   * Get user's workouts with filtering
   */
  async getUserWorkouts(userId: string, query: GetWorkoutsQueryInput) {
    const { status, startDate, endDate, page = 1, limit = 20 } = query;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.plannedDate = {};
      if (startDate) {
        where.plannedDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.plannedDate.lte = new Date(endDate);
      }
    }

    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where,
        orderBy: { plannedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workout.count({ where }),
    ]);

    return {
      workouts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update workout
   */
  async updateWorkout(workoutId: string, userId: string, data: UpdateWorkoutInput) {
    // Verify ownership
    await this.getWorkoutById(workoutId, userId);

    const updateData: any = {};

    if (data.plannedDate) updateData.plannedDate = new Date(data.plannedDate);
    if (data.plannedTime) updateData.plannedTime = data.plannedTime;
    if (data.activity) updateData.activity = data.activity;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.status) updateData.status = data.status;
    if (data.skippedReason) updateData.skippedReason = data.skippedReason;

    const workout = await prisma.workout.update({
      where: { id: workoutId },
      data: updateData,
    });

    logger.info(`Workout updated: ${workout.id}`);

    return workout;
  }

  /**
   * Complete workout and update streak
   */
  async completeWorkout(workoutId: string, userId: string, data: CompleteWorkoutInput) {
    // Verify ownership
    const workout = await this.getWorkoutById(workoutId, userId);

    // Update workout status
    const updatedWorkout = await prisma.workout.update({
      where: { id: workoutId },
      data: {
        status: data.status,
        completedAt: data.status === 'COMPLETED' || data.status === 'PARTIAL' ? new Date() : undefined,
        skippedReason: data.skippedReason,
      },
    });

    // Update streak if completed or partial
    if (data.status === 'COMPLETED' || data.status === 'PARTIAL') {
      await this.updateStreak(userId, new Date(workout.plannedDate));
    } else if (data.status === 'SKIPPED') {
      // Reset streak on skip
      await this.resetStreak(userId);
    }

    logger.info(`Workout completed: ${workoutId} with status ${data.status}`);

    return updatedWorkout;
  }

  /**
   * Update user's streak
   */
  private async updateStreak(userId: string, workoutDate: Date) {
    const streak = await prisma.streak.findUnique({
      where: { userId },
    });

    if (!streak) {
      // Create new streak if doesn't exist
      await prisma.streak.create({
        data: {
          userId,
          currentStreak: 1,
          currentStreakStart: workoutDate,
          longestStreak: 1,
          longestStreakStart: workoutDate,
          lastWorkoutDate: workoutDate,
        },
      });
      return;
    }

    const today = startOfDay(new Date());
    const lastWorkout = streak.lastWorkoutDate ? startOfDay(new Date(streak.lastWorkoutDate)) : null;

    let newStreak = streak.currentStreak;

    if (!lastWorkout) {
      // First workout ever
      newStreak = 1;
    } else {
      const daysSinceLastWorkout = differenceInDays(today, lastWorkout);

      if (daysSinceLastWorkout === 0) {
        // Same day workout, don't increment
        newStreak = streak.currentStreak;
      } else if (daysSinceLastWorkout === 1) {
        // Consecutive day
        newStreak = streak.currentStreak + 1;
      } else {
        // Streak broken, start over
        newStreak = 1;
      }
    }

    // Check if this is a new longest streak
    const isNewLongest = newStreak > streak.longestStreak;

    await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        currentStreakStart: newStreak === 1 ? workoutDate : streak.currentStreakStart,
        longestStreak: isNewLongest ? newStreak : streak.longestStreak,
        longestStreakStart: isNewLongest ? streak.currentStreakStart : streak.longestStreakStart,
        longestStreakEnd: isNewLongest ? undefined : streak.longestStreakEnd,
        lastWorkoutDate: workoutDate,
      },
    });

    logger.info(`Streak updated for user ${userId}: ${newStreak} days`);

    // Check for streak bonuses
    await this.checkStreakBonuses(userId, newStreak);
  }

  /**
   * Reset user's streak
   */
  private async resetStreak(userId: string) {
    const streak = await prisma.streak.findUnique({
      where: { userId },
    });

    if (!streak) return;

    await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: 0,
        currentStreakStart: null,
      },
    });

    logger.info(`Streak reset for user ${userId}`);
  }

  /**
   * Check and award streak bonuses
   */
  private async checkStreakBonuses(userId: string, currentStreak: number) {
    const streak = await prisma.streak.findUnique({
      where: { userId },
    });

    if (!streak) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferredCharity: true },
    });

    if (!user || !user.preferredCharity) return;

    // 7-day streak bonus
    if (currentStreak === 7 && !streak.bonus7DayClaimed) {
      await this.awardStreakBonus(userId, user.preferredCharity.id, 3, 'STREAK_7_DAY', 7);
      await prisma.streak.update({
        where: { userId },
        data: { bonus7DayClaimed: true },
      });
    }

    // 30-day streak bonus
    if (currentStreak === 30 && !streak.bonus30DayClaimed) {
      await this.awardStreakBonus(userId, user.preferredCharity.id, 10, 'STREAK_30_DAY', 30);
      await prisma.streak.update({
        where: { userId },
        data: { bonus30DayClaimed: true },
      });
    }

    // 90-day streak bonus
    if (currentStreak === 90 && !streak.bonus90DayClaimed) {
      await this.awardStreakBonus(userId, user.preferredCharity.id, 25, 'STREAK_90_DAY', 90);
      await prisma.streak.update({
        where: { userId },
        data: { bonus90DayClaimed: true },
      });
    }
  }

  /**
   * Award streak bonus donation
   */
  private async awardStreakBonus(
    userId: string,
    charityId: string,
    amount: number,
    type: 'STREAK_7_DAY' | 'STREAK_30_DAY' | 'STREAK_90_DAY',
    streakDays: number
  ) {
    await prisma.donation.create({
      data: {
        userId,
        charityId,
        amount,
        currency: 'GBP',
        donationType: type,
        streakDays,
      },
    });

    logger.info(`Streak bonus awarded: ${amount} GBP for ${streakDays}-day streak`);
  }

  /**
   * Delete workout
   */
  async deleteWorkout(workoutId: string, userId: string) {
    // Verify ownership
    await this.getWorkoutById(workoutId, userId);

    await prisma.workout.delete({
      where: { id: workoutId },
    });

    logger.info(`Workout deleted: ${workoutId}`);
  }
}

export default new WorkoutService();
