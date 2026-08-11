// Named import, not default: ioredis is CommonJS with `export = Redis`, which under
// NodeNext resolution makes the default import a namespace rather than the class.
import { Redis, type RedisOptions } from 'ioredis';
import { env } from './env.js';
import { log } from './logger.js';

const logger = log('redis');

/**
 * Redis is a *performance* dependency, not a correctness one: every read path must
 * still answer from Postgres when Redis is unavailable. `enableOfflineQueue: false`
 * enforces that — commands fail fast instead of piling up and stalling requests.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  lazyConnect: true,
  connectTimeout: 5_000,
  retryStrategy: (attempt) => Math.min(attempt * 250, 5_000),
};

const globalForRedis = globalThis as unknown as { redis?: Redis; redisSub?: Redis };

const attachLogging = (client: Redis, label: string): Redis => {
  let warned = false;
  client.on('error', (error: Error) => {
    // A dead Redis produces an error per command; log the first and then stay quiet.
    if (!warned) {
      warned = true;
      logger.warn({ err: error.message, label }, 'redis unavailable, degrading to database reads');
    }
  });
  client.on('ready', () => {
    warned = false;
    logger.info({ label }, 'redis connected');
  });
  return client;
};

const createClient = (label: string): Redis =>
  attachLogging(new Redis(env.REDIS_URL, baseOptions), label);

export const redis: Redis = globalForRedis.redis ?? createClient('main');

if (!env.isProduction) {
  globalForRedis.redis = redis;
}

/**
 * Separate connection for pub/sub. A subscribed ioredis connection cannot issue
 * normal commands, so breaking-news fan-out needs its own socket.
 */
export const getSubscriber = (): Redis => {
  globalForRedis.redisSub ??= createClient('subscriber');
  return globalForRedis.redisSub;
};

/**
 * BullMQ requires `maxRetriesPerRequest: null` and its own connection, and unlike the
 * cache it genuinely needs the offline queue. Workers call this instead of reusing `redis`.
 */
export const createQueueConnection = (): Redis =>
  attachLogging(
    new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
    }),
    'queue',
  );

export const connectRedis = async (): Promise<void> => {
  if (redis.status === 'wait') {
    try {
      await redis.connect();
    } catch (error) {
      logger.warn(
        { err: error instanceof Error ? error.message : error },
        'initial redis connection failed; continuing without cache',
      );
    }
  }
};

export const checkRedis = async (): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
  const startedAt = process.hrtime.bigint();
  try {
    const pong = await redis.ping();
    return {
      ok: pong === 'PONG',
      latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10,
      error: error instanceof Error ? error.message : 'unknown redis error',
    };
  }
};

export const disconnectRedis = async (): Promise<void> => {
  await Promise.allSettled([
    redis.quit(),
    globalForRedis.redisSub ? globalForRedis.redisSub.quit() : Promise.resolve(),
  ]);
};
