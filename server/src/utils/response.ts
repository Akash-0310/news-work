import type { Response } from 'express';
import type { ErrorCode } from './errors.js';

/**
 * Every response the API produces goes through one of these helpers, so the
 * contract in the README is guaranteed by construction rather than by convention.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessBody<T> {
  success: true;
  data: T;
  message: string;
  pagination?: PaginationMeta;
  meta?: Record<string, unknown>;
}

export interface ErrorBody {
  success: false;
  message: string;
  errorCode: ErrorCode;
  details?: unknown;
}

export const buildPagination = (page: number, limit: number, total: number): PaginationMeta => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/**
 * These helpers return `void`, not the Express `Response`.
 *
 * Express declares `Response` with `any` type parameters, so returning it would hand
 * every caller an unchecked value and defeat the whole point of the typed envelope.
 * Nothing uses the return value -- controllers call these as statements -- so `void`
 * costs nothing and keeps the boundary type-safe.
 *
 * The body arguments are still checked against SuccessBody/ErrorBody below, which is
 * where the contract actually matters.
 */

export const ok = <T>(
  res: Response,
  data: T,
  message = 'Success',
  meta?: Record<string, unknown>,
): void => {
  const body: SuccessBody<T> = { success: true, data, message, ...(meta ? { meta } : {}) };
  res.status(200).json(body);
};

export const created = <T>(res: Response, data: T, message = 'Created'): void => {
  const body: SuccessBody<T> = { success: true, data, message };
  res.status(201).json(body);
};

export const noContent = (res: Response, message = 'Deleted'): void => {
  const body: SuccessBody<null> = { success: true, data: null, message };
  res.status(200).json(body);
};

export const paginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = 'Success',
  meta?: Record<string, unknown>,
): void => {
  const body: SuccessBody<T[]> = {
    success: true,
    data,
    pagination,
    message,
    ...(meta ? { meta } : {}),
  };
  res.status(200).json(body);
};

export const fail = (
  res: Response,
  statusCode: number,
  message: string,
  errorCode: ErrorCode,
  details?: unknown,
): void => {
  const body: ErrorBody = {
    success: false,
    message,
    errorCode,
    ...(details === undefined ? {} : { details }),
  };
  res.status(statusCode).json(body);
};
