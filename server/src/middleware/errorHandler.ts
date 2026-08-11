import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { log } from '../config/logger.js';
import { AppError, NotFoundError, ValidationError, type ErrorCode } from '../utils/errors.js';
import { fail } from '../utils/response.js';

const logger = log('error');

/**
 * Client errors that still deserve a warning rather than debug, because a spike in
 * them indicates an attack or a broken integration rather than a typo.
 * 401 unauthorized, 403 forbidden, 429 rate limited.
 */
const SECURITY_RELEVANT_STATUSES = new Set([401, 403, 429]);

/** 404 for unmatched routes. Runs after all routers. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};

interface Normalized {
  statusCode: number;
  message: string;
  errorCode: ErrorCode;
  details?: unknown;
  /** Expected errors are logged at warn without a stack; bugs get error + stack. */
  operational: boolean;
}

const normalizePrismaError = (error: unknown): Normalized | null => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // `meta.target` is typed as unknown and varies by connector: an array of
        // column names, a single string, or absent. Passing an object through
        // String() would put a literal "[object Object]" in the client's error
        // message, so each shape is handled explicitly.
        const target: unknown = error.meta?.target;
        const fields = Array.isArray(target)
          ? target.filter((entry): entry is string => typeof entry === 'string').join(', ')
          : typeof target === 'string'
            ? target
            : 'field';
        return {
          statusCode: 409,
          message: `A record with this ${fields} already exists`,
          errorCode: 'CONFLICT',
          operational: true,
        };
      }
      case 'P2025':
        return {
          statusCode: 404,
          message: 'The requested record does not exist',
          errorCode: 'NOT_FOUND',
          operational: true,
        };
      case 'P2003':
        return {
          statusCode: 409,
          message: 'Related record constraint failed',
          errorCode: 'CONFLICT',
          operational: true,
        };
      default:
        return {
          statusCode: 500,
          message: 'Database request failed',
          errorCode: 'INTERNAL_ERROR',
          operational: false,
        };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: 503,
      message: 'Database is unavailable',
      errorCode: 'SERVICE_UNAVAILABLE',
      operational: true,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 500,
      message: 'Malformed database query',
      errorCode: 'INTERNAL_ERROR',
      operational: false,
    };
  }

  return null;
};

const normalize = (error: unknown): Normalized => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      errorCode: error.errorCode,
      details: error.details,
      operational: true,
    };
  }

  // A ZodError reaching here means a service (not the validate middleware) parsed input.
  if (error instanceof ZodError) {
    const validation = new ValidationError();
    return {
      statusCode: validation.statusCode,
      message: validation.message,
      errorCode: validation.errorCode,
      details: error.issues,
      operational: true,
    };
  }

  const prismaError = normalizePrismaError(error);
  if (prismaError) return prismaError;

  // Body parser failures arrive as SyntaxError with a `body` property.
  if (error instanceof SyntaxError && 'body' in error) {
    return {
      statusCode: 400,
      message: 'Malformed JSON in request body',
      errorCode: 'VALIDATION_ERROR',
      operational: true,
    };
  }

  return {
    statusCode: 500,
    message: 'Something went wrong',
    errorCode: 'INTERNAL_ERROR',
    operational: false,
  };
};

/**
 * Centralized error handler. Must be registered last.
 *
 * Unexpected errors never leak their message to the client in production: the client
 * gets a stable errorCode while the full stack goes to the logs.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    // Too late to change the response; hand off to Express to close the socket.
    next(error);
    return;
  }

  const normalized = normalize(error);
  const context = {
    method: req.method,
    url: req.originalUrl,
    statusCode: normalized.statusCode,
    errorCode: normalized.errorCode,
    requestId: res.getHeader('x-request-id'),
  };

  if (!normalized.operational) {
    logger.error(
      { ...context, err: error instanceof Error ? { message: error.message, stack: error.stack } : error },
      'unhandled error',
    );
  } else if (SECURITY_RELEVANT_STATUSES.has(normalized.statusCode)) {
    // Auth failures and throttling are worth surfacing: a burst of them is a signal.
    logger.warn(context, normalized.message);
  } else {
    // Routine client mistakes (404 on a mistyped URL, 422 on a bad query string) are
    // normal traffic for a public API, not warnings. The access log already records
    // every request with its status, so logging these at warn produced two WARN lines
    // per request and buried the errors that actually matter.
    logger.debug(context, normalized.message);
  }

  const exposeMessage = normalized.operational || !env.isProduction;
  const message =
    exposeMessage && error instanceof Error && !normalized.operational
      ? `${normalized.message}: ${error.message}`
      : normalized.message;

  fail(res, normalized.statusCode, message, normalized.errorCode, normalized.details);
};
