import { Prisma, PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { log } from './logger.js';

const logger = log('prisma');

/**
 * Single Prisma client for the process.
 *
 * Cached on `globalThis` because tsx/vitest hot-reload re-evaluates modules, and a
 * fresh PrismaClient per reload exhausts the Postgres connection limit within minutes.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const createClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
      ...(env.isDevelopment ? ([{ emit: 'event', level: 'query' }] as const) : []),
    ],
  });

  client.$on('warn', (event) => logger.warn({ target: event.target }, event.message));
  client.$on('error', (event) => logger.error({ target: event.target }, event.message));

  if (env.isDevelopment) {
    // Surface slow queries during development so missing indexes are obvious.
    client.$on('query', (event) => {
      if (event.duration >= 200) {
        logger.warn({ durationMs: event.duration, query: event.query }, 'slow query');
      } else {
        logger.trace({ durationMs: event.duration }, event.query);
      }
    });
  }

  return client;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

/** Cheap liveness probe used by /health. */
export const checkDatabase = async (): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
  const startedAt = process.hrtime.bigint();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: elapsedMs(startedAt) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: elapsedMs(startedAt),
      error: error instanceof Error ? error.message : 'unknown database error',
    };
  }
};

const elapsedMs = (startedAt: bigint): number =>
  Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10;

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};

/** Re-exported so repositories can use Prisma helpers without importing the package directly. */
export { Prisma };
