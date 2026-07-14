import { initSentry, Sentry } from './lib/sentry';
initSentry();

import { config } from './config';
import logger from './utils/logger';
import prisma from './utils/prisma';
import cron from 'node-cron';
import buddyService from './services/buddy.service';
import { dispatchPendingDonations } from './services/every-org.service';
import callService from './services/call.service';
import seasonService from './services/season.service';
import coachService from './services/coach.service';
import insightService from './services/insight.service';
import { getServiceCostSummary } from './services/usage.service';
import { sendTelegramAdmin } from './utils/telegram-admin';
import {
  runArmingForStage,
  runPreCommitReminders,
  openStakeCyclesForActiveUsers,
  settleExpiredStakeCycles,
} from './services/arming.service';

logger.info(`Worker process started — env: ${config.server.env}`);

// Registered unconditionally — previously these lived inside registerCronJobs(),
// which only runs when Inngest is disabled. In Inngest mode (the active mode)
// that meant the worker had NO crash handling at all: an uncaught exception
// died silently, no Sentry event, no Telegram page, nothing.
process.on('uncaughtException', (error: Error) => {
  process.stdout.write(`[FATAL] Uncaught Exception: ${error.message}\n${error.stack}\n`);
  Sentry.captureException(error);
  sendTelegramAdmin(`💀 Ivy worker crashed (uncaughtException)\n\n${error.message}`).catch(() => {});
  Sentry.flush(2000).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason: unknown) => {
  process.stdout.write(`[WARN] Unhandled Rejection: ${String(reason)}\n`);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

// Exclusive cutover: when Inngest drives the schedule, the legacy node-cron jobs
// stand down so exactly one scheduler runs. Call/message delivery is no longer
// here at all — Phase 2 moved it to Inngest events (call/scheduled,
// message/*.requested), so the only thing this process still owns is the
// node-cron fallback for when Inngest is disabled (rollback path).
if (config.inngest.enabled) {
  logger.info('INNGEST_ENABLED=true — legacy node-cron jobs are disabled; Inngest Cloud owns the schedule and all call/message delivery.');
  sendTelegramAdmin('✅ Ivy worker started (Inngest mode — cron + call/message via Inngest)').catch(() => {});
} else {
  // Alert admin on startup so we know the worker is alive
  sendTelegramAdmin('✅ Ivy worker started').catch(() => {});
  registerCronJobs();
}

// Mirror of the Inngest withHeartbeat wrapper for the node-cron rollback path,
// so the watchdog and /health/jobs keep working when Inngest is disabled.
// Best-effort writes — a missing job_heartbeats table must not break a job.
function scheduleWithHeartbeat(jobName: string, expr: string, fn: () => Promise<void>): void {
  cron.schedule(expr, async () => {
    await prisma.jobHeartbeat.upsert({
      where: { jobName },
      update: { lastStartedAt: new Date(), lastStatus: 'RUNNING', lastError: null },
      create: { jobName, lastStartedAt: new Date(), lastStatus: 'RUNNING' },
    }).catch(() => {});
    try {
      await fn();
      await prisma.jobHeartbeat.update({
        where: { jobName },
        data: { lastFinishedAt: new Date(), lastStatus: 'SUCCESS' },
      }).catch(() => {});
    } catch (err: any) {
      await prisma.jobHeartbeat.update({
        where: { jobName },
        data: { lastFinishedAt: new Date(), lastStatus: 'FAILED', lastError: String(err?.message ?? err).slice(0, 2000) },
      }).catch(() => {});
      logger.error(`Cron ${jobName} failed:`, err);
    }
  });
}

function registerCronJobs(): void {

// Every Sunday at 9am UTC — weekly accountability buddy digests
scheduleWithHeartbeat('weekly-buddy-digest', '0 9 * * 0', async () => {
  logger.info('Running weekly buddy digest...');
  await buddyService.sendWeeklyDigests().catch((err) => logger.error('Buddy digest error:', err));
});

// Every Monday at 8am UTC — weekly coach client digest
scheduleWithHeartbeat('weekly-coach-digest', '0 8 * * 1', async () => {
  logger.info('Running weekly coach digest...');
  await coachService.sendWeeklyDigestToAllCoaches().catch((err) => logger.error('Coach digest error:', err));
});

// Every 30 minutes — schedule ponder calls for due coaches
scheduleWithHeartbeat('ponder-scheduler', '*/30 * * * *', async () => {
  await coachService.schedulePonderCallsForDueCoaches().catch((err) =>
    logger.warn('Ponder scheduler error:', err)
  );
});

// 1st of every month at 2am UTC — dispatch accumulated wallet donations to charities
scheduleWithHeartbeat('monthly-donation-dispatch', '0 2 1 * *', async () => {
  logger.info('Running monthly charity donation dispatch...');
  await dispatchPendingDonations().catch((err) => logger.error('Donation dispatch error:', err));
});

// Every day at midnight UTC — schedule today's EVENING calls for all active users
// (Morning live call replaced by VN arming loop for everyone — §1c.
//  scheduleDailyCalls now only schedules the evening review call.
//  Morning MORNING_PLANNING is opt-in preference only; arming = VN for all.)
scheduleWithHeartbeat('daily-evening-calls', '0 0 * * *', async () => {
  logger.info('Scheduling daily evening calls...');
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, isOnboarded: true, subscriptionTier: { notIn: ['FREE', 'COACH'] } },
      select: { id: true },
    });
    const today = new Date();
    let scheduled = 0;
    for (const user of users) {
      try {
        await callService.scheduleDailyCalls(user.id, today);
        scheduled++;
      } catch (err) {
        logger.warn(`Failed to schedule calls for ${user.id}:`, err);
      }
    }
    logger.info(`Scheduled calls for ${scheduled}/${users.length} users`);
  } catch (err) {
    logger.error('Daily call scheduling error:', err);
  }
});

// ── Arming loop — morning VN prompt + escalation ladder (Phase 3) ─────────
//
// Design: crons run every 15 minutes; runArmingForStage() checks each user's
// arming window against the current time with a ±7.5-minute tolerance window.
// This avoids per-user Bull-queue jobs while still delivering prompts within
// ~15 minutes of the user's chosen window. (15-min poll lets Neon scale to
// zero between cycles — keeps compute under the spending cap.)
//
// Stage timing relative to user's armingWindowStart (S) and armingWindowEnd (E):
//   PROMPT       — fires at S
//   REMINDER     — fires at S + 75 min (if still unarmed)
//   FINAL_NOTICE — fires at E − 15 min (if still unarmed; buddy nudge + optional ARMING_CHASE)
//   DEADLINE     — fires at E (unarmed → MISSED + FORFEITED)
//
// §1d: The morning VN is voice for ALL users regardless of CommStyle.
// §1e: Push primary; SMS fallback for PROMPT only if no push subscription.
// §9 d4b: ARMING_CHASE capped at 8/user/month, opt-in only.

scheduleWithHeartbeat('arming-loop', '*/15 * * * *', async () => {
  const now = new Date();
  await runArmingForStage('PROMPT', now).catch((err) =>
    logger.error('Arming PROMPT stage error:', err)
  );
  await runArmingForStage('REMINDER', now).catch((err) =>
    logger.error('Arming REMINDER stage error:', err)
  );
  await runArmingForStage('FINAL_NOTICE', now).catch((err) =>
    logger.error('Arming FINAL_NOTICE stage error:', err)
  );
  await runArmingForStage('DEADLINE', now).catch((err) =>
    logger.error('Arming DEADLINE stage error:', err)
  );
  await runPreCommitReminders(now).catch((err) =>
    logger.error('Pre-commit reminder error:', err)
  );
});

// ── StakeCycle open — every Monday at 00:05 UTC ───────────────────────────
// Opens a new weekly StakeCycle for all eligible users.
// Runs 5 min after midnight to let the daily call scheduler run first.
// openStakeCycle() guards against duplicate open cycles — safe to re-run.
scheduleWithHeartbeat('stakecycle-open', '5 0 * * 1', async () => {
  logger.info('Opening weekly StakeCycles...');
  await openStakeCyclesForActiveUsers().catch((err) =>
    logger.error('StakeCycle open job error:', err)
  );
});

// ── StakeCycle settle — every night at 23:55 UTC ──────────────────────────
// DAILY (not weekly): Foundation Runs end on any weekday, so settlement must
// sweep nightly. settleExpiredStakeCycles only touches cycles whose periodEnd
// has actually passed, so weekly cycles still settle on their Sunday.
// settleStakeCycle() captures forfeited slices and releases the rest.
// SAFETY: real Stripe capture — never run against production until Phase 2
// money-flow checkpoint is cleared (§ Phase 2 ✋).
scheduleWithHeartbeat('stakecycle-settle', '55 23 * * *', async () => {
  logger.info('Settling expired StakeCycles...');
  await settleExpiredStakeCycles().catch((err) =>
    logger.error('StakeCycle settle job error:', err)
  );
});

// Every day at 1am UTC — advance sprint and season statuses based on current date
scheduleWithHeartbeat('season-advance', '0 1 * * *', async () => {
  logger.info('Advancing sprint and season statuses...');
  await seasonService.advanceStatuses().catch((err) => logger.error('Season advance error:', err));
});

// Every day at 3am UTC — recover calls stuck in IN_PROGRESS (Retell outage safety net)
scheduleWithHeartbeat('stuck-call-recovery', '0 3 * * *', async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await prisma.call.updateMany({
      where: { status: 'IN_PROGRESS', startedAt: { lt: twoHoursAgo } },
      data: { status: 'FAILED', outcome: 'stuck_recovered' },
    });
    if (result.count > 0) {
      logger.warn(`Recovered ${result.count} stuck IN_PROGRESS call(s)`);
    }
  } catch (err) {
    logger.error('Stuck call recovery error:', err);
  }
});

// Every day at 3am UTC — distil that day's in-app chats into long-term memory
// (one Haiku extraction per user with new chat → callMemory, the store calls read).
scheduleWithHeartbeat('daily-chat-memory', '0 3 * * *', async () => {
  try {
    const rows = await prisma.message.findMany({
      where: { channel: 'IN_APP', direction: 'INBOUND', memoryExtractedAt: null },
      distinct: ['userId'],
      select: { userId: true },
    });
    let memories = 0;
    for (const { userId } of rows) {
      memories += await insightService.extractChatMemory(userId).catch(() => 0);
    }
    logger.info(`Chat memory: ${rows.length} users processed, ${memories} memories written`);
  } catch (err) {
    logger.error('Chat memory extraction error:', err);
  }
});

// Every day at 9am UTC — check yesterday's platform spend, alert if over threshold
scheduleWithHeartbeat('daily-cost-alert', '0 9 * * *', async () => {
  try {
    const threshold = parseFloat(process.env.COST_ALERT_THRESHOLD_GBP ?? '15');
    const summary = await getServiceCostSummary(1);
    const total = summary.reduce((sum, row) => sum + row.totalCostGbp, 0);
    const retell = summary.find((r) => r.service === 'retell')?.totalCostGbp ?? 0;

    logger.info(`Daily spend check — total £${total.toFixed(2)}, Retell £${retell.toFixed(2)}, threshold £${threshold}`);

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
    } catch (err) {
      logger.error('Cost alert job error:', err);
    }
  });
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  await prisma.$disconnect();
  logger.info('Database disconnected');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
