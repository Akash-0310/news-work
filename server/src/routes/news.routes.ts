import { Router } from 'express';
import * as controller from '../controllers/news.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  articleIdParamsSchema,
  categoryFeedParamsSchema,
  categoryFeedQuerySchema,
  countryFeedParamsSchema,
  homeFeedQuerySchema,
  latestNewsQuerySchema,
  listNewsQuerySchema,
  storySlugParamsSchema,
  topStoriesQuerySchema,
} from '../validators/news.validators.js';

/**
 * News routes.
 *
 * ORDERING MATTERS: every literal path must be declared before `/:id`, otherwise
 * Express matches `/latest` as an article id and the endpoint 404s with a confusing
 * validation error instead.
 */
export const newsRouter = Router();

newsRouter.get('/', validate({ query: listNewsQuerySchema }), asyncHandler(controller.listNews));

newsRouter.get(
  '/latest',
  validate({ query: latestNewsQuerySchema }),
  asyncHandler(controller.listLatestNews),
);

newsRouter.get('/home', validate({ query: homeFeedQuerySchema }), asyncHandler(controller.getHomeFeed));

newsRouter.get(
  '/top-stories',
  validate({ query: topStoriesQuerySchema }),
  asyncHandler(controller.listTopStories),
);

newsRouter.get(
  '/category/:category',
  validate({ params: categoryFeedParamsSchema, query: categoryFeedQuerySchema }),
  asyncHandler(controller.listByCategory),
);

newsRouter.get(
  '/country/:country',
  validate({ params: countryFeedParamsSchema, query: categoryFeedQuerySchema }),
  asyncHandler(controller.listByCountry),
);

newsRouter.get(
  '/stories/:slug',
  validate({ params: storySlugParamsSchema }),
  asyncHandler(controller.getStory),
);

// Keep last: the catch-all parameterized route.
newsRouter.get(
  '/:id',
  validate({ params: articleIdParamsSchema }),
  asyncHandler(controller.getArticle),
);
