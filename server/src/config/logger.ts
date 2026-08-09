import pino, { type Logger } from 'pino';
import { env } from './env.js';

/**
 * Structured logger. JSON in production so logs are machine-parseable by any
 * aggregator; pretty-printed in development for human eyes.
 *
 * Redaction is defence in depth: even if a handler logs a whole request or
 * config object by mistake, credentials never reach the log stream.
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'newsflow-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      '*.password',
      '*.passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      '*.apiKey',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
    ],
    censor: '[redacted]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,env',
          singleLine: false,
        },
      },
});

/** Child logger tagged with a subsystem name, e.g. `log('worker:news-fetch')`. */
export const log = (scope: string): Logger => logger.child({ scope });
