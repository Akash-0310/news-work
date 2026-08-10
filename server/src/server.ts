import type { Server } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectPrisma } from './config/prisma.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { toErrorMessage } from './utils/errors.js';

/**
 * HTTP entrypoint.
 *
 * Owns process lifecycle only: start listening, then shut down cleanly. All wiring
 * lives in app.ts so tests never start a real listener.
 */

/** Node attaches a `code` to syscall failures; `Error` alone does not describe it. */
interface SystemError extends Error {
  code?: string;
  syscall?: string;
}

const isSystemError = (error: unknown): error is SystemError =>
  error instanceof Error && 'code' in error;

/**
 * Turns a listen failure into an actionable message.
 *
 * Without this, `EADDRINUSE` propagates as an unhandled 'error' event, which Node
 * rethrows into the uncaughtException handler. That path then tries a graceful
 * shutdown of a server that never started, producing a confusing "Server is not
 * running" error on top of the real problem.
 */
const describeListenError = (error: unknown, port: number): string => {
  if (!isSystemError(error)) return toErrorMessage(error);

  switch (error.code) {
    case 'EADDRINUSE':
      return [
        `Port ${port} is already in use.`,
        'Another process is listening on it, most likely an earlier `npm run dev:server`',
        'that is still running.',
        '',
        'Find and stop it:',
        `  PowerShell:   Get-NetTCPConnection -LocalPort ${port} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`,
        `  macOS/Linux:  lsof -ti :${port} | xargs kill`,
        '',
        `Or run on a different port by setting PORT in .env (currently ${port}).`,
      ].join('\n');

    case 'EACCES':
      return `Permission denied binding to port ${port}. Ports below 1024 require elevated privileges; set PORT in .env to something above 1024.`;

    case 'EADDRNOTAVAIL':
      return `Cannot bind to port ${port}: the requested address is not available on this machine.`;

    default:
      return `Failed to bind to port ${port}: ${error.message}`;
  }
};

/**
 * Promisified listen.
 *
 * The 'error' listener is attached before the event loop can deliver a failure, so a
 * bind error becomes a rejected promise rather than an uncaught exception.
 */
const listen = (app: Express, port: number): Promise<Server> =>
  new Promise<Server>((resolve, reject) => {
    const server = app.listen(port);

    const onError = (error: Error): void => {
      server.removeListener('listening', onListening);
      reject(error);
    };

    function onListening(): void {
      server.removeListener('error', onError);
      resolve(server);
    }

    server.once('error', onError);
    server.once('listening', onListening);
  });

const start = async (): Promise<void> => {
  // Best-effort: a missing Redis must not stop the API from booting, because every
  // read path can still answer from Postgres.
  await connectRedis();

  const app = createApp();

  let server: Server;
  try {
    server = await listen(app, env.PORT);
  } catch (error) {
    // Log the friendly explanation, not a stack trace: the stack of an EADDRINUSE
    // points at Node internals and tells the reader nothing useful.
    logger.fatal(describeListenError(error, env.PORT));
    await shutdownDependencies();
    process.exit(1);
  }

  logger.info(
    {
      port: env.PORT,
      // `env` is deliberately omitted: the logger's `base` already emits it, and
      // repeating it here produced a duplicate key in the JSON line, which log
      // aggregators resolve inconsistently (last-wins, first-wins, or parse error).
      clientUrl: env.CLIENT_URL,
      providers: env.enabledProviders,
    },
    `NewsFlow API listening on http://localhost:${env.PORT}`,
  );

  // Node's default of no timeout leaves sockets from dead clients open indefinitely.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  // Errors after a successful bind (e.g. a client socket fault) must not be fatal.
  server.on('error', (error: Error) => {
    logger.error({ err: toErrorMessage(error) }, 'http server error');
  });

  registerShutdownHandlers(server);
};

const shutdownDependencies = async (): Promise<void> => {
  const results = await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.warn({ err: toErrorMessage(result.reason) }, 'error during dependency shutdown');
    }
  }
};

/**
 * Graceful shutdown.
 *
 * Stops accepting new connections, lets in-flight requests finish, then closes the
 * database and Redis handles. A hard timer guarantees the process actually exits even
 * if a socket refuses to drain, which otherwise causes a container to hang until it is
 * force-killed, dropping in-flight requests.
 *
 * Only registered once the server is genuinely listening, so shutdown never runs
 * against a server that failed to start.
 */
const registerShutdownHandlers = (server: Server): void => {
  let shuttingDown = false;
  const FORCE_EXIT_MS = 15_000;

  const shutdown = (signal: string, exitCode = 0): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      logger.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, FORCE_EXIT_MS);
    // Do not let the timer itself keep the event loop alive.
    forceExit.unref();

    const finish = (): void => {
      void shutdownDependencies().then(() => {
        clearTimeout(forceExit);
        logger.info('shutdown complete');
        process.exit(exitCode);
      });
    };

    if (!server.listening) {
      finish();
      return;
    }

    server.close((closeError) => {
      if (closeError) {
        logger.error({ err: toErrorMessage(closeError) }, 'error closing http server');
      }
      finish();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // An unhandled rejection or uncaught exception leaves the process in an unknown
  // state. Log it with full context, then exit non-zero so the orchestrator restarts
  // a clean instance rather than serving traffic from a corrupted one.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: toErrorMessage(reason) }, 'unhandled promise rejection');
    shutdown('unhandledRejection', 1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error.message, stack: error.stack }, 'uncaught exception');
    shutdown('uncaughtException', 1);
  });
};

void start().catch((error: unknown) => {
  logger.fatal({ err: toErrorMessage(error) }, 'failed to start server');
  process.exit(1);
});
