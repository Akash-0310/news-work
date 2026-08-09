import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not catch rejected promises from async handlers: an unhandled
 * rejection would hang the request and bypass the error middleware entirely.
 * Every async route handler is wrapped in this.
 */
export const asyncHandler =
  <Req extends Request = Request>(
    handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(handler(req as Req, res, next)).catch(next);
  };
