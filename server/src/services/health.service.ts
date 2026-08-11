import { checkDatabase, prisma } from '../config/prisma.js';
import { checkRedis } from '../config/redis.js';
import { getMetricsSnapshot } from './metrics.service.js';

/**
 * Health reporting.
 *
 * Distinguishes three states deliberately:
 *  - `ok`      everything the API needs is reachable
 *  - `degraded` a non-essential dependency is down (Redis, or ingestion is stale):
 *              the API still serves correct data, just slower or less fresh
 *  - `down`    Postgres is unreachable, so nothing can be served
 *
 * Load balancers should use /health/live (process up) for restarts and /health for
 * dashboards, so a Redis outage never triggers a rolling restart of healthy pods.
 */

export type HealthState = 'ok' | 'degraded' | 'down';

interface DependencyHealth {
  status: 'ok' | 'down';
  latencyMs: number;
  error?: string;
}

interface WorkerHealth {
  status: 'ok' | 'stale' | 'unknown' | 'failing';
  lastRunAt: string | null;
  lastRunStatus: string | null;
  minutesSinceLastRun: number | null;
  recentFailures: number;
}

export interface HealthReport {
  status: HealthState;
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
  workers: WorkerHealth;
}

/** Ingestion is considered stale after this long without a successful run. */
const STALE_INGESTION_MINUTES = 45;

const getWorkerHealth = async (): Promise<WorkerHealth> => {
  try {
    const [lastRun, recentFailures] = await Promise.all([
      prisma.ingestionRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, finishedAt: true, status: true },
      }),
      prisma.ingestionRun.count({
        where: {
          status: 'FAILED',
          startedAt: { gte: new Date(Date.now() - 60 * 60_000) },
        },
      }),
    ]);

    if (!lastRun) {
      // No run recorded yet. On a fresh install this is expected, not a failure.
      return {
        status: 'unknown',
        lastRunAt: null,
        lastRunStatus: null,
        minutesSinceLastRun: null,
        recentFailures,
      };
    }

    const minutesSince = Math.floor((Date.now() - lastRun.startedAt.getTime()) / 60_000);
    const status: WorkerHealth['status'] =
      recentFailures >= 3 ? 'failing' : minutesSince > STALE_INGESTION_MINUTES ? 'stale' : 'ok';

    return {
      status,
      lastRunAt: lastRun.startedAt.toISOString(),
      lastRunStatus: lastRun.status,
      minutesSinceLastRun: minutesSince,
      recentFailures,
    };
  } catch {
    // The database check reports the real problem; do not double-fail here.
    return {
      status: 'unknown',
      lastRunAt: null,
      lastRunStatus: null,
      minutesSinceLastRun: null,
      recentFailures: 0,
    };
  }
};

export const getHealthReport = async (): Promise<HealthReport> => {
  // Each probe swallows its own failure and reports it as data, so `all` is safe
  // here and cannot reject.
  const [database, redis, workers] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    getWorkerHealth(),
  ]);

  const status: HealthState = !database.ok
    ? 'down'
    : !redis.ok || workers.status === 'stale' || workers.status === 'failing'
      ? 'degraded'
      : 'ok';

  return {
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    dependencies: {
      database: toDependency(database),
      redis: toDependency(redis),
    },
    workers,
  };
};

const toDependency = (result: { ok: boolean; latencyMs: number; error?: string }): DependencyHealth => ({
  status: result.ok ? 'ok' : 'down',
  latencyMs: result.latencyMs,
  ...(result.error ? { error: result.error } : {}),
});

/** HTTP status for a health report: 200 for ok/degraded, 503 only when unusable. */
export const healthStatusCode = (report: HealthReport): number =>
  report.status === 'down' ? 503 : 200;

export const getMetrics = getMetricsSnapshot;
