import prisma from '../utils/prisma';
import { callScheduleQueue } from '../config/queues';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { addMinutes, isBefore, differenceInDays, startOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
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
   * Pass callType to include memory layers (Layer 1 within-day, Layer 2 rolling recent, Layer 3 long-term).
   */
  async getUserContext(userId: string, callType?: string): Promise<Record<string, any>> {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      user, streak,
      workoutsThisWeek, workoutsThisMonth, totalWorkouts,
      donations, todaysWorkout, todaysOutcome, impactWallet,
      firstScore, latestScore, recentLifeMarkers,
      completedCallCount, buddy,
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
      // Today's PLANNED workout — used for morning call context
      prisma.workout.findFirst({
        where: { userId, status: 'PLANNED', plannedDate: { gte: startOfDay(now), lte: endOfDay(now) } },
        orderBy: { plannedDate: 'asc' },
      }),
      // Today's most recent outcome — used for evening call sub-typing (completed/partial/missed)
      prisma.workout.findFirst({
        where: { userId, plannedDate: { gte: startOfDay(now), lte: endOfDay(now) } },
        orderBy: { updatedAt: 'desc' },
        select: { status: true },
      }),
      prisma.impactWallet.findUnique({ where: { userId } }),
      prisma.transformationScore.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.transformationScore.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.lifeMarker.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 3 }),
      prisma.call.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.accountabilityBuddy.findUnique({ where: { userId }, select: { buddyName: true } }),
      seasonService.getActiveSeason(userId),
      seasonService.getCurrentSprint(userId),
      circleService.getCircleContextForUser(userId),
    ]);

    const daysLeftInSprint = currentSprint
      ? Math.max(0, differenceInDays(currentSprint.endDate, now))
      : null;

    // ── Memory layers (only fetched when callType is provided) ──────────────────
    let morning_context: string | null = null;
    let last_evening_context: string | null = null;
    let recent_calls: string | null = null;
    let long_term_memories: string | null = null;

    if (callType) {
      const [morningCall, eveningCall, recentSummaries, ltMemories] = await Promise.all([
        // Layer 1a: for EVENING_REVIEW — what was planned this morning?
        callType === 'EVENING_REVIEW'
          ? prisma.call.findFirst({
              where: {
                userId, callType: 'MORNING_PLANNING',
                NOT: { callSummary: null },
                scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
              },
              orderBy: { scheduledAt: 'desc' },
              select: { callSummary: true },
            })
          : Promise.resolve(null),

        // Layer 1b: for MORNING_PLANNING — what happened last night?
        callType === 'MORNING_PLANNING'
          ? prisma.call.findFirst({
              where: {
                userId, callType: 'EVENING_REVIEW',
                NOT: { callSummary: null },
                scheduledAt: { gte: subDays(now, 2) },
              },
              orderBy: { scheduledAt: 'desc' },
              select: { callSummary: true },
            })
          : Promise.resolve(null),

        // Layer 2: rolling recent — last 4 completed or missed calls with summaries
        // NO_ANSWER calls are included so the brief knows if this is a retry
        prisma.call.findMany({
          where: { userId, status: { in: ['COMPLETED', 'NO_ANSWER'] }, NOT: { callSummary: null } },
          orderBy: { scheduledAt: 'desc' },
          take: 4,
          select: { callType: true, callSummary: true, scheduledAt: true, status: true },
        }),

        // Layer 3: long-term curated memories
        prisma.callMemory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { content: true, category: true },
        }),
      ]);

      morning_context = morningCall?.callSummary ?? null;
      last_evening_context = eveningCall?.callSummary ?? null;

      if (recentSummaries.length) {
        recent_calls = recentSummaries
          .map((c) => {
            const daysAgo = differenceInDays(now, c.scheduledAt);
            const label = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
            const missed = c.status === 'NO_ANSWER' ? ' missed' : '';
            return `[${c.callType.toLowerCase()}${missed} ${label}]: "${c.callSummary}"`;
          })
          .join('\n');
      }

      if (ltMemories.length) {
        long_term_memories = ltMemories
          .map((m) => `${m.category}: ${m.content}`)
          .join('\n');
      }
    }
    // ────────────────────────────────────────────────────────────────────────────

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
      track_detail: user?.trackDetail ?? null, // personal specificity — Ivy uses this in conversation
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
      todays_workout_status: todaysOutcome?.status ?? null,  // used for evening sub-typing
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
      season_type: activeSeason?.seasonType ?? 'standard',
      sprint_number: currentSprint?.number ?? null,
      days_left_in_sprint: daysLeftInSprint,

      // Accountability buddy
      buddy_name: buddy?.buddyName ?? null,
      buddy_reply: null, // placeholder — populated when buddy reply inbound feature is built

      // Circle
      circle_name: circleContext?.circleName ?? null,
      circle_season_theme: circleContext?.seasonTheme ?? null,
      circle_sprint_pledge: circleContext?.sprintPledge ?? null,
      circle_consistency_rate: circleContext?.groupConsistencyRate ?? null,

      // B2B
      company_wellness_theme: circleContext?.companyWellnessTheme ?? null,
      company_wellness_goal: circleContext?.companyWellnessGoal ?? null,

      // Memory layers (populated when callType is provided — see three-layer memory design)
      morning_context,        // Layer 1: today's morning call summary (for EVENING_REVIEW)
      last_evening_context,   // Layer 1: last evening call summary (for MORNING_PLANNING)
      recent_calls,           // Layer 2: last 4 call summaries as rolling narrative
      long_term_memories,     // Layer 3: curated memorable facts about this person

      // Behavioural intelligence (from insight.service — null until enough calls exist)
      inferred_patterns: (user?.inferredProfile as any)?.inferred_patterns ?? null,
      notable_observation: (user?.inferredProfile as any)?.notable_observation ?? null,
      probe_for_specificity: (user?.inferredProfile as any)?.probe_for_specificity ?? false,
      most_effective_nudge: (user?.inferredProfile as any)?.most_effective_nudge ?? null,
      high_risk_signals: (user?.inferredProfile as any)?.high_risk_signals ?? [],
      preferred_register: (user?.inferredProfile as any)?.preferred_register ?? null,
      behavioural_modifiers: (user?.inferredProfile as any)?.behavioural_modifiers ?? null,

      // Communication preference (learned from call answer rate + explicit signals)
      call_answer_rate: (user?.inferredProfile as any)?.call_answer_rate ?? null,
      contact_preference: (user?.inferredProfile as any)?.contact_preference ?? null,
      contact_pattern_note: (user?.inferredProfile as any)?.contact_pattern_note ?? null,
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

    // Update call status and write a brief summary so the retry call's brief
    // sees this miss in Layer 2 memory and can acknowledge it naturally
    const missedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    await this.updateCallStatus(callId, 'NO_ANSWER', { outcome: 'no_answer' });
    await prisma.call.update({
      where: { id: callId },
      data: { callSummary: `No answer at ${missedAt} — retry scheduled.` },
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
