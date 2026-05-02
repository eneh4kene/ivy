import { initSentry } from './lib/sentry';
initSentry(); // must be first

import app from './app';
import { config } from './config';
import logger from './utils/logger';
import prisma from './utils/prisma';
import cron from 'node-cron';
import buddyService from './services/buddy.service';

const PORT = config.server.port;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Ivy Backend API running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.env}`);
  logger.info(`🔗 Base URL: ${config.server.baseUrl}`);
});

// Every Sunday at 9am UTC — send weekly accountability buddy digests
cron.schedule('0 9 * * 0', async () => {
  logger.info('Running weekly buddy digest...');
  await buddyService.sendWeeklyDigests();
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
