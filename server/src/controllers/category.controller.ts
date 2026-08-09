import type { Request, Response } from 'express';
import * as categoryService from '../services/category.service.js';
import { ok } from '../utils/response.js';

/** GET /api/categories */
export const listCategories = async (req: Request, res: Response): Promise<void> => {
  const withCounts = req.query['withCounts'] === 'true';
  const categories = await categoryService.listCategories(withCounts);
  ok(res, categories, 'Categories retrieved');
};

/** GET /api/categories/:slug */
export const getCategory = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params['slug']);
  const category = await categoryService.getCategoryBySlug(slug);
  ok(res, category, 'Category retrieved');
};
