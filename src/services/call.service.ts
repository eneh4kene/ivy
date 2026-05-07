import prisma from '../utils/prisma';
import { callScheduleQueue } from '../config/queues';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { addMinutes, isBefore, differenceInDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import seasonService from './season.service';
import circleService from './circle.service';

export type CallType = 'MORNING_PLANNING' | 'EVENING_REVIEW' | 'RESCUE' | 'WEEKLY_PLANNING' | 'MONTHLY_CHECKIN' | 'ONBOARDING' | 'SEASON_CLOSE';

class CallService {
  /**
   * Schedule a call for a user
   */
  async scheduleCall(
    userId: string,
    callType: CallType,
    scheduledAt: Date,
    contextData?: Record<string, any>
  ) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        phone: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundError('User not found or inactive');
    }

    if (!user.phone) {
      throw new Error('User has no phone number');
    }

    // Create call record in database
    const call = await prisma.call.create({
      data: {
        userId,
        callType,
        scheduledAt,
        status: 'SCHEDULED',
        contextSnapshot: contextData ? JSON.stringify(contextData) : undefined,
      },
    });

    // Schedule the call job in Bull queue
    const delay = scheduledAt.getTime() - Date.now();

    if (delay > 0) {
      await callScheduleQueue.add(
        'initiate-call',
        {
          callId: call.id,
          userId,
          callType,
          phone: user.phone,
          userName: user.firstName,
          contextData,
        },
        {
          delay,
          jobId: call.id, // Use call ID as job ID for easy tracking
        }
      );

      logger.info(`Call scheduled: ${call.id} for user ${userId} at ${scheduledAt}`);
    } else {
      logger.warn(`Call ${call.id} scheduled in the past, adding to queue immediately`);
      await callScheduleQueue.add('initiate-call', {
        callId: call.id,
        userId,
        callType,
        phone: user.phone,
        userName: user.firstName,
        contextData,
      });
    }

    return call;
  }

  /**
   * Schedule daily calls for a user (morning and evening)
   */
  async scheduleDailyCalls(userId: string, date: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        morningCallTime: true,
        eveningCallTime: true,
        timezone: true,
        preferredDays: true,
        callFrequency: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Respect preferred call days if set
    if (user.preferredDays) {
      const preferredDays: string[] = JSON.parse(user.preferredDays);
      if (preferredDays.length > 0) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (!preferredDays.includes(dayName)) {
          return [];
        }
      }
    }

    const calls = [];

    // Schedule morning call
    if (user.morningCallTime) {
      const [hours, minutes] = user.morningCallTime.split(':').map(Number);
      const morningTime = new Date(date);
      morningTime.setHours(hours, minutes, 0, 0);

      if (isBefore(new Date(), morningTime)) {
        const morningCall = await this.scheduleCall(
          userId,
          'MORNING_PLANNING',
          morningTime,
          await this.getUserContext(userId)
        );
        calls.push(morningCall);
      }
    }

    // Schedule evening call
    if (user.eveningCallTime) {
      const [hours, minutes] = user.eveningCallTime.split(':').map(Number);
      const eveningTime = new Date(date);
      eveningTime.setHours(hours, minutes, 0, 0);

      if (isBefore(new Date(), eveningTime)) {
        const eveningCall = await this.scheduleCall(
          userId,
          'EVENING_REVIEW',
          eveningTime,
          await this.getUserContext(userId)
        );
        calls.push(eveningCall);
      }
    }

    return calls;
  }

  /**
   * Get user context for call — keys match {{variable_name}} placeholders in the Retell prompt.
   */
  async getUserContext(userId: string): Promise<Record<string, any>> {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      user, streak,
      workoutsThisWeek, workoutsThisMonth, totalWorkouts,
      donations, todaysWorkout, impactWallet,
      firstScore, latestScore, recentLifeMarkers,
      completedCallCount,
      activeSeason, currentSprint, circleContext,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { preferredCharity: true, company: { select: { name: true } } },
      }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.workout.count({ where: { userId, status: { in: ['COMPLETED', 'PARTIAL'] }, createdAt: { gte: weekAgo } } }),
      prisma.workout.count({ where: { userId, status: { in: ['COMPLETED', 'PARTIAL'] }, createdAt: { gte: startOfMonth(now) } } }),
      prisma.workout.count({ where: { userId, status: { in: ['COMPLETED', 'PARTIAL'] } } }),
      prisma.donation.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.workout.findFirst({
        where: { userId, status: 'PLANNED', plannedDate: { gte: startOfDay(now), lte: endOfDay(now) } },
        orderBy: { plannedDate: 'asc' },
      }),
      prisma.impactWallet.findUnique({ where: { userId } }),
      prisma.transformationScore.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.transformationScore.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.lifeMarker.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 3 }),
      prisma.call.count({ where: { userId, status: 'COMPLETED' } }),
      seasonService.getActiveSeason(userId),
      seasonService.getCurrentSprint(userId),
      circleService.getCircleContextForUser(userId),
    ]);

    const daysLeftInSprint = currentSprint
      ? Math.max(0, differenceInDays(currentSprint.endDate, now))
      : null;

    const onboardedAt = user?.onboardedAt ?? user?.createdAt;
    const weeks_in_program = onboardedAt
      ? Math.floor(differenceInDays(now, onboardedAt) / 7)
      : 0;

    const donationAmounts: Record<string, number> = { FREE: 1.0, PRO: 1.0, ELITE: 1.5, CONCIERGE: 2.0, B2B: 1.0 };
    const donation_amount = donationAmounts[user?.subscriptionTier ?? 'PRO'] ?? 1.0;

    const days_since_workout = streak?.lastWorkoutDate
      ? differenceInDays(now, new Date(streak.lastWorkoutDate))
      : null;

    const days_since_last_interaction = user?.lastCallAt
      ? differenceInDays(now, new Date(user.lastCallAt))
      : null;

    const preferred_days = (() => {
      try { return user?.preferredDays ? (JSON.parse(user.preferredDays) as string[]).join(', ') : null; }
      catch { return null; }
    })();

    const recent_life_markers = recentLifeMarkers.map((m) => m.marker).join(' | ') || null;

    return {
      // Identity
      user_name: user?.firstName,
      subscription_tier: user?.subscriptionTier,
      track: user?.track,
      weekly_goal: user?.callFrequency ?? 3,
      charity_name: user?.preferredCharity?.name ?? null,
      monthly_wallet: Number(impactWallet?.monthlyLimit ?? 0),
      donation_amount,

      // Personal context
      minimum_action: user?.minimumMode ?? null,
      gift_frame: user?.giftFrame ?? null,
      why_started: user?.goal ?? null,
      goal: user?.goal ?? null,
      comm_preference: user?.commStyle ?? null,

      // Schedule
      morning_window: user?.morningCallTime ?? null,
      evening_window: user?.eveningCallTime ?? null,
      preferred_days,
      calendar_connected: user?.googleCalendarConnected || user?.outlookCalendarConnected || false,
      missed_call_recovery: ['ELITE', 'CONCIERGE'].includes(user?.subscriptionTier ?? ''),
      calls_per_week: user?.callFrequency ?? 2,

      // Stats
      current_streak: streak?.currentStreak ?? 0,
      longest_streak: streak?.longestStreak ?? 0,
      workouts_this_week: workoutsThisWeek,
      workouts_this_month: workoutsThisMonth,
      total_workouts: totalWorkouts,
      total_donated: Number(donations._sum.amount ?? 0),
      weeks_in_program,

      // Transformation
      start_energy: firstScore?.energyScore ?? null,
      current_energy: latestScore?.energyScore ?? null,
      start_mood: firstScore?.moodScore ?? null,
      current_mood: latestScore?.moodScore ?? null,
      start_confidence: firstScore?.healthConfidence ?? null,
      current_confidence: latestScore?.healthConfidence ?? null,
      recent_life_markers,

      // Today's context (call_type added by processor)
      todays_plan: todaysWorkout?.activity ?? null,
      workout_time: todaysWorkout?.plannedTime ?? null,
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
      days_since_workout,
      previous_streak: streak?.longestStreak ?? 0,

      // Flags
      is_first_call: completedCallCount === 0,
      is_first_week_of_month: now.getDate() <= 7,
      is_quarterly_milestone: [12, 24, 36, 48].includes(weeks_in_program),
      days_since_last_interaction,
      user_status: 'active',

      // Season / Sprint
      season_number: activeSeason?.number ?? null,
      season_goal: activeSeason?.goal ?? null,
      sprint_number: currentSprint?.number ?? null,
      days_left_in_sprint: daysLeftInSprint,

      // Circle
      circle_name: circleContext?.circleName ?? null,
      circle_season_theme: circleContext?.seasonTheme ?? null,
      circle_sprint_pledge: circleContext?.sprintPledge ?? null,
      circle_consistency_rate: circleContext?.groupConsistencyRate ?? null,

      // B2B
      company_wellness_theme: circleContext?.companyWellnessTheme ?? null,
      company_wellness_goal: circleContext?.companyWellnessGoal ?? null,
    };
  }

  /**
   * Update call status
   */
  async updateCallStatus(
    callId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'NO_ANSWER' | 'FAILED' | 'CANCELLED',
    data?: {
      startedAt?: Date;
      endedAt?: Date;
      duration?: number;
      outcome?: string;
      sentiment?: string;
      transcript?: string;
      retellCallId?: string;
    }
  ) {
    const call = await prisma.call.update({
      where: { id: callId },
      data: {
        status,
        ...data,
      },
    });

    logger.info(`Call ${callId} updated to status: ${status}`);

    return call;
  }

  /**
   * Handle missed call - schedule retry
   */
  async handleMissedCall(callId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { user: true },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    // Update call status
    await this.updateCallStatus(callId, 'NO_ANSWER', {
      outcome: 'no_answer',
    });

    // Schedule retry in 15 minutes
    const retryTime = addMinutes(new Date(), 15);

    logger.info(`Scheduling retry call for user ${call.userId} at ${retryTime}`);

    return this.scheduleCall(
      call.userId,
      call.callType as CallType,
      retryTime,
      call.contextSnapshot ? JSON.parse(call.contextSnapshot as string) : undefined
    );
  }

  /**
   * Cancel a scheduled call
   */
  async cancelCall(callId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    // Remove from queue
    const job = await callScheduleQueue.getJob(callId);
    if (job) {
      await job.remove();
    }

    // Update call status
    await this.updateCallStatus(callId, 'CANCELLED');

    logger.info(`Call ${callId} cancelled`);

    return call;
  }

  /**
   * Get user's scheduled calls
   */
  async getUserCalls(userId: string, limit = 20) {
    return prisma.call.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get calls for user with pagination
   */
  async getCallsForUser(userId: string, limit = 20, offset = 0) {
    return prisma.call.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get upcoming scheduled calls for a specific user
   */
  async getUpcomingCallsForUser(userId: string) {
    return prisma.call.findMany({
      where: {
        userId,
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Schedule a rescue call for user (in 2 minutes)
   */
  async scheduleRescueCall(userId: string) {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
    return this.scheduleCall(userId, 'RESCUE', scheduledAt);
  }

  /**
   * Get call by ID
   */
  async getCallById(callId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    return call;
  }

  /**
   * Get upcoming calls (for monitoring/dashboard)
   */
  async getUpcomingCalls(limit = 50) {
    return prisma.call.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(),
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
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
  }
}

export default new CallService();
