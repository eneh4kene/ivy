process.stdout.write('[BOOT] index.ts loaded\n');

import { initSentry } from './lib/sentry';
process.stdout.write('[BOOT] sentry import done\n');
initSentry(); // must be first
process.stdout.write('[BOOT] sentry init done\n');

import app from './app';
process.stdout.write('[BOOT] app import done\n');
import { config } from './config';
process.stdout.write('[BOOT] config import done\n');
import logger from './utils/logger';
process.stdout.write('[BOOT] logger import done\n');
import prisma from './utils/prisma';
process.stdout.write('[BOOT] prisma import done\n');
import cron from 'node-cron';
import buddyService from './services/buddy.service';
import { dispatchPendingDonations } from './services/every-org.service';
import callService from './services/call.service';
import seasonService from './services/season.service';
import coachService from './services/coach.service';
import { getServiceCostSummary } from './services/usage.service';
import { sendTelegramAdmin } from './utils/telegram-admin';
process.stdout.write('[BOOT] service imports done\n');
import './workers/call.processor';    // start call Bull worker
process.stdout.write('[BOOT] call processor import done\n');
import './workers/message.processor'; // start message Bull worker
process.stdout.write('[BOOT] message processor import done\n');

const PORT = config.server.port;

// Register exception handlers BEFORE listen so server errors are caught
process.on('uncaughtException', (error: Error) => {
  process.stdout.write(`[FATAL] Uncaught Exception: ${error.message}\n${error.stack}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  process.stdout.write(`[WARN] Unhandled Rejection: ${String(reason)}\n`);
  // Do not re-throw — Prisma and Bull emit internal rejections on connection drops
});

process.stdout.write(`[BOOT] calling app.listen on port ${PORT}\n`);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Ivy Backend API running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.env}`);
  logger.info(`🔗 Base URL: ${config.server.baseUrl}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  process.stdout.write(`[FATAL] Server failed to bind: ${err.code} ${err.message}\n`);
  process.exit(1);
});

// Every Sunday at 9am UTC — weekly accountability buddy digests
cron.schedule('0 9 * * 0', async () => {
  logger.info('Running weekly buddy digest...');
  await buddyService.sendWeeklyDigests().catch((err) => logger.error('Buddy digest error:', err));
});

// Every Monday at 8am UTC — weekly coach client digest
cron.schedule('0 8 * * 1', async () => {
  logger.info('Running weekly coach digest...');
  await coachService.sendWeeklyDigestToAllCoaches().catch((err) => logger.error('Coach digest error:', err));
});

// Every 30 minutes — schedule ponder calls for due coaches
cron.schedule('*/30 * * * *', async () => {
  await coachService.schedulePonderCallsForDueCoaches().catch((err) =>
    logger.warn('Ponder scheduler error:', err)
  );
});

// 1st of every month at 2am UTC — dispatch accumulated wallet donations to charities
cron.schedule('0 2 1 * *', async () => {
  logger.info('Running monthly charity donation dispatch...');
  await dispatchPendingDonations().catch((err) => logger.error('Donation dispatch error:', err));
});

// Every day at midnight UTC — schedule today's calls for all active users
cron.schedule('0 0 * * *', async () => {
  logger.info('Scheduling daily calls...');
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

// Every day at 1am UTC — advance sprint and season statuses based on current date
cron.schedule('0 1 * * *', async () => {
  logger.info('Advancing sprint and season statuses...');
  await seasonService.advanceStatuses().catch((err) => logger.error('Season advance error:', err));
});

// Every day at 3am UTC — recover calls stuck in IN_PROGRESS (Retell outage safety net)
cron.schedule('0 3 * * *', async () => {
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

// Every day at 9am UTC — check yesterday's platform spend, alert if over threshold
cron.schedule('0 9 * * *', async () => {
  try {
    const threshold = parseFloat(process.env.COST_ALERT_THRESHOLD_GBP ?? '15');
    const summary = await getServiceCostSummary(1); // last 24h
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

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Database disconnected');

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// (uncaughtException and unhandledRejection handlers registered above, before app.listen)

export default server;
