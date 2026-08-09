/**
 * In-process metrics registry.
 *
 * Deliberately dependency-free and bounded: it answers "is the system healthy right
 * now" for /health and the admin dashboard without requiring Prometheus. Counters are
 * per-process and reset on restart, which is the correct semantic for a liveness view.
 * Durable statistics (articles ingested, duplicates removed) live in Postgres instead.
 */

interface RequestSample {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

interface RouteStats {
  count: number;
  errorCount: number;
  totalMs: number;
  maxMs: number;
  /** Bounded ring of recent durations, for percentile estimates. */
  recent: number[];
}

const MAX_ROUTES = 200;
const RECENT_WINDOW = 100;

const routeStats = new Map<string, RouteStats>();

const counters = {
  requests: 0,
  errors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  providerFailures: 0,
  articlesIngested: 0,
  duplicatesDetected: 0,
  workerFailures: 0,
  breakingBroadcasts: 0,
};

export type CounterName = keyof typeof counters;

const startedAt = Date.now();

export const recordRequest = (sample: RequestSample): void => {
  counters.requests += 1;
  if (sample.statusCode >= 500) counters.errors += 1;

  const key = `${sample.method} ${sample.route}`;
  let stats = routeStats.get(key);
  if (!stats) {
    // Cap cardinality so an attacker hitting random paths cannot grow this unbounded.
    if (routeStats.size >= MAX_ROUTES) return;
    stats = { count: 0, errorCount: 0, totalMs: 0, maxMs: 0, recent: [] };
    routeStats.set(key, stats);
  }

  stats.count += 1;
  stats.totalMs += sample.durationMs;
  if (sample.durationMs > stats.maxMs) stats.maxMs = sample.durationMs;
  if (sample.statusCode >= 400) stats.errorCount += 1;
  stats.recent.push(sample.durationMs);
  if (stats.recent.length > RECENT_WINDOW) stats.recent.shift();
};

export const increment = (name: CounterName, by = 1): void => {
  counters[name] += by;
};

export const recordCacheHit = (): void => increment('cacheHits');
export const recordCacheMiss = (): void => increment('cacheMisses');

const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return round(sorted[index] ?? 0);
};

const round = (value: number): number => Math.round(value * 100) / 100;

export interface RouteMetric {
  route: string;
  count: number;
  errorCount: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  counters: Record<CounterName, number>;
  cacheHitRate: number | null;
  requestErrorRate: number | null;
  slowestRoutes: RouteMetric[];
  memory: { rssMb: number; heapUsedMb: number };
}

export const getMetricsSnapshot = (): MetricsSnapshot => {
  const routes: RouteMetric[] = [...routeStats.entries()].map(([route, stats]) => {
    const sorted = [...stats.recent].sort((a, b) => a - b);
    return {
      route,
      count: stats.count,
      errorCount: stats.errorCount,
      avgMs: round(stats.totalMs / stats.count),
      p95Ms: percentile(sorted, 0.95),
      maxMs: round(stats.maxMs),
    };
  });

  const cacheTotal = counters.cacheHits + counters.cacheMisses;
  const memory = process.memoryUsage();

  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    counters: { ...counters },
    cacheHitRate: cacheTotal === 0 ? null : round((counters.cacheHits / cacheTotal) * 100),
    requestErrorRate:
      counters.requests === 0 ? null : round((counters.errors / counters.requests) * 100),
    slowestRoutes: routes.sort((a, b) => b.avgMs - a.avgMs).slice(0, 10),
    memory: {
      rssMb: round(memory.rss / 1024 / 1024),
      heapUsedMb: round(memory.heapUsed / 1024 / 1024),
    },
  };
};

/** Test helper: clears all accumulated state. */
export const resetMetrics = (): void => {
  routeStats.clear();
  for (const key of Object.keys(counters) as CounterName[]) counters[key] = 0;
};
