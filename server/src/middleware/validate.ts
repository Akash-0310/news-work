import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Zod request validation.
 *
 * Parsed output *replaces* the raw input on the request, so downstream code receives
 * coerced, typed values (numbers as numbers, dates as Dates) and can never accidentally
 * read an unvalidated field.
 */

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Flattens zod issues into `{ "field.path": ["message"] }` for the error envelope. */
const formatIssues = (error: ZodError): Record<string, string[]> => {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    const existing = fields[key];
    if (existing) existing.push(issue.message);
    else fields[key] = [issue.message];
  }
  return fields;
};

export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        // Express 4's `req.query` is a getter on some versions; redefine rather than assign.
        const parsedQuery = schemas.query.parse(req.query) as unknown;
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as unknown;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Request validation failed', formatIssues(error)));
        return;
      }
      next(error);
    }
  };

/** Helper for typing a validated handler's request without repeating generics. */
export type Validated<S extends RequestSchemas> = Request<
  S['params'] extends ZodTypeAny ? z.infer<S['params']> : Record<string, string>,
  unknown,
  S['body'] extends ZodTypeAny ? z.infer<S['body']> : unknown,
  S['query'] extends ZodTypeAny ? z.infer<S['query']> : Record<string, unknown>
>;
