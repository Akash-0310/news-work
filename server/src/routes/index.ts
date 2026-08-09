import { Router } from 'express';
import { categoryRouter } from './category.routes.js';
import { newsRouter } from './news.routes.js';

/**
 * API router, mounted at /api.
 *
 * Routers are registered here and nowhere else, so the full public surface of the
 * API is readable from one file. Later phases add auth, feed, bookmarks, search and
 * admin routers to this list.
 */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'NewsFlow API',
      version: '0.1.0',
      endpoints: {
        news: '/api/news',
        latest: '/api/news/latest',
        home: '/api/news/home',
        topStories: '/api/news/top-stories',
        byCategory: '/api/news/category/:category',
        byCountry: '/api/news/country/:country',
        story: '/api/news/stories/:slug',
        article: '/api/news/:id',
        categories: '/api/categories',
        health: '/health',
      },
    },
    message: 'Success',
  });
});

apiRouter.use('/news', newsRouter);
apiRouter.use('/categories', categoryRouter);
