import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
// Named import for the same CJS interop reason as ioredis in config/redis.ts.
import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';
import { recordRequest } from '../services/metrics.service.js';

/**
 * Assigns a request id (honouring an upstream `x-request-id`) and echoes it back.
 * Every log line and error response for the request carries the same id, which is
 * what makes a production trace followable.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  next();
};

/** Structured access logging plus response-time metrics. */
export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: (_req, res) => String(res.getHeader('x-request-id') ?? randomUUID()),
  // Health polling, browser favicon probes and CORS preflights would otherwise
  // dominate log volume without ever carrying information.
  autoLogging: {
    ignore: (req) =>
      req.method === 'OPTIONS' ||
      req.url === '/favicon.ico' ||
      req.url === '/health' ||
      req.url === '/health/live',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  // pino-http types its serializer parameters as `any`, which silently turns every
  // field access below into an unchecked read. Annotating them structurally restores
  // type checking without needing pino's internal types.
  serializers: {
    req: (req: { id?: unknown; method?: string; url?: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
});

/**
 * Records per-route latency and status into the in-process metrics registry used by
 * the admin dashboard and /health.
 */
export const responseTimeMetrics: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // `req.route` is only populated once a handler matched, and Express types it as
    // `any`. Narrow it explicitly so the path read below is checked; fall back to the
    // raw path for unmatched requests (404s), which have no route.
    const route: unknown = req.route;
    const routePath =
      typeof route === 'object' && route !== null && 'path' in route && typeof route.path === 'string'
        ? route.path
        : req.path;

    recordRequest({
      method: req.method,
      // Grouping by route template rather than by concrete URL is what keeps the
      // metrics registry's cardinality bounded.
      route: `${req.baseUrl}${routePath}` || req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });
  next();
};
