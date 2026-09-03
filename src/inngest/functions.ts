/**
 * Inngest functions — the production cron backbone (Phase 1).
 *
 * These are a faithful 1:1 migration of the node-cron jobs in src/worker.ts.
 * Each runs on Inngest Cloud's scheduler (cron triggers are UTC, matching the
 * old worker), so the always-on `worker` machine — and its every-5-min Neon
 * polling — can be retired. Work is wrapped in `step.run` so Inngest's durable
 * execution retries a failed step without re-running the ones that succeeded.
 *
 * Service calls are identical to worker.ts; behaviour is unchanged. The legacy
 * cron in worker.ts is flag-gated (config.inngest.enabled) for a clean,
 * exclusive cutover — exactly one scheduler runs at a time.
 *
 * Phase 2 (deferred): migrate the Bull processors (call/message) to Inngest
 * events to retire Upstash too.
 */
import { inngest } from './client';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import { config } from '../config';
import buddyService from '../services/buddy.service';
import { dispatchPendingDonations } from '../services/every-org.service';
import callService from '../services/call.service';
import seasonService from '../services/season.service';
import coachService from '../services/coach.service';
import insightService from '../services/insight.service';
import { getServiceCostSummary } from '../services/usage.service';
import { sendTelegramAdmin } from '../utils/telegram-admin';
import {
  runArmingForStage,
  runPreCommitReminders,
  openStakeCyclesForActiveUsers,
  settleExpiredStakeCycles,
} from '../services/arming.service';
import { callFunctions } from './calls';
import { messagingFunctions } from './messaging';
import { functionFailedAlert } from './failure-alert';
import { opsWatchdog } from './watchdog';
import { opsInvariantSweep } from './invariants';
import { opsBatch } from '../lib/ops-alert';
import { withHeartbeat } from './with-heartbeat';

// createFunction + heartbeat, for CRON functions only. The heartbeat rows feed
// the watchdog (watchdog.ts) and /health/jobs. Event-driven functions (which
// may sleep for hours) must keep using inngest.createFunction directly.
const cronFunction = (
  opts: Parameters<typeof inngest.createFunction>[0] & { id: string },
  handler: (ctx: any) => Promise<unknown>,
) => inngest.createFunction(opts as any, withHeartbeat(opts.id, handler) as any);

// Every Sunday at 9am UTC — weekly accountability buddy digests
const weeklyBuddyDigest = cronFunction(
  { id: 'weekly-buddy-digest', name: 'Weekly buddy digest', triggers: { cron: '0 9 * * 0' } },
  async ({ step }) => {
    await step.run('send-weekly-digests', () => buddyService.sendWeeklyDigests());
    return { ok: true };
  }
);

// Every Monday at 8am UTC — weekly coach client digest
const weeklyCoachDigest = cronFunction(
  { id: 'weekly-coach-digest', name: 'Weekly coach digest', triggers: { cron: '0 8 * * 1' } },
  async ({ step }) => {
    await step.run('send-coach-digests', () => coachService.sendWeeklyDigestToAllCoaches());
    return { ok: true };
  }
);

// Every 30 minutes — schedule ponder calls for due coaches
const ponderScheduler = cronFunction(
  { id: 'ponder-scheduler', name: 'Ponder call scheduler', triggers: { cron: '*/30 * * * *' } },
  async ({ step }) => {
    await step.run('schedule-ponder-calls', () => coachService.schedulePonderCallsForDueCoaches());
    return { ok: true };
  }
);

// Every 30 minutes — circle session lifecycle: open sessions whose time has
// come (members invited to drop win + struggle), close sessions past their
// 72h window (room sealed, absentees handed to the catch-up service).
const circleSessionLifecycle = cronFunction(
  { id: 'circle-session-lifecycle', name: 'Circle session lifecycle', triggers: { cron: '*/30 * * * *' } },
  async ({ step }) => {
    const { default: circleSessionService } = await import('../services/circle-session.service');
    await step.run('open-due-sessions', () => circleSessionService.openDueSessions());
    await step.run('close-expired-sessions', () => circleSessionService.closeExpiredSessions());
    return { ok: true };
  }
);

// Every 30 minutes — the game clock: fire due spec-game timers (baton windows,
// deadlines) and enforce legacy relay windows / collective deadlines. Without
// this, time passes in the world but not in the game.
const circleGameClock = cronFunction(
  { id: 'circle-game-clock', name: 'Circle game clock', triggers: { cron: '*/30 * * * *' } },
  async ({ step }) => {
    const { default: circleGameService } = await import('../services/circle-game.service');
    const ticked = await step.run('tick-game-clocks', () => circleGameService.tickGameClocks());
    return { ok: true, ticked };
  }
);

// Every Monday at 8:30am UTC — the week's group number to every circle member
const circleMemberPulse = cronFunction(
  { id: 'circle-member-pulse', name: 'Weekly circle member pulse', triggers: { cron: '30 8 * * 1' } },
  async ({ step }) => {
    const { default: circleService } = await import('../services/circle.service');
    await step.run('send-member-pulse', () => circleService.sendWeeklyMemberPulse());
    return { ok: true };
  }
);

// Event-driven: a coach (or Ivy, post-ponder/chat) changed a client's
// programme → tell the client about an hour later. The delay batches a burst
// of edits from one session into one nudge, and the client reads the CURRENT
// plan when they open the tab.
const programmeUpdatedNotify = inngest.createFunction(
  {
    id: 'programme-updated-notify',
    name: 'Programme updated — notify client',
    triggers: { event: 'programme/updated' },
    // A ponder session can touch one client several times — one notification
    // per client per session is plenty.
    idempotency: 'event.data.clientId',
  },
  async ({ event, step }) => {
    await step.sleep('let-the-session-finish', '1h');

    await step.run('notify-client', async () => {
      const client = await prisma.user.findUnique({
        where: { id: event.data.clientId as string },
        select: {
          id: true, firstName: true, isActive: true,
          coach: { select: { firstName: true, coachProfile: { select: { brandName: true, whitelabelEnabled: true } } } },
        },
      });
      if (!client || !client.isActive || !client.coach) return;

      const coachLabel = (client.coach.coachProfile?.whitelabelEnabled && client.coach.coachProfile.brandName)
        ? client.coach.coachProfile.brandName
        : client.coach.firstName;

      const chatService = (await import('../services/chat.service')).default;
      // postIvyMessage writes the thread AND fires the web push.
      await chatService.postIvyMessage(
        client.id,
        `${coachLabel} refreshed your programme — take a look in your Plan tab. I'll be coaching to it from today.`,
        { messageType: 'programme_update' },
      );
    });
    return { ok: true };
  }
);

// 1st of every month at 2am UTC — dispatch accumulated wallet donations to charities
const monthlyDonationDispatch = cronFunction(
  { id: 'monthly-donation-dispatch', name: 'Monthly charity donation dispatch', triggers: { cron: '0 2 1 * *' } },
  async ({ step }) => {
    await step.run('dispatch-pending-donations', () => dispatchPendingDonations());
    return { ok: true };
  }
);

// Every day at midnight UTC — schedule today's EVENING calls for all active users.
// (Morning live call replaced by VN arming loop for everyone — §1c.)
// Runs HOURLY, not at midnight UTC.
//
// A single 00:00 UTC run can only ever reach timezones whose evening is still
// ahead at that instant. scheduleDailyCalls skips a slot already in the past,
// so at 00:00 UTC — 20:00 in New York, 19:00 in Chicago — an East or Central US
// member's evening call was ALWAYS in the past and ALWAYS skipped. Not delayed:
// never scheduled, on any day. Denver and Los Angeles happened to fall inside
// the window and worked, which is why this looked fine.
//
// Hourly, every member gets a run shortly after their own local midnight, when
// their evening is still ahead. The local-day dedup in scheduleDailyCalls makes
// the other 23 runs no-ops.
const dailyEveningCalls = cronFunction(
  { id: 'daily-evening-calls', name: 'Schedule daily evening calls', triggers: { cron: '0 * * * *' } },
  async ({ step }) => {
    const userIds = await step.run('find-active-users', async () => {
      const users = await prisma.user.findMany({
        where: { isActive: true, isOnboarded: true, subscriptionTier: { notIn: ['FREE', 'COACH'] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    });

    const scheduled = await step.run('schedule-calls', async () => {
      const today = new Date();
      const failures = opsBatch('daily-evening-calls');
      let count = 0;
      for (const id of userIds) {
        try {
          await callService.scheduleDailyCalls(id, today);
          count++;
        } catch (err) {
          failures.add({ severity: 'warn', title: 'schedule_calls_failed', userId: id, error: err });
        }
      }
      await failures.flush();
      return count;
    });

    logger.info(`Scheduled calls for ${scheduled}/${userIds.length} users`);
    return { scheduled, total: userIds.length };
  }
);

// Every day at 3am UTC — distil that day's in-app chats into long-term memory.
// One Haiku extraction per user who has un-extracted chat messages → callMemory,
// the same store calls read. Keeps chat-Ivy and call-Ivy on one shared memory.
const dailyChatMemory = cronFunction(
  { id: 'daily-chat-memory', name: 'Daily chat memory extraction', triggers: { cron: '0 3 * * *' } },
  async ({ step }) => {
    const userIds = await step.run('find-users-with-new-chat', async () => {
      const rows = await prisma.message.findMany({
        where: { channel: 'IN_APP', direction: 'INBOUND', memoryExtractedAt: null },
        distinct: ['userId'],
        select: { userId: true },
      });
      return rows.map((r) => r.userId);
    });

    const memories = await step.run('extract-chat-memory', async () => {
      const failures = opsBatch('daily-chat-memory');
      let count = 0;
      for (const id of userIds) {
        try {
          count += await insightService.extractChatMemory(id);
        } catch (err) {
          failures.add({ severity: 'info', title: 'memory_extraction_failed', userId: id, error: err });
        }
      }
      await failures.flush();
      return count;
    });

    logger.info(`Chat memory: ${userIds.length} users processed, ${memories} memories written`);
    return { users: userIds.length, memories };
  }
);

// ── Arming loop — morning VN prompt + escalation ladder (Phase 3) ─────────
//
// Runs every 15 minutes; runArmingForStage() checks each user's arming window
// against the current time with a ±7.5-minute tolerance window. Each stage is its
// own step so a failure in one doesn't force the others to re-run.
//
// Stage timing relative to armingWindowStart (S) and armingWindowEnd (E):
//   PROMPT       — fires at S
//   REMINDER     — fires at S + 75 min (if still unarmed)
//   FINAL_NOTICE — fires at E − 15 min (if still unarmed)
//   DEADLINE     — fires at E (unarmed → MISSED + FORFEITED)
const armingLoop = cronFunction(
  { id: 'arming-loop', name: 'Morning VN arming loop', triggers: { cron: '*/15 * * * *' } },
  async ({ step }) => {
    // Pin `now` in a step so it's memoized once. Inngest replays the handler
    // top-to-bottom after each step checkpoints; computing the time outside a
    // step would let the four stages drift across replays.
    const nowIso = await step.run('capture-now', async () => new Date().toISOString());
    const now = new Date(nowIso);
    await step.run('arming-prompt', () => runArmingForStage('PROMPT', now));
    await step.run('arming-reminder', () => runArmingForStage('REMINDER', now));
    await step.run('arming-final-notice', () => runArmingForStage('FINAL_NOTICE', now));
    await step.run('arming-deadline', () => runArmingForStage('DEADLINE', now));
    // Keep-on-track nudge ~1h before each user's committed activity time.
    await step.run('pre-commit-reminders', () => runPreCommitReminders(now));
    return { ok: true };
  }
);

// ── StakeCycle open — every Monday at 00:05 UTC ───────────────────────────
// Opens a new weekly StakeCycle for all eligible users. Runs 5 min after
// midnight to let the daily call scheduler run first. openStakeCycle() guards
// against duplicate open cycles — safe to re-run.
const stakeCycleOpen = cronFunction(
  { id: 'stakecycle-open', name: 'Open weekly StakeCycles', triggers: { cron: '5 0 * * 1' } },
  async ({ step }) => {
    await step.run('open-stake-cycles', () => openStakeCyclesForActiveUsers());
    return { ok: true };
  }
);

// ── StakeCycle settle — every night at 23:55 UTC ──────────────────────────
// DAILY (not weekly): Foundation Runs end on any weekday, so settlement must
// sweep nightly. settleExpiredStakeCycles only touches cycles whose periodEnd
// has actually passed, so weekly cycles still settle on their Sunday.
// SAFETY: real Stripe capture — never run against production until Phase 2
// money-flow checkpoint is cleared (§ Phase 2 ✋).
const stakeCycleSettle = cronFunction(
  { id: 'stakecycle-settle', name: 'Settle expired StakeCycles', triggers: { cron: '55 23 * * *' } },
  async ({ step }) => {
    await step.run('settle-expired-stake-cycles', () => settleExpiredStakeCycles());
    return { ok: true };
  }
);

// Every day at 1am UTC — advance sprint and season statuses based on current date
const seasonAdvance = cronFunction(
  { id: 'season-advance', name: 'Advance sprint and season statuses', triggers: { cron: '0 1 * * *' } },
  async ({ step }) => {
    await step.run('advance-statuses', () => seasonService.advanceStatuses());
    return { ok: true };
  }
);

// Every day at 3am UTC — recover calls stuck in IN_PROGRESS (Retell outage safety net)
const stuckCallRecovery = cronFunction(
  { id: 'stuck-call-recovery', name: 'Recover stuck IN_PROGRESS calls', triggers: { cron: '0 3 * * *' } },
  async ({ step }) => {
    // "Recovery" used to mean updateMany({ status: 'FAILED' }) — it discarded the
    // call. That is a cleanup job wearing a recovery job's name, and it cost us:
    // a real 6m24s evening conversation sat stuck with a 5,087-character
    // transcript still sitting in Retell, and this job would have marked it
    // FAILED and thrown the transcript away. A call is only unrecoverable if
    // RETELL has nothing; ask before discarding.
    const result = await step.run('recover-stuck-calls', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const stuck = await prisma.call.findMany({
        where: { status: 'IN_PROGRESS', startedAt: { lt: twoHoursAgo } },
        select: { id: true, retellCallId: true, callType: true, userId: true },
      });
      let backfilled = 0;
      let failed = 0;

      for (const call of stuck) {
        let rescued = false;
        if (call.retellCallId && config.retell.apiKey) {
          try {
            const res = await fetch(`https://api.retellai.com/v2/get-call/${call.retellCallId}`, {
              headers: { Authorization: `Bearer ${config.retell.apiKey}` },
            });
            if (res.ok) {
              const rc = (await res.json()) as any;
              if (rc.call_status === 'ended') {
                const analysis = rc.call_analysis ?? {};
                await prisma.call.update({
                  where: { id: call.id },
                  data: {
                    status: 'COMPLETED',
                    endedAt: rc.end_timestamp ? new Date(rc.end_timestamp) : new Date(),
                    duration: Math.round((rc.duration_ms ?? 0) / 1000),
                    transcript: rc.transcript || null,
                    sentiment: analysis.user_sentiment ?? null,
                    callSummary: analysis.call_summary ?? null,
                    outcome: analysis.in_voicemail ? 'voicemail' : 'completed',
                  },
                });
                backfilled++;
                rescued = true;

                // Restoring the transcript is not restoring the call. Insights
                // and memories are derived by the webhook path, which by
                // definition did not run for a stuck call — so a recovered call
                // came back with its words and none of its meaning, and Ivy
                // reads memories, not old transcripts.
                //
                // Seen live: a member told Ivy his birthday on a call that got
                // stuck. The transcript was recovered; the memory never was, so
                // she had no idea days later and he noticed. Data restored,
                // meaning lost.
                // Two guards. Extraction is createMany with no dedupe, so a
                // second pass would duplicate every memory; and a voicemail or
                // a three-second pickup has no meaning to extract, only Haiku
                // spend. Same bar the webhook uses for a real conversation.
                const alreadyHasMemories = await prisma.callMemory.count({ where: { callId: call.id } });
                const reachedAHuman = !analysis.in_voicemail && (rc.transcript?.length ?? 0) > 200;
                if (!alreadyHasMemories && reachedAHuman) {
                  await insightService
                    .extractCallInsights(call.id, rc.transcript || '', call.callType, call.userId)
                    .catch((err) => logger.warn(`stuck-call-recovery: insight extraction failed for ${call.id}`, err));
                }
              }
            }
          } catch (err) {
            logger.warn(`stuck-call-recovery: Retell lookup failed for ${call.id}`, err);
          }
        }
        if (!rescued) {
          await prisma.call.update({
            where: { id: call.id },
            data: { status: 'FAILED', outcome: 'stuck_recovered' },
          });
          failed++;
        }
      }
      return { backfilled, failed };
    });

    if (result.backfilled > 0) logger.info(`Backfilled ${result.backfilled} stuck call(s) from Retell`);
    if (result.failed > 0) logger.warn(`Marked ${result.failed} unrecoverable stuck call(s) FAILED`);
    return result;
  }
);

// Every day at 9am UTC — check yesterday's platform spend, alert if over threshold
const dailyCostAlert = cronFunction(
  { id: 'daily-cost-alert', name: 'Daily platform spend alert', triggers: { cron: '0 9 * * *' } },
  async ({ step }) => {
    await step.run('check-daily-spend', async () => {
      const threshold = parseFloat(process.env.COST_ALERT_THRESHOLD_GBP ?? '15');
      const summary = await getServiceCostSummary(1);
      const total = summary.reduce((sum, row) => sum + row.totalCostGbp, 0);
      const retell = summary.find((r) => r.service === 'retell')?.totalCostGbp ?? 0;

      logger.info(
        `Daily spend check — total £${total.toFixed(2)}, Retell £${retell.toFixed(2)}, threshold £${threshold}`
      );

      if (total > threshold) {
        const lines = summary
          .filter((r) => r.totalCostGbp > 0)
          .sort((a, b) => b.totalCostGbp - a.totalCostGbp)
          .map((r) => `  ${r.service}/${r.operation}: £${r.totalCostGbp.toFixed(2)} (${r.count} calls)`)
          .join('\n');
        await sendTelegramAdmin(
          `⚠️ Ivy daily spend alert\n\nTotal (last 24h): £${total.toFixed(2)}\nThreshold: £${threshold}\n\nBreakdown:\n${lines}`
        );
      }
    });
    return { ok: true };
  }
);

import { opsDailyGuard, opsWeeklyPulse } from './ops';

/** All Inngest functions, served at /api/inngest. */
export const functions = [
  // Ops mission control (cost guard + weekly product pulse → admin Telegram)
  opsDailyGuard,
  opsWeeklyPulse,
  // Fleet-wide terminal failure pager (inngest/function.failed)
  functionFailedAlert,
  // Job watchdog (heartbeat staleness) + outcome invariant sweeper
  opsWatchdog,
  opsInvariantSweep,
  // Cron backbone (Phase 1)
  weeklyBuddyDigest,
  weeklyCoachDigest,
  ponderScheduler,
  programmeUpdatedNotify,
  circleSessionLifecycle,
  circleGameClock,
  circleMemberPulse,
  monthlyDonationDispatch,
  dailyEveningCalls,
  dailyChatMemory,
  armingLoop,
  stakeCycleOpen,
  stakeCycleSettle,
  seasonAdvance,
  stuckCallRecovery,
  dailyCostAlert,
  // Event-driven workers (Phase 2 — replaced Bull call/message queues)
  ...callFunctions,
  ...messagingFunctions,
];
