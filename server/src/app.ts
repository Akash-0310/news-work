import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { requestId, requestLogger, responseTimeMetrics } from './middleware/requestContext.js';
import { apiRouter } from './routes/index.js';
import { healthRouter } from './routes/health.routes.js';
import { rootRouter } from './routes/root.routes.js';

/**
 * Express application factory.
 *
 * Exported without calling `listen` so integration tests can drive it with supertest
 * on an ephemeral port, and so the same wiring serves both the HTTP and WebSocket
 * entrypoints in server.ts.
 *
 * Middleware order is deliberate and load-bearing; see the comments below.
 */
export const createApp = (): Express => {
  const app = express();

  // Trust the reverse proxy so `req.ip` is the real client address. Without this the
  // rate limiter would bucket every request behind a load balancer under one IP.
  app.set('trust proxy', 1);
  // Do not advertise the framework.
  app.disable('x-powered-by');
  app.set('json spaces', 0);

  // 1. Identity and observability first, so even rejected requests are traceable.
  app.use(requestId);
  app.use(requestLogger);
  app.use(responseTimeMetrics);

  // 2. Security headers before anything can produce a response body.
  app.use(
    helmet({
      // This is a JSON API: it never renders HTML, so a restrictive CSP costs nothing
      // and blocks any injected content from executing if a response is ever framed.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      // Allow the SPA on another origin to read images/JSON returned by the API.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // 180 days, and only meaningful over TLS in production.
      hsts: env.isProduction ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin, server-to-server and curl requests send no Origin header.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        // Non-throwing rejection: the browser blocks the read, and the server logs
        // a normal 200/4xx rather than a 500 from an uncaught CORS error.
        return callback(null, false);
      },
      // Required for the refresh-token cookie to be sent cross-origin.
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 86_400,
    }),
  );

  // 3. Body parsing with a small cap: no endpoint accepts large payloads, so a low
  // limit removes a trivial memory-exhaustion vector.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(compression());

  // 4. Health and the service descriptor before the rate limiter: probes must never be
  // throttled, and `/` should answer even when a client is over its quota.
  app.use('/health', healthRouter);
  app.use('/', rootRouter);

  // 5. Rate limiting, then the API itself.
  app.use('/api', globalRateLimit, apiRouter);

  // 6. Terminal handlers, in this order.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
