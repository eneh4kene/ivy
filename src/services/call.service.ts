import prisma from '../utils/prisma';
import { callScheduleQueue } from '../config/queues';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { parseISO, addMinutes, isBefore } from 'date-fns';

export type CallType = 'MORNING_PLANNING' | 'EVENING_REVIEW' | 'RESCUE' | 'WEEKLY_PLANNING' | 'MONTHLY_CHECKIN' | 'ONBOARDING';

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
        contextSnapshot: contextData ? JSON.stringify(contextData) : null,
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
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
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
   * Get user context for call (stats, goals, etc.)
   */
  async getUserContext(userId: string): Promise<Record<string, any>> {
    const [user, streak, workoutsThisWeek, donations] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferredCharity: true,
        },
      }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.workout.count({
        where: {
          userId,
          status: { in: ['COMPLETED', 'PARTIAL'] },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.donation.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    return {
      name: user?.firstName,
      track: user?.track,
      goal: user?.goal,
      minimumMode: user?.minimumMode,
      giftFrame: user?.giftFrame,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      workoutsThisWeek,
      totalDonated: Number(donations._sum.amount || 0),
      charity: user?.preferredCharity?.name,
      charityImpact: user?.preferredCharity?.impactMetric,
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
