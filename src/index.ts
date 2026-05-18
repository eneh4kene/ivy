import { initSentry } from './lib/sentry';
initSentry(); // must be first

import app from './app';
import { config } from './config';
import logger from './utils/logger';
import prisma from './utils/prisma';
import cron from 'node-cron';
import buddyService from './services/buddy.service';
import { dispatchPendingDonations } from './services/every-org.service';
import callService from './services/call.service';
import seasonService from './services/season.service';
import coachService from './services/coach.service';
import './workers/call.processor';    // start call Bull worker
import './workers/message.processor'; // start message Bull worker

const PORT = config.server.port;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Ivy Backend API running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.env}`);
  logger.info(`🔗 Base URL: ${config.server.baseUrl}`);
});

// Every Sunday at 9am UTC — weekly accountability buddy digests
cron.schedule('0 9 * * 0', async () => {
  logger.info('Running weekly buddy digest...');
  await buddyService.sendWeeklyDigests();
});

// Every Monday at 8am UTC — weekly coach client digest
cron.schedule('0 8 * * 1', async () => {
  logger.info('Running weekly coach digest...');
  await coachService.sendWeeklyDigestToAllCoaches();
});

// 1st of every month at 2am UTC — dispatch accumulated wallet donations to charities
cron.schedule('0 2 1 * *', async () => {
  logger.info('Running monthly charity donation dispatch...');
  await dispatchPendingDonations();
});

// Every day at midnight UTC — schedule today's calls for all active users
cron.schedule('0 0 * * *', async () => {
  logger.info('Scheduling daily calls...');
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
});

// Every day at 1am UTC — advance sprint and season statuses based on current date
cron.schedule('0 1 * * *', async () => {
  logger.info('Advancing sprint and season statuses...');
  await seasonService.advanceStatuses();
});

// Every day at 3am UTC — recover calls stuck in IN_PROGRESS (Retell outage safety net)
cron.schedule('0 3 * * *', async () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const result = await prisma.call.updateMany({
    where: { status: 'IN_PROGRESS', startedAt: { lt: twoHoursAgo } },
    data: { status: 'FAILED', outcome: 'stuck_recovered' },
  });
  if (result.count > 0) {
    logger.warn(`Recovered ${result.count} stuck IN_PROGRESS call(s)`);
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Promise Rejection:', reason);
  throw reason;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default server;
