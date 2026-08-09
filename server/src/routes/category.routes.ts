import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/category.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { slugSchema } from '../validators/common.validators.js';

export const categoryRouter = Router();

categoryRouter.get('/', asyncHandler(controller.listCategories));

categoryRouter.get(
  '/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  asyncHandler(controller.getCategory),
);
