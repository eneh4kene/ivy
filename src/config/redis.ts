import Redis from 'ioredis';
import { config } from './index';
import logger from '../utils/logger';

// REDIS_URL takes precedence. Upstash uses rediss:// (TLS) — pass tls:{} explicitly
// so ioredis enables it regardless of URL parsing quirks.
function buildRedisClient(): Redis {
  const retry = (times: number) => Math.min(times * 50, 2000);
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return new Redis({
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      ...(process.env.REDIS_URL.startsWith('rediss://') ? { tls: {} } : {}),
      retryStrategy: retry,
      maxRetriesPerRequest: 3,
    });
  }
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: retry,
    maxRetriesPerRequest: 3,
  });
}

const redis = buildRedisClient();

// Handle connection events
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
  logger.info('Redis client disconnected');
});

export default redis;
