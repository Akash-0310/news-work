import type { Request, Response } from 'express';
import * as newsService from '../services/news.service.js';
import type {
  categoryFeedParamsSchema,
  categoryFeedQuerySchema,
  countryFeedParamsSchema,
  homeFeedQuerySchema,
  articleIdParamsSchema,
  latestNewsQuerySchema,
  listNewsQuerySchema,
  storySlugParamsSchema,
  topStoriesQuerySchema,
} from '../validators/news.validators.js';
import type { z } from 'zod';
import { buildPagination, ok, paginated } from '../utils/response.js';

/**
 * News controllers.
 *
 * Controllers do exactly three things: read already-validated input off the request,
 * call one service function, and shape the response. No business logic, no data access.
 * The `Q<...>` aliases keep handler signatures typed against the zod schemas so a
 * validator change surfaces as a compile error here.
 */

type Q<S extends z.ZodTypeAny> = z.infer<S>;

/** GET /api/news */
export const listNews = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as Q<typeof listNewsQuerySchema>;

  const { items, total } = await newsService.listArticles({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    includeChildren: query.includeChildren,
    ...(query.category ? { category: query.category } : {}),
    ...(query.country ? { country: query.country } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });

  paginated(res, items, buildPagination(query.page, query.limit, total), 'Articles retrieved');
};

/** GET /api/news/latest */
export const listLatestNews = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as Q<typeof latestNewsQuerySchema>;

  const { items, total } = await newsService.listArticles({
    page: query.page,
    limit: query.limit,
    sort: 'latest',
    includeChildren: true,
    ...(query.category ? { category: query.category } : {}),
    ...(query.country ? { country: query.country } : {}),
  });

  paginated(res, items, buildPagination(query.page, query.limit, total), 'Latest news retrieved');
};

/** GET /api/news/category/:category */
export const listByCategory = async (req: Request, res: Response): Promise<void> => {
  const { category } = req.params as unknown as Q<typeof categoryFeedParamsSchema>;
  const query = req.query as unknown as Q<typeof categoryFeedQuerySchema>;

  const { items, total } = await newsService.listArticles({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category,
    includeChildren: query.includeChildren,
    ...(query.country ? { country: query.country } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });

  paginated(
    res,
    items,
    buildPagination(query.page, query.limit, total),
    `Articles for category "${category}" retrieved`,
    { category },
  );
};

/** GET /api/news/country/:country */
export const listByCountry = async (req: Request, res: Response): Promise<void> => {
  const { country } = req.params as unknown as Q<typeof countryFeedParamsSchema>;
  const query = req.query as unknown as Q<typeof categoryFeedQuerySchema>;

  const { items, total } = await newsService.listArticles({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    country,
    includeChildren: true,
    ...(query.source ? { source: query.source } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });

  paginated(
    res,
    items,
    buildPagination(query.page, query.limit, total),
    `Articles for country "${country}" retrieved`,
    { country },
  );
};

/** GET /api/news/top-stories */
export const listTopStories = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as Q<typeof topStoriesQuerySchema>;

  const stories = await newsService.getTopStories({
    limit: query.limit,
    hours: query.hours,
    ...(query.category ? { category: query.category } : {}),
    ...(query.country ? { country: query.country } : {}),
  });

  ok(res, stories, 'Top stories retrieved');
};

/** GET /api/news/home */
export const getHomeFeed = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as Q<typeof homeFeedQuerySchema>;

  const feed = await newsService.getHomeFeed({
    perSection: query.perSection,
    topStories: query.topStories,
  });

  ok(res, feed, 'Home feed retrieved');
};

/** GET /api/news/stories/:slug */
export const getStory = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params as unknown as Q<typeof storySlugParamsSchema>;
  const story = await newsService.getStoryBySlug(slug);
  ok(res, story, 'Story retrieved');
};

/**
 * GET /api/news/:id
 *
 * Registered last among GET routes so literal paths like /latest and /trending are
 * never captured by this parameterized one.
 */
export const getArticle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as unknown as Q<typeof articleIdParamsSchema>;
  const detail = await newsService.getArticleDetail(id);
  ok(res, detail, 'Article retrieved');
};
