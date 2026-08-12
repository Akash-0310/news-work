/**
 * Application error hierarchy.
 *
 * Anything thrown as an `AppError` is considered *expected*: the centralized error
 * handler turns it into the documented error envelope with its status and code.
 * Anything else is a bug, gets logged with a stack trace, and becomes a generic 500.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NEWS_FETCH_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly errorCode: ErrorCode;
  /** Machine-readable extras, e.g. zod field issues. Safe to send to the client. */
  readonly details?: unknown;
  /** `true` for errors we deliberately produce; the handler will not log a stack. */
  readonly isOperational = true;

  constructor(message: string, statusCode: number, errorCode: ErrorCode, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    // V8-only, but @types/node declares it as always present, so no guard is needed.
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', errorCode: ErrorCode = 'UNAUTHORIZED') {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please slow down', retryAfterSeconds?: number) {
    super(message, 429, 'RATE_LIMITED', retryAfterSeconds ? { retryAfterSeconds } : undefined);
  }
}

/** An upstream news provider failed. Never fatal: other providers keep working. */
export class ProviderError extends AppError {
  readonly providerKey: string;

  constructor(providerKey: string, message: string, details?: unknown) {
    super(message, 502, 'PROVIDER_UNAVAILABLE', details);
    this.providerKey = providerKey;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError || (error instanceof Error && 'isOperational' in error);

/** Normalizes anything throwable into a message string for logs. */
export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'unserializable error';
  }
};
