process.stdout.write('[BOOT] index.ts loaded\n');

import { initSentry, Sentry } from './lib/sentry';
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
import { sendTelegramAdmin } from './utils/telegram-admin';

const PORT = config.server.port;

// Register exception handlers BEFORE listen so server errors are caught
process.on('uncaughtException', (error: Error) => {
  process.stdout.write(`[FATAL] Uncaught Exception: ${error.message}\n${error.stack}\n`);
  // Sentry.captureException sends async — process.exit(1) right after would
  // race the network call and the event can be dropped on exactly the crashes
  // most worth seeing. Flush (2s cap) before exiting.
  Sentry.captureException(error);
  sendTelegramAdmin(`💀 Ivy API crashed (uncaughtException)\n\n${error.message}`).catch(() => {});
  Sentry.flush(2000).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason: unknown) => {
  process.stdout.write(`[WARN] Unhandled Rejection: ${String(reason)}\n`);
  // Do not re-throw — Prisma and Bull emit internal rejections on connection drops
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
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

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// (uncaughtException and unhandledRejection handlers registered above, before app.listen)

export default server;
