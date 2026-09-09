import prisma from '../utils/prisma';
import { inngest } from '../inngest/client';
import logger from '../utils/logger';
import { serverAnalytics } from '../lib/analytics';
import { NotFoundError } from '../utils/errors';
import { addMinutes, isBefore, differenceInDays, startOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import seasonService from './season.service';
import circleService from './circle.service';
import circleGameService from './circle-game.service';
import circleCatchupService from './circle-catchup.service';
import coachService from './coach.service';
import { STAKE_CONFIG, type Currency } from '../config/pricing';

/**
 * Which local weekdays a reduced cadence puts the VOICE call on.
 *
 * Sunday appears in every row and is not negotiable, because it is the last day
 * of the week: the weekly cycle opens Monday 00:05 UTC, so Sunday is where a
 * week gets closed out and the next one gets named. That holds whether or not
 * there is money involved.
 *
 * When a member DOES have a stake, Sunday is additionally the night their
 * weekly cycle settles — but stakes are optional (the teeth ladder), so that is
 * the extra reason, never the reason. A stake-less member still needs the week
 * closed; they just do not have a slice riding on it.
 *
 * The rest spread across the days follow-through actually fails on rather than
 * bunching at the start of the week — Monday motivation is free, and it is
 * Tuesday and Thursday where people quietly stop.
 *
 * Off-days are NOT silent: they get the evening chat check-in instead, so
 * reducing cadence lowers voice cost without ever dropping the daily ritual.
 */
const CADENCE_DAYS: Record<number, string[]> = {
  1: ['sunday'],
  2: ['wednesday', 'sunday'],
  3: ['tuesday', 'thursday', 'sunday'],
  4: ['monday', 'wednesday', 'friday', 'sunday'],
  5: ['monday', 'tuesday', 'wednesday', 'friday', 'sunday'],
  6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'],
};

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
        // Recorded so the variety governor has a memory. Variety only exists
        // relative to history: without this the picker would repeat itself by
        // chance and nobody could tell why.
        shape: typeof contextData?.call_shape === 'string' ? contextData.call_shape : undefined,
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
    serverAnalytics.callScheduled(
      userId,
      callType,
      Math.max(0, Math.round((scheduledAt.getTime() - Date.now()) / 60000)),
    );

    return call;
  }

  /**
   * Schedule daily calls for a user (morning and evening)
   */
  /**
   * Pick the SHAPE of this call.
   *
   * Two stages, and the order matters: ELIGIBILITY first, variety second.
   * Randomising freely would read as inconsistency rather than personality —
   * worse than sameness, because sameness at least reads as reliable. So state
   * decides what is allowed, and only then does history break the tie.
   *
   * On game state, which is the subtle part: it is NOT a shape. It is material
   * every shape can draw on, and the only material she has that is not a mirror
   * of this person's own behaviour. That is precisely why it gates `she_leads`
   * — leading with nothing external to lead WITH collapses into "let me tell
   * you about yourself", which is worse than asking. And a LIVE obligation
   * (baton in their hands, partner waiting) rules out the shapes that assume
   * there is nothing to get to.
   */
  private async pickCallShape(userId: string, callType: string, ctx: Record<string, any>): Promise<string | null> {
    // Calls with their own strong structure are left alone. Onboarding, season
    // close and coach calls are set pieces; shaping them would fight a script
    // that is deliberate.
    if (!['EVENING_REVIEW', 'MORNING_PLANNING'].includes(callType)) return null;

    const live = !!ctx.circle_game_live_obligation;
    const kept = ctx.workout_status === 'COMPLETED' || ctx.workout_status === 'PARTIAL';
    const missed = ctx.workout_status === 'MISSED' || ctx.workout_status === 'SKIPPED' || ctx.armed_today === false;
    const fragile = !!ctx.high_risk_signals || ctx.season_type === 'memorial' || !!ctx.struggle_signal;
    const hasExternal = !!ctx.circle_game_recent_beats || !!ctx.ivy_theory;
    const streak = Number(ctx.current_streak ?? 0);

    const eligible: string[] = ['settle_standard']; // always available; the floor

    // Nothing needing saying is a precondition, not a preference.
    if (kept && !live && !missed && streak >= 2) eligible.push('settle_fast');
    // Something to dig INTO — a blocker, a theory, or a day that went wrong.
    if (ctx.recurring_blocker || ctx.ivy_theory || missed) eligible.push('dig');
    // She can only lead if she has something of her own to lead with.
    if (hasExternal) eligible.push('she_leads');
    // An agenda and "no agenda" cannot both be true.
    if (!live && !missed) eligible.push('open_floor');
    // Never at someone who is already struggling — the pause protocol and the
    // risk signals exist precisely to stop this.
    if (!fragile && (ctx.recurring_blocker || missed) && streak >= 0) eligible.push('push');
    // Only when there is genuinely something worth marking.
    if (kept && (streak === 7 || streak === 14 || streak === 21 || streak === 30 || streak >= 90 || ctx.circle_crown_run)) {
      eligible.push('mark');
    }

    // History: what did the last few calls look like?
    const recent = await prisma.call.findMany({
      where: { userId, status: 'COMPLETED', shape: { not: null } },
      orderBy: { scheduledAt: 'desc' },
      take: 4,
      select: { shape: true },
    }).catch(() => [] as { shape: string | null }[]);
    const history = recent.map((r) => r.shape).filter((v): v is string => !!v);

    // Never the same shape twice running — the single rule doing most of the work.
    let pool = eligible.filter((sh) => sh !== history[0]);

    // Rarity: the uncommon shapes stay uncommon. A rare thing that fires on
    // schedule is just a feature with a long interval, so these are held back
    // for a few calls rather than merely weighted down.
    const RARE = ['open_floor', 'push', 'mark'];
    const rareRecently = history.slice(0, 3).some((sh) => RARE.includes(sh));
    if (rareRecently) pool = pool.filter((sh) => !RARE.includes(sh));

    if (pool.length === 0) pool = ['settle_standard'];

    // Weighted so the workhorse stays the workhorse. Variety is the seasoning,
    // not the meal — a call that is never ordinary has no ordinary to vary from.
    const weight = (sh: string) =>
      sh === 'settle_standard' ? 5 : sh === 'settle_fast' || sh === 'dig' || sh === 'she_leads' ? 3 : 1;
    const total = pool.reduce((n, sh) => n + weight(sh), 0);
    let roll = Math.random() * total;
    for (const sh of pool) {
      roll -= weight(sh);
      if (roll <= 0) return sh;
    }
    return pool[pool.length - 1];
  }

  /**
   * The two things that make a call feel like a relationship rather than a form:
   * something SHE thinks, and how long the two of them have been at this.
   *
   * Everything else she is given is a fact about them. A standing theory is the
   * only thing that is hers — she worked it out, she might be wrong, and she
   * can come back to it. And relationship age is what lets week 1 and month 6
   * sound different: streak milestones look like a proxy for that but they
   * measure PERFORMANCE, not acquaintance. Someone who broke at day 40 and
   * rebuilt to day 3 has known her six weeks and she should sound like it.
   */
  private async interiorityContext(userId: string): Promise<{
    ivy_theory: string | null;
    ivy_theory_age_days: number | null;
    relationship_stage: string | null;
  }> {
    const [theory, first, completed] = await Promise.all([
      prisma.ivyTheory.findFirst({
        where: { userId, status: 'open' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, basis: true, createdAt: true, raisedCount: true },
      }).catch(() => null),
      prisma.call.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      }).catch(() => null),
      prisma.call.count({ where: { userId, status: 'COMPLETED' } }).catch(() => 0),
    ]);

    const daysKnown = first
      ? Math.max(0, Math.floor((Date.now() - first.scheduledAt.getTime()) / 86_400_000))
      : 0;

    // A ladder, not a number. What changes with age is how much needs saying:
    // early on the mechanic has to be explained, later it can just be named,
    // and eventually most of it goes unsaid because they both already know it.
    const stage = (() => {
      if (completed <= 1) return null; // the onboarding call has its own register
      if (completed <= 4 || daysKnown <= 7) {
        return `You have spoken ${completed} times, over ${daysKnown} day${daysKnown === 1 ? '' : 's'}. Still early: explain a mechanic the first time it comes up, use their name a little more than you will later, and do not assume shared shorthand you have not built yet.`;
      }
      if (daysKnown <= 35) {
        return `You have spoken ${completed} times over ${daysKnown} days. You know each other now: stop explaining the mechanics, name them. Refer back to specific things they have told you rather than asking again. Shorter openings — you do not need to reintroduce yourself to the conversation.`;
      }
      return `You have spoken ${completed} times over ${daysKnown} days — months, now. Talk like someone who has been here the whole time: heavy shorthand, inside references to their own past calls, most of the mechanic unsaid because you both know it. Warmth by familiarity rather than by effort. Never perform closeness you have not earned, but do not act like a stranger either.`;
    })();

    return {
      ivy_theory: theory
        ? `${theory.content}${theory.basis ? ` (formed from: ${theory.basis})` : ''}`
        : null,
      ivy_theory_age_days: theory
        ? Math.max(0, Math.floor((Date.now() - theory.createdAt.getTime()) / 86_400_000))
        : null,
      relationship_stage: stage,
    };
  }

  /**
   * What Ivy needs to say her own cadence out loud without lying about it:
   * which days she calls, and that the other days are a check-in here instead.
   */
  private cadenceContext(user: { id: string; preferredDays: string | null; callFrequency: number } | null): {
    call_days: string | null;
    off_day_channel: string | null;
  } {
    if (!user) return { call_days: null, off_day_channel: null };
    const days = this.voiceCallDays(user);
    if (days === null) return { call_days: 'every day', off_day_channel: null };

    const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const named = order
      .filter((d) => days.has(d))
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1));
    return {
      call_days: named.join(', '),
      off_day_channel:
        'On every other day you check in by message here instead — so never promise a CALL on a day that is not a call day. ' +
        'Say plainly which it will be ("I\'ll message you tomorrow, and we\'ll talk properly on Thursday"). ' +
        'Their morning voice note still arms every single day either way, so no day goes unrecorded and you never need to ask them to keep track of the gaps — you already have them.',
    };
  }

  /**
   * The local weekdays this member gets a voice call on, or null for every day.
   *
   * `preferredDays` is an explicit choice and always wins. `callFrequency` is
   * the fallback — it has existed in the schema since the beginning, been
   * validated 1-7, and been read into Ivy's own prompt context ("calls_per_week"),
   * while NOTHING in the scheduler ever honoured it. So Ivy has been telling
   * people a cadence the system did not keep, and plan-adjustment.service has
   * been agreeing on calls to move sessions to different days and writing a
   * field the scheduler read for days but never for frequency.
   */
  private voiceCallDays(user: { id: string; preferredDays: string | null; callFrequency: number }): Set<string> | null {
    if (user.preferredDays) {
      try {
        const parsed = JSON.parse(user.preferredDays) as unknown;
        if (Array.isArray(parsed)) {
          const days = parsed
            .filter((d): d is string => typeof d === 'string')
            .map((d) => d.toLowerCase());
          if (days.length > 0) return new Set(days);
        }
      } catch {
        // A malformed row must never silence a member. Previously this parse
        // was unguarded inside the per-user loop, so one bad value meant that
        // person got no calls at all — recorded as a warn nobody would read.
        logger.warn(`Unparseable preferredDays for ${user.id} — falling back to callFrequency`);
      }
    }

    const freq = Number(user.callFrequency);
    if (!Number.isFinite(freq) || freq >= 7) return null;
    return new Set(CADENCE_DAYS[Math.max(1, Math.min(6, Math.round(freq)))]);
  }

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

    const tz = user.timezone || 'Europe/London';

    // Deduplication guard — skip if calls already exist for the member's OWN
    // day. This used to use the server's UTC day, which is a different 24 hours
    // from the member's for everyone west of Greenwich: a US evening call lands
    // near midnight UTC, so it fell into the NEXT server day and blocked the
    // following day's scheduling.
    const localDay = date.toLocaleDateString('en-CA', { timeZone: tz });
    const todayStart = fromZonedTime(`${localDay}T00:00:00`, tz);
    const todayEnd = fromZonedTime(`${localDay}T23:59:59.999`, tz);
    const alreadyScheduled = await prisma.call.count({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (alreadyScheduled > 0) {
      logger.info(`Skipping scheduleDailyCalls for ${userId} — ${alreadyScheduled} call(s) already exist for their local day ${localDay}`);
      return [];
    }

    // Which days get a VOICE call — evaluated in the user's timezone.
    //
    // This used to return [] on a non-preferred day, which skipped the evening
    // chat check-in too: a member on three days a week simply heard nothing on
    // the other four. A reduced cadence should move the ritual to a cheaper
    // channel, not delete it — otherwise Ivy has to ask people to remember
    // their own unchecked days, and the whole point is that she is the one
    // keeping count.
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase();
    const callDays = this.voiceCallDays(user);
    const isVoiceDay = callDays === null || callDays.has(dayName);

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
    if (user.morningCallTime && user.morningCallOptIn && isVoiceDay) {
      const morningUTC = toUTC(user.morningCallTime);
      if (isBefore(now, morningUTC)) {
        const morningCall = await this.scheduleCall(userId, 'MORNING_PLANNING', morningUTC, await this.getUserContext(userId));
        calls.push(morningCall);
      }
    }

    // Coach clients get the evening call too.
    //
    // This used to read `!user.coachId` — "coach clients get morning only,
    // halves voice COGS". That plan was written before the live morning call
    // became opt-in (§1c, async VN is the default loop), and the two rules were
    // never reconciled: `morningCallOptIn` is default-false and nothing in the
    // codebase ever sets it true, so "morning only" resolved to *no calls at
    // all* for every coach-referred client — the primary GTM segment, silently
    // receiving nothing. The saving didn't halve their calls, it zeroed them.
    //
    // The evening call is the one that settles the day, so it is the one worth
    // keeping. Revisit COGS when coach clients are numerous enough to measure.
    if (user.eveningCallTime) {
      const eveningUTC = toUTC(user.eveningCallTime);
      if (isBefore(now, eveningUTC)) {
        if (user.commStyle === 'TEXTS' || !isVoiceDay) {
          // Two routes here, same destination. Text-preferred members always
          // get the evening ritual as a chat check-in; everyone else gets it on
          // the days their cadence has no call. Same eveningCallTime gate, same
          // EVENING_REVIEW context — different channel.
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
    // Section gate. The travel block is 11% of the prompt and applies to almost
    // nobody on almost every call, so it ships only when a recent call actually
    // surfaced a trip. Travel is announced in advance, which is what makes a
    // signal from the previous call arrive in time to be useful.
    let travel_signal = false;

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
          select: { callType: true, callSummary: true, scheduledAt: true, status: true, callInsights: true },
        }),

        // Layer 3: long-term curated memories. Fetch a wider window and select
        // identity-first below — pure take-8-by-recency let foundational facts
        // (their WHY, life events) scroll out of Ivy's head after a few weeks,
        // making calls feel dumber over time instead of smarter.
        prisma.callMemory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 24,
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

      travel_signal = recentSummaries.some(
        (c) => (c.callInsights as { travel_ahead?: boolean } | null)?.travel_ahead === true,
      );

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
        // Identity-first selection: the facts that define WHO they are and WHY
        // they're doing this (motivation, life events, breakthroughs) stay in
        // Ivy's head permanently; the remaining slots go to the freshest
        // memories. Cap 10 to keep the prompt lean.
        const identity = ltMemories.filter((m) =>
          ['motivation', 'life_event', 'breakthrough'].includes(m.category));
        const rest = ltMemories.filter((m) => !identity.includes(m));
        const seen = new Set<string>();
        const selected = [...identity.slice(0, 5), ...rest]
          .filter((m) => !seen.has(m.content) && seen.add(m.content))
          .slice(0, 10);
        long_term_memories = selected
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
    // When Ivy will next actually SPEAK to them — and whether the morning is a
    // real conversation or just an automated nudge.
    //
    // She had no idea, so she invented plausible follow-ups the schedule cannot
    // support: on a live call she told a member "I'm checking in on his recovery
    // tomorrow morning" when he has morningCallOptIn=false and no morning call
    // time. Tomorrow morning he gets a voice-note prompt from a cron; the next
    // conversation is a full day later. For an accountability product, Ivy
    // breaking her word about contact is the worst failure available — it is
    // exactly the thing she holds members to.
    const contactPlan = (() => {
      const morningIsCall = !!(user as any)?.morningCallOptIn && !!(user as any)?.morningCallTime;
      const eveningTime = (user as any)?.eveningCallTime as string | null;
      const commStyle = (user as any)?.commStyle as string | null;
      const armingStart = (user as any)?.armingWindowStart as string | null;

      const parts: string[] = [];
      if (morningIsCall) {
        parts.push(`a morning call at ${(user as any).morningCallTime}`);
      } else if (armingStart) {
        parts.push(`an automated voice-note prompt at ${armingStart} (NOT a conversation — you do not speak to them)`);
      }
      if (eveningTime) {
        parts.push(commStyle === 'TEXTS'
          ? `an evening check-in message around ${eveningTime}`
          : `the evening call at ${eveningTime}`);
      }
      return {
        next_contact: parts.length ? parts.join(', then ') : null,
        morning_is_a_conversation: morningIsCall,
      };
    })();

    // Arming facts. The VN is the keystone: no voice note means no armed day,
    // no kept day, no streak and no stake protection — so a ritual that quietly
    // erodes reads downstream as failure, and the member churns believing the
    // product didn't work when they simply stopped doing the one thing that
    // makes it work. Without these, an unarmed day and a skipped workout arrive
    // at the evening call looking identical.
    const armingFacts = await (async () => {
      try {
        const [todayArmed, weekWorkouts] = await Promise.all([
          prisma.workout.findFirst({
            where: { userId, plannedDate: { gte: startOfDay(now), lte: endOfDay(now) } },
            select: { armedAt: true },
          }),
          prisma.workout.findMany({
            where: { userId, plannedDate: { gte: weekAgo, lt: startOfDay(now) } },
            select: { armedAt: true },
          }),
        ]);
        return {
          armed_today: todayArmed ? todayArmed.armedAt != null : null,
          unarmed_days_7d: weekWorkouts.filter((w) => w.armedAt == null).length,
        };
      } catch {
        return { armed_today: null, unarmed_days_7d: 0 };
      }
    })();

    // The next session they've already committed to on a LATER day. Without this
    // the context is entirely present-tense: a member reschedules to Tuesday,
    // and the next call has no idea a session is owed.
    const upcomingSession = await prisma.workout.findFirst({
      where: { userId, status: 'PLANNED', plannedDate: { gt: endOfDay(now) } },
      orderBy: { plannedDate: 'asc' },
      select: { activity: true, plannedDate: true, plannedTime: true },
    }).catch(() => null);

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
    //
    // ONLY for users who have actually chosen to stake. This was set from config
    // unconditionally, and because the onboarding flow's teeth ladder branches on
    // foundation_stake FIRST, its stake-less branch ("your word is the stake
    // here") was unreachable — every new user was told real money was at risk.
    // Observed live: a user with no stake and no card was told "your £1 a day is
    // safe... if a day slides it goes to Against Malaria Foundation". Nothing
    // could be taken; the promise was fiction. A stake needs both an amount and
    // a card, since an off-session hold is impossible without a saved method.
    const foundationCurrency = (user?.currency ?? 'GBP') as Currency;
    const canActuallyStake = stake_weekly != null && !!user?.stripeCustomerId;
    const foundation_stake = canActuallyStake
      ? STAKE_CONFIG.foundationFlatAmount[foundationCurrency]
      : null;
    // The member's own timezone, used for every wall-clock fact Ivy states.
    const userTz = user?.timezone || 'Europe/London';
    const callLocalHour = (() => {
      const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: userTz }));
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

    // ── Sustained-struggle signal (drives the coach-escalation nudge) ─────────
    // Fires only on a real pattern: the user's last TWO settled cycles each
    // forfeited half or more of their days. One bad week never triggers it.
    const recentSettled = await prisma.stakeCycle.findMany({
      where: { userId, status: 'SETTLED' },
      orderBy: { periodEnd: 'desc' },
      take: 2,
      select: { daysForfeited: true, daysInCycle: true },
    }).catch(() => [] as { daysForfeited: number; daysInCycle: number }[]);
    const struggle_signal =
      recentSettled.length === 2 &&
      recentSettled.every((c) => c.daysInCycle > 0 && c.daysForfeited / c.daysInCycle >= 0.5);


    const days_since_last_interaction = user?.lastCallAt
      ? differenceInDays(now, new Date(user.lastCallAt))
      : null;

    const preferred_days = (() => {
      try { return user?.preferredDays ? (JSON.parse(user.preferredDays) as string[]).join(', ') : null; }
      catch { return null; }
    })();

    const recent_life_markers = recentLifeMarkers.map((m) => m.marker).join(' | ') || null;

    const ctx: Record<string, any> = {
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
      calls_per_week: user?.callFrequency ?? 3,
      ...(await this.interiorityContext(userId)),
      // The days she actually rings, and what happens on the others. Without
      // this she closes a Tuesday call with "speak to you tomorrow" on a day
      // she has no call scheduled — the same class of broken promise as
      // telling someone their calls follow them and then not moving them.
      ...this.cadenceContext(user),

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

      // What Ivy can honestly promise about being back in touch.
      next_contact: contactPlan.next_contact,
      morning_is_a_conversation: contactPlan.morning_is_a_conversation,

      // Did they say it out loud today, and how often have they skipped it lately.
      armed_today: armingFacts.armed_today,
      unarmed_days_7d: armingFacts.unarmed_days_7d,

      // Forward-looking: what they already promised for a later day, so Ivy can
      // hold them to it rather than re-negotiating something already agreed.
      next_session: upcomingSession
        ? `${upcomingSession.activity}${upcomingSession.plannedTime ? ` at ${upcomingSession.plannedTime}` : ''} on ${upcomingSession.plannedDate.toLocaleDateString('en-GB', { weekday: 'long', timeZone: user?.timezone || 'Europe/London' })}`
        : null,
      // In THEIR timezone, not the server's. Untimezoned, this read the UTC day:
      // at 20:00 in New York it is already tomorrow in UTC, so Ivy would state
      // the wrong weekday with total confidence — to a member whose prompt tells
      // her to use it when attributing a miss to a particular day.
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: userTz }),
      // Their wall clock and where it is. Lets her notice she is calling someone
      // at a strange hour, which is the first sign they have travelled.
      local_time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: userTz }),
      timezone: userTz,
      days_since_workout,
      previous_streak: streak?.longestStreak ?? 0,

      // Sustained struggle → coach escalation (prompt.service coachEscalation).
      struggle_signal,             // true only when the last 2 settled cycles each forfeited ≥50% of days
      has_coach: !!(user as any)?.coachId, // coach_name arrives via getCoachContextForClient below

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
        circle_game_recent_beats: null,
        circle_game_live_obligation: null,
        circle_crown_run: null,
        circle_room_record: null,
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
      travel_signal,          // gate: did a recent call surface an upcoming trip?
      // gate: a comped beta client with no card cannot have a charge to dispute.
      has_payment_method: !!user?.stripeCustomerId,
      long_term_memories,     // Layer 3: curated memorable facts about this person
      recent_chat,            // Same-day bridge: latest in-app chat exchange (non-CHAT flows)

      // Behavioural intelligence (from insight.service — null until enough calls exist)
      inferred_patterns: (user?.inferredProfile as any)?.inferred_patterns ?? null,
      notable_observation: (user?.inferredProfile as any)?.notable_observation ?? null,
      probe_for_specificity: (user?.inferredProfile as any)?.probe_for_specificity ?? false,
      most_effective_nudge: (user?.inferredProfile as any)?.most_effective_nudge ?? null,
      high_risk_signals: (user?.inferredProfile as any)?.high_risk_signals ?? [],
      recurring_blockers: (user?.inferredProfile as any)?.recurring_blockers ?? null,
      preferred_register: (user?.inferredProfile as any)?.preferred_register ?? null,
      behavioural_modifiers: (user?.inferredProfile as any)?.behavioural_modifiers ?? null,

      // Communication preference (learned from call answer rate + explicit signals)
      call_answer_rate: (user?.inferredProfile as any)?.call_answer_rate ?? null,
      contact_preference: (user?.inferredProfile as any)?.contact_preference ?? null,
      contact_pattern_note: (user?.inferredProfile as any)?.contact_pattern_note ?? null,
    };

    // The shape is chosen LAST, because it is chosen from the context: what is
    // eligible depends on whether the day was kept, whether something in the
    // room is live, whether she has a theory to lead with, and whether this
    // person is having a bad enough week that pushing would be cruel.
    ctx.call_shape = await this.pickCallShape(userId, callType ?? '', ctx).catch(() => null);

    return ctx;
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
