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
import buddyService from '../services/buddy.service';
import { dispatchPendingDonations } from '../services/every-org.service';
import callService from '../services/call.service';
import seasonService from '../services/season.service';
import coachService from '../services/coach.service';
import { getServiceCostSummary } from '../services/usage.service';
import { sendTelegramAdmin } from '../utils/telegram-admin';
import {
  runArmingForStage,
  openStakeCyclesForActiveUsers,
  settleExpiredStakeCycles,
} from '../services/arming.service';

// Every Sunday at 9am UTC — weekly accountability buddy digests
const weeklyBuddyDigest = inngest.createFunction(
  { id: 'weekly-buddy-digest', name: 'Weekly buddy digest', triggers: { cron: '0 9 * * 0' } },
  async ({ step }) => {
    await step.run('send-weekly-digests', () => buddyService.sendWeeklyDigests());
    return { ok: true };
  }
);

// Every Monday at 8am UTC — weekly coach client digest
const weeklyCoachDigest = inngest.createFunction(
  { id: 'weekly-coach-digest', name: 'Weekly coach digest', triggers: { cron: '0 8 * * 1' } },
  async ({ step }) => {
    await step.run('send-coach-digests', () => coachService.sendWeeklyDigestToAllCoaches());
    return { ok: true };
  }
);

// Every 30 minutes — schedule ponder calls for due coaches
const ponderScheduler = inngest.createFunction(
  { id: 'ponder-scheduler', name: 'Ponder call scheduler', triggers: { cron: '*/30 * * * *' } },
  async ({ step }) => {
    await step.run('schedule-ponder-calls', () => coachService.schedulePonderCallsForDueCoaches());
    return { ok: true };
  }
);

// 1st of every month at 2am UTC — dispatch accumulated wallet donations to charities
const monthlyDonationDispatch = inngest.createFunction(
  { id: 'monthly-donation-dispatch', name: 'Monthly charity donation dispatch', triggers: { cron: '0 2 1 * *' } },
  async ({ step }) => {
    await step.run('dispatch-pending-donations', () => dispatchPendingDonations());
    return { ok: true };
  }
);

// Every day at midnight UTC — schedule today's EVENING calls for all active users.
// (Morning live call replaced by VN arming loop for everyone — §1c.)
const dailyEveningCalls = inngest.createFunction(
  { id: 'daily-evening-calls', name: 'Schedule daily evening calls', triggers: { cron: '0 0 * * *' } },
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
      let count = 0;
      for (const id of userIds) {
        try {
          await callService.scheduleDailyCalls(id, today);
          count++;
        } catch (err) {
          logger.warn(`Failed to schedule calls for ${id}:`, err);
        }
      }
      return count;
    });

    logger.info(`Scheduled calls for ${scheduled}/${userIds.length} users`);
    return { scheduled, total: userIds.length };
  }
);

// ── Arming loop — morning VN prompt + escalation ladder (Phase 3) ─────────
//
// Runs every 5 minutes; runArmingForStage() checks each user's arming window
// against the current time with a ±3-minute tolerance window. Each stage is its
// own step so a failure in one doesn't force the others to re-run.
//
// Stage timing relative to armingWindowStart (S) and armingWindowEnd (E):
//   PROMPT       — fires at S
//   REMINDER     — fires at S + 75 min (if still unarmed)
//   FINAL_NOTICE — fires at E − 15 min (if still unarmed)
//   DEADLINE     — fires at E (unarmed → MISSED + FORFEITED)
const armingLoop = inngest.createFunction(
  { id: 'arming-loop', name: 'Morning VN arming loop', triggers: { cron: '*/5 * * * *' } },
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
    return { ok: true };
  }
);

// ── StakeCycle open — every Monday at 00:05 UTC ───────────────────────────
// Opens a new weekly StakeCycle for all eligible users. Runs 5 min after
// midnight to let the daily call scheduler run first. openStakeCycle() guards
// against duplicate open cycles — safe to re-run.
const stakeCycleOpen = inngest.createFunction(
  { id: 'stakecycle-open', name: 'Open weekly StakeCycles', triggers: { cron: '5 0 * * 1' } },
  async ({ step }) => {
    await step.run('open-stake-cycles', () => openStakeCyclesForActiveUsers());
    return { ok: true };
  }
);

// ── StakeCycle settle — every Sunday at 23:55 UTC ─────────────────────────
// Settles all StakeCycles whose periodEnd has passed. settleStakeCycle()
// captures forfeited slices and releases the rest.
// SAFETY: real Stripe capture — never run against production until Phase 2
// money-flow checkpoint is cleared (§ Phase 2 ✋).
const stakeCycleSettle = inngest.createFunction(
  { id: 'stakecycle-settle', name: 'Settle expired StakeCycles', triggers: { cron: '55 23 * * 0' } },
  async ({ step }) => {
    await step.run('settle-expired-stake-cycles', () => settleExpiredStakeCycles());
    return { ok: true };
  }
);

// Every day at 1am UTC — advance sprint and season statuses based on current date
const seasonAdvance = inngest.createFunction(
  { id: 'season-advance', name: 'Advance sprint and season statuses', triggers: { cron: '0 1 * * *' } },
  async ({ step }) => {
    await step.run('advance-statuses', () => seasonService.advanceStatuses());
    return { ok: true };
  }
);

// Every day at 3am UTC — recover calls stuck in IN_PROGRESS (Retell outage safety net)
const stuckCallRecovery = inngest.createFunction(
  { id: 'stuck-call-recovery', name: 'Recover stuck IN_PROGRESS calls', triggers: { cron: '0 3 * * *' } },
  async ({ step }) => {
    const recovered = await step.run('recover-stuck-calls', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await prisma.call.updateMany({
        where: { status: 'IN_PROGRESS', startedAt: { lt: twoHoursAgo } },
        data: { status: 'FAILED', outcome: 'stuck_recovered' },
      });
      return result.count;
    });
    if (recovered > 0) logger.warn(`Recovered ${recovered} stuck IN_PROGRESS call(s)`);
    return { recovered };
  }
);

// Every day at 9am UTC — check yesterday's platform spend, alert if over threshold
const dailyCostAlert = inngest.createFunction(
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

/** All Inngest functions, served at /api/inngest. */
export const functions = [
  weeklyBuddyDigest,
  weeklyCoachDigest,
  ponderScheduler,
  monthlyDonationDispatch,
  dailyEveningCalls,
  armingLoop,
  stakeCycleOpen,
  stakeCycleSettle,
  seasonAdvance,
  stuckCallRecovery,
  dailyCostAlert,
];
