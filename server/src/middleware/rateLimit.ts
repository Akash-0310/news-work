import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { log } from '../config/logger.js';
import { redis } from '../config/redis.js';
import { RateLimitError } from '../utils/errors.js';

const logger = log('rate-limit');

/**
 * Redis-backed fixed-window rate limiter.
 *
 * Redis rather than in-memory so the limit is shared across every API instance:
 * an in-memory counter multiplies the effective limit by the number of replicas.
 *
 * Fail-open by design. If Redis is unavailable the request is allowed through,
 * because dropping all traffic during a cache outage is a worse failure than
 * temporarily losing rate limiting. Abuse protection at the edge (CDN/WAF) is the
 * backstop for that window.
 */

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  /** Key prefix, so different limiters (global, auth, search) count separately. */
  bucket?: string;
  /** Override the identity used for counting; defaults to authenticated user or IP. */
  keyResolver?: (req: Request) => string;
  message?: string;
}

const defaultKeyResolver = (req: Request): string => {
  // Prefer the authenticated user id: it survives NAT and shared IPs, and stops one
  // user on a corporate network from exhausting everyone else's quota.
  const userId = req.user?.id;
  if (userId) return `u:${userId}`;
  return `ip:${req.ip ?? 'unknown'}`;
};

export const rateLimit = (options: RateLimitOptions = {}): RequestHandler => {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? env.RATE_LIMIT_MAX;
  const bucket = options.bucket ?? 'global';
  const resolveKey = options.keyResolver ?? defaultKeyResolver;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  return (req, res, next) => {
    // Fixed window: the key embeds the window index, so expiry is self-managing.
    const windowIndex = Math.floor(Date.now() / windowMs);
    const key = `ratelimit:${bucket}:${resolveKey(req)}:${windowIndex}`;

    void (async () => {
      try {
        // INCR + EXPIRE in one round trip; EXPIRE is idempotent within the window.
        // `exec()` resolves to an array of [error, result] pairs, or null if the
        // transaction was discarded.
        const results = await redis.multi().incr(key).expire(key, windowSeconds).exec();

        // Optional chaining covers both a discarded transaction (`results` null) and
        // an INCR that errored: either way the element is not `null`.
        const incrResult = results?.[0];
        if (incrResult?.[0] !== null) {
          // Transaction discarded or INCR errored: fail open rather than block traffic.
          next();
          return;
        }

        const used = Number(incrResult[1]);
        if (!Number.isFinite(used)) {
          next();
          return;
        }

        const remaining = Math.max(0, max - used);

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(windowSeconds));

        if (used > max) {
          res.setHeader('Retry-After', String(windowSeconds));
          next(new RateLimitError(options.message, windowSeconds));
          return;
        }

        next();
      } catch (error) {
        logger.debug(
          { err: error instanceof Error ? error.message : error },
          'rate limiter unavailable, allowing request',
        );
        next();
      }
    })();
  };
};

/** Broad limiter applied to the whole API surface. */
export const globalRateLimit = rateLimit({ bucket: 'api' });

/**
 * Tight limiter for credential endpoints, keyed by IP even when authenticated so
 * password guessing cannot be spread across accounts.
 */
export const authRateLimit = rateLimit({
  bucket: 'auth',
  max: env.AUTH_RATE_LIMIT_MAX,
  windowMs: 15 * 60_000,
  keyResolver: (req) => `ip:${req.ip ?? 'unknown'}`,
  message: 'Too many authentication attempts. Please try again later.',
});

/** Search hits the database harder than a cached feed, so it gets its own budget. */
export const searchRateLimit = rateLimit({ bucket: 'search', max: 30, windowMs: 60_000 });
