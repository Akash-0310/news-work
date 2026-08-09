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

export const ok = <T>(
  res: Response,
  data: T,
  message = 'Success',
  meta?: Record<string, unknown>,
): Response<SuccessBody<T>> => res.status(200).json({ success: true, data, message, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T, message = 'Created'): Response<SuccessBody<T>> =>
  res.status(201).json({ success: true, data, message });

export const noContent = (res: Response, message = 'Deleted'): Response<SuccessBody<null>> =>
  res.status(200).json({ success: true, data: null, message });

export const paginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message = 'Success',
  meta?: Record<string, unknown>,
): Response<SuccessBody<T[]>> =>
  res.status(200).json({
    success: true,
    data,
    pagination,
    message,
    ...(meta ? { meta } : {}),
  });

export const fail = (
  res: Response,
  statusCode: number,
  message: string,
  errorCode: ErrorCode,
  details?: unknown,
): Response<ErrorBody> =>
  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    ...(details === undefined ? {} : { details }),
  });
