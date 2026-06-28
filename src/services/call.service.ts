import prisma from '../utils/prisma';
import { inngest } from '../inngest/client';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { addMinutes, isBefore, differenceInDays, startOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import seasonService from './season.service';
import circleService from './circle.service';
import circleGameService from './circle-game.service';
import circleCatchupService from './circle-catchup.service';
import coachService from './coach.service';
import { STAKE_CONFIG, type Currency } from '../config/pricing';

export type CallType = 'MORNING_PLANNING' | 'EVENING_REVIEW' | 'RESCUE' | 'WEEKLY_PLANNING' | 'MONTHLY_CHECKIN' | 'ONBOARDING' | 'SEASON_CLOSE' | 'COACH_PONDER' | 'ARMING_CHASE';

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

    // Hard daily cap — prevents runaway billing from scheduler bugs
    const DAILY_CALL_CAP = 5;
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const callsToday = await prisma.call.count({
      where: {
        userId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ['CANCELLED', 'FAILED'] },
      },
    });
    if (callsToday >= DAILY_CALL_CAP) {
      logger.warn(`Daily call cap (${DAILY_CALL_CAP}) reached for user ${userId} — skipping ${callType}`);
      throw new Error(`Daily call cap reached for user ${userId}`);
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

    // Hand off to Inngest — `initiateCall` holds the call until scheduledAt via
    // step.sleepUntil (past-dated times fire immediately). Idempotent on callId.
    await inngest.send({
      name: 'call/scheduled',
      data: {
        callId: call.id,
        userId,
        callType,
        phone: user.phone,
        userName: user.firstName,
        contextData,
        scheduledAt: scheduledAt.toISOString(),
      },
    });

    logger.info(`Call scheduled: ${call.id} for user ${userId} at ${scheduledAt.toISOString()}`);

    return call;
  }

  /**
   * Schedule daily calls for a user (morning and evening)
   */
  async scheduleDailyCalls(userId: string, date: Date) {
    const user = (await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        morningCallTime: true,
        eveningCallTime: true,
        timezone: true,
        preferredDays: true,
        callFrequency: true,
        coachId: true, // coach clients get one call/day (morning only) to halve voice COGS
        morningCallOptIn: true, // live morning call is opt-in only; default loop is the async VN (§1c)
        commStyle: true, // TEXTS users get an evening chat check-in instead of a call
      } as any,
    })) as (null | {
      id: string; morningCallTime: string | null; eveningCallTime: string | null;
      timezone: string; preferredDays: string | null; callFrequency: number;
      coachId: string | null; morningCallOptIn: boolean; commStyle: string | null;
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Deduplication guard — skip if calls are already scheduled for today.
    // Prevents double-scheduling if the server restarts or redeploys at midnight.
    const todayStart = startOfDay(date);
    const todayEnd = endOfDay(date);
    const alreadyScheduled = await prisma.call.count({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (alreadyScheduled > 0) {
      logger.info(`Skipping scheduleDailyCalls for ${userId} — ${alreadyScheduled} call(s) already exist for today`);
      return [];
    }

    const tz = user.timezone || 'Europe/London';

    // Respect preferred call days — evaluated in the user's timezone
    if (user.preferredDays) {
      const preferredDays: string[] = JSON.parse(user.preferredDays);
      if (preferredDays.length > 0) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase();
        if (!preferredDays.includes(dayName)) {
          return [];
        }
      }
    }

    const now = new Date();
    const calls = [];

    // Helper: convert HH:MM in user's timezone to a UTC Date
    const toUTC = (hhmm: string): Date => {
      // en-CA gives YYYY-MM-DD — reliable across Node versions
      const localDateStr = date.toLocaleDateString('en-CA', { timeZone: tz });
      return fromZonedTime(`${localDateStr}T${hhmm}:00`, tz);
    };

    // Live morning call is OPT-IN only (§1c). Default daily loop = async morning VN (arming.service),
    // so a live MORNING_PLANNING call is scheduled only when the user explicitly opted in.
    if (user.morningCallTime && user.morningCallOptIn) {
      const morningUTC = toUTC(user.morningCallTime);
      if (isBefore(now, morningUTC)) {
        const morningCall = await this.scheduleCall(userId, 'MORNING_PLANNING', morningUTC, await this.getUserContext(userId));
        calls.push(morningCall);
      }
    }

    // Coach clients get morning only — halves voice COGS while still delivering daily accountability
    if (!user.coachId && user.eveningCallTime) {
      const eveningUTC = toUTC(user.eveningCallTime);
      if (isBefore(now, eveningUTC)) {
        if (user.commStyle === 'TEXTS') {
          // Text-preferred members get the evening ritual as a proactive chat
          // check-in rather than a call. Same cadence (gated by eveningCallTime,
          // same dedup guard), same EVENING_REVIEW context — different channel.
          // Fire-and-forget: a chat hiccup must not abort morning scheduling.
          this.scheduleEveningCheckIn(userId).catch((err) =>
            logger.warn(`Evening chat check-in failed for ${userId}:`, err),
          );
        } else {
          const eveningCall = await this.scheduleCall(userId, 'EVENING_REVIEW', eveningUTC, await this.getUserContext(userId));
          calls.push(eveningCall);
        }
      }
    }

    return calls;
  }

  /**
   * Evening chat check-in for TEXTS-preferred members — the text counterpart to
   * the EVENING_REVIEW call. Posts a proactive Ivy message built from the same
   * evening context, idempotent per local day so a re-run of the daily job never
   * double-posts. The member replies in-thread and Ivy responds with full context.
   *
   * chat.service is loaded dynamically to avoid the call↔chat import cycle (chat
   * imports callService for scheduling; both only touch each other inside methods).
   */
  async scheduleEveningCheckIn(userId: string): Promise<void> {
    const { default: chatService } = await import('./chat.service');

    const since = startOfDay(new Date());
    const existing = await prisma.message.findFirst({
      where: { userId, channel: 'IN_APP', messageType: 'evening_checkin', createdAt: { gte: since } },
      select: { id: true },
    });
    if (existing) return;

    const ctx = await this.getUserContext(userId, 'EVENING_REVIEW');
    const name = ctx.user_name ? ` ${ctx.user_name}` : '';
    await chatService.postIvyMessage(
      userId,
      `Evening${name} — how did today land? Did you get your session in, or did life get in the way? Tell me how it went.`,
      { messageType: 'evening_checkin', notify: true },
    );
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
      houseDefaultCharity,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferredCharity: true,
          dislikedCharity: true,
          company: { select: { name: true } },
        },
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
      // House-default charity for MIDDLE forfeit mode (§9 decision 5)
      prisma.charity.findFirst({ where: { isHouseDefault: true, isActive: true }, select: { name: true } }),
    ]);

    const daysLeftInSprint = currentSprint
      ? Math.max(0, differenceInDays(currentSprint.endDate, now))
      : null;

    // ── Memory layers (only fetched when callType is provided) ──────────────────
    let morning_context: string | null = null;
    let last_evening_context: string | null = null;
    let recent_calls: string | null = null;
    let long_term_memories: string | null = null;
    let recent_chat: string | null = null;

    if (callType) {
      const [morningCall, morningVN, eveningCall, recentSummaries, ltMemories, recentChatMsgs] = await Promise.all([
        // Layer 1a: for EVENING_REVIEW — the live morning-call summary (only for opt-in morning-call users)
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

        // Layer 1a (VN): for EVENING_REVIEW — today's spoken morning voice note. This is the DEFAULT
        // arming path (§1c/Phase 4): "this morning you said you'd…" comes from the VN transcript.
        callType === 'EVENING_REVIEW'
          ? prisma.voiceNote.findFirst({
              where: {
                userId,
                NOT: { transcript: null },
                recordedAt: { gte: startOfDay(now), lte: endOfDay(now) },
              },
              orderBy: { recordedAt: 'desc' },
              select: { transcript: true },
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

        // Same-day continuity: the most recent in-app chat exchange. The daily
        // batch distils chat into long-term memory overnight; this raw snippet
        // bridges the gap so a call right after a chat already knows it. Skipped
        // for the CHAT flow itself (chat already sends full thread history).
        callType !== 'CHAT'
          ? prisma.message.findMany({
              where: { userId, channel: 'IN_APP' },
              orderBy: { createdAt: 'desc' },
              take: 6,
              select: { direction: true, content: true },
            })
          : Promise.resolve([] as { direction: string; content: string }[]),
      ]);

      // Prefer the spoken morning VN (the default arming mechanic); fall back to the live morning-call summary.
      morning_context = morningVN?.transcript ?? morningCall?.callSummary ?? null;
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

      if (recentChatMsgs.length) {
        recent_chat = recentChatMsgs
          .slice()
          .reverse() // findMany was desc; show oldest → newest
          .map((m) => `${m.direction === 'INBOUND' ? 'Them' : 'You'}: ${m.content}`)
          .join('\n');
      }
    }
    // ────────────────────────────────────────────────────────────────────────────

    const onboardedAt = user?.onboardedAt ?? user?.createdAt;
    const weeks_in_program = onboardedAt
      ? Math.floor(differenceInDays(now, onboardedAt) / 7)
      : 0;

    // Phase 5: per-completion donation amount is retired (§8). donation_amount kept for
    // backward compat only — charity funding now comes from stake forfeits/corporate pool.
    const donation_amount = 1.0;

    // ── Stake context fields (product-pricing-rework.md §2 + §3) ──────────────
    // stake_weekly: the user's weekly stake amount (user-set; null if not configured)
    // stake_today: daily slice = weekly ÷ 7, rounded to 2dp
    // forfeit_destination: the charity/destination that gets the money on a miss
    //   - MIDDLE mode → house-default charity (a vetted charity the user did NOT choose)
    //   - SAVAGE mode → the charity they actively dislike
    // success_charity_name: their preferred charity (for Phase-6 corporate success donations)
    const stake_weekly = user?.stakeWeeklyAmount != null
      ? Number(user.stakeWeeklyAmount)
      : null;
    const stake_today = stake_weekly != null
      ? Math.round((stake_weekly / 7) * 100) / 100
      : null;

    // Foundation Run framing for the onboarding/first call: the flat starter
    // stake Ivy can name ("your first run is just £7"), independent of whatever
    // full weekly amount they set. is_evening_first_call lets the onboarding
    // flow open with an evening-aware greeting instead of a morning framing.
    const foundationCurrency = (user?.currency ?? 'GBP') as Currency;
    const foundation_stake = STAKE_CONFIG.foundationFlatAmount[foundationCurrency];
    const callLocalHour = (() => {
      const tz = user?.timezone || 'Europe/London';
      const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }));
      return Number.isFinite(h) ? h % 24 : 12;
    })();
    const is_evening_first_call = completedCallCount === 0 && callLocalHour >= 17;
    const forfeit_destination = (() => {
      if (!user) return null;
      if (user.forfeitMode === 'SAVAGE') {
        // Savage: the charity they actively dislike
        return (user as any).dislikedCharity?.name ?? null;
      }
      // MIDDLE (default): house charity they did NOT choose
      return houseDefaultCharity?.name ?? null;
    })();
    const success_charity_name = user?.preferredCharity?.name ?? null;

    // Season-level stake outcomes (for season_close flow) — sum from StakeCycle records
    // Query inline here to keep getUserContext self-contained; OK to be null if no cycles.
    const seasonStakeAgg = activeSeason
      ? await prisma.stakeCycle.aggregate({
          where: {
            userId,
            periodStart: { gte: activeSeason.startDate },
            periodEnd: { lte: activeSeason.endDate },
          },
          _sum: { stakeAmount: true, capturedAmount: true },
        }).catch(() => null)
      : null;
    // stake_kept = total authorized minus total captured (forfeited) for the season
    const seasonTotalAuthorized = seasonStakeAgg?._sum?.stakeAmount != null
      ? Number(seasonStakeAgg._sum.stakeAmount)
      : null;
    const seasonTotalForfeited = seasonStakeAgg?._sum?.capturedAmount != null
      ? Number(seasonStakeAgg._sum.capturedAmount)
      : null;
    const stake_kept = seasonTotalAuthorized != null && seasonTotalForfeited != null
      ? Math.round((seasonTotalAuthorized - seasonTotalForfeited) * 100) / 100
      : null;
    const stake_forfeited = seasonTotalForfeited;
    // ────────────────────────────────────────────────────────────────────────────

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
      // charity_name kept for backward compat — it is the user's PREFERRED / success charity.
      // Do NOT use this as "where the money goes on success" — Phase-6 corporate donation is not built yet.
      charity_name: user?.preferredCharity?.name ?? null,
      monthly_wallet: Number(impactWallet?.monthlyLimit ?? 0),
      donation_amount,

      // Stake commitment device (product-pricing-rework.md §2 + §3)
      // SUCCESS: stake_today is RELEASED — user KEEPS their money. Never say "goes to charity" on success.
      // MISS: stake_today FORFEITS to forfeit_destination. Mention gently; the stake IS the teeth.
      stake_weekly,                // user's weekly stake amount in £ (null if not configured)
      stake_today,                 // daily slice = stake_weekly / 7 (null if no stake)
      forfeit_destination,         // name of the charity the forfeited slice goes to on a miss
      success_charity_name,        // user's preferred charity (for Phase-6 corporate donation on success — not live yet)
      // Season-level stake outcome totals (used in season_close flow)
      stake_kept,                  // cumulative stake returned to user this season (£)
      stake_forfeited,             // cumulative stake captured/forfeited this season (£)

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
      // Phase 5: missed_call_recovery is available to all paid users (one tier).
      missed_call_recovery: ['PRO', 'ELITE', 'CONCIERGE', 'B2B', 'COACH'].includes(user?.subscriptionTier ?? ''),
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
      is_evening_first_call,       // first call AND it's evening (≥17:00 local) — onboarding flow greets accordingly
      foundation_stake,            // flat starter stake for the Foundation Run, in the user's currency

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

      // Circle game (null when no active game)
      ...((await circleGameService.getGameContextForUser(userId).catch(() => null)) ?? {
        circle_game_name: null,
        circle_game_state_summary: null,
        circle_game_ivy_instruction: null,
      }),

      // Coach context (set when user has a PT/coach)
      ...await coachService.getCoachContextForClient(userId).catch(() => ({
        coach_name: null, coach_programme: null, coach_notes: null, coach_style: null, brand_name: null, programme_areas: null,
      })),

      // Circle catch-up (set when user missed their last sprint session)
      ...await (async () => {
        const catchup = await circleCatchupService.getPendingCatchup(userId).catch(() => null);
        return catchup
          ? { missed_sprint_session: true, catchup_sprint_number: catchup.sprintNumber, catchup_group_pledge: catchup.collectivePledge, catchup_highlights: catchup.highlights }
          : { missed_sprint_session: false, catchup_sprint_number: null, catchup_group_pledge: null, catchup_highlights: null };
      })(),

      // B2B
      company_wellness_theme: circleContext?.companyWellnessTheme ?? null,
      company_wellness_goal: circleContext?.companyWellnessGoal ?? null,

      // Memory layers (populated when callType is provided — see three-layer memory design)
      morning_context,        // Layer 1: today's morning call summary (for EVENING_REVIEW)
      last_evening_context,   // Layer 1: last evening call summary (for MORNING_PLANNING)
      recent_calls,           // Layer 2: last 4 call summaries as rolling narrative
      long_term_memories,     // Layer 3: curated memorable facts about this person
      recent_chat,            // Same-day bridge: latest in-app chat exchange (non-CHAT flows)

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

    // Alert coach if client is consistently missing (non-blocking)
    coachService.checkAndAlertCoach(call.userId).catch(() => {});

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

    // Update status first, then interrupt the Inngest run if it's still sleeping
    // until its scheduled time. The status flip also guards the immediate path:
    // initiateCall re-checks status === 'SCHEDULED' before dialing.
    await this.updateCallStatus(callId, 'CANCELLED');
    await inngest.send({ name: 'call/cancelled', data: { callId } });

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

  async getCoachPonderContext(coachId: string): Promise<Record<string, any>> {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { id: true, firstName: true, subscriptionTier: true },
    });
    const ponderBrief = await coachService.generatePonderBrief(coachId);
    return {
      user_name: coach?.firstName,
      subscription_tier: coach?.subscriptionTier,
      is_coach_ponder: true,
      ponder_brief: ponderBrief,
      track: 'coach',
      call_type: 'coach_ponder',
    };
  }
}

export default new CallService();
