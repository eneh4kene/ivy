import Queue from 'bull';
import { config } from './index';
import logger from '../utils/logger';

// Bull doesn't enable TLS from a rediss:// URL string — must parse and pass tls: {} explicitly.
function buildRedisConfig(): { host: string; port: number; password?: string; tls?: object } {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      ...(process.env.REDIS_URL.startsWith('rediss://') ? { tls: {} } : {}),
    };
  }
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  };
}

const redisOptions = buildRedisConfig();

// Create queues
export const callScheduleQueue = new Queue('call-schedule', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
});

export const messageQueue = new Queue('messages', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const donationQueue = new Queue('donations', {
  redis: redisOptions,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

// Queue event listeners — error handler is critical: without it, a Redis connection
// failure emits an unhandled 'error' event and Node.js crashes the process.
[callScheduleQueue, messageQueue, donationQueue].forEach((q) => {
  q.on('error', (err) => logger.error(`Queue ${q.name} error:`, err));
});

callScheduleQueue.on('completed', (job) => {
  logger.info(`Call schedule job ${job.id} completed`);
});

callScheduleQueue.on('failed', (job, err) => {
  logger.error(`Call schedule job ${job?.id} failed:`, err);
});

callScheduleQueue.on('stalled', (job) => {
  logger.warn(`Call schedule job ${job.id} stalled`);
});

messageQueue.on('completed', (job) => {
  logger.info(`Message job ${job.id} completed`);
});

messageQueue.on('failed', (job, err) => {
  logger.error(`Message job ${job?.id} failed:`, err);
});

donationQueue.on('completed', (job) => {
  logger.info(`Donation job ${job.id} completed`);
});

donationQueue.on('failed', (job, err) => {
  logger.error(`Donation job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Closing Bull queues...');
  await Promise.all([
    callScheduleQueue.close(),
    messageQueue.close(),
    donationQueue.close(),
  ]);
  logger.info('Bull queues closed');
});

export default {
  callScheduleQueue,
  messageQueue,
  donationQueue,
};
