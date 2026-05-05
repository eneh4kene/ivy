import Queue from 'bull';
import { config } from './index';
import logger from '../utils/logger';

// Bull accepts either a Redis URL string or an options object.
// REDIS_URL is injected by Railway/Heroku/Render; individual vars are the fallback.
const redisOptions: string | { host: string; port: number; password?: string } =
  process.env.REDIS_URL
    ? process.env.REDIS_URL
    : {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      };

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

// Queue event listeners
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
