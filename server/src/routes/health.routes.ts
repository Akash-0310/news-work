import { Router } from 'express';
import * as controller from '../controllers/health.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/** Mounted at the root (not under /api) so probes have a stable, version-free path. */
export const healthRouter = Router();

healthRouter.get('/', asyncHandler(controller.getHealth));
healthRouter.get('/live', controller.getLiveness);
healthRouter.get('/metrics', controller.getMetrics);
