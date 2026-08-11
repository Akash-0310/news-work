import { type Prisma, prisma } from '../config/prisma.js';
import type { PageResult } from '../types/domain.js';
import { articleSelect, type ArticleRecord } from './article.repository.js';

/**
 * Story persistence.
 *
 * A story is the clustered event; its `leadArticle` is the single best article to show
 * for it. "Best" is highest source trust, then importance, then recency, so a story
 * covered by Reuters and by an aggregator leads with Reuters.
 */

const leadArticleSelect = {
  select: articleSelect,
  orderBy: [
    { source: { trustScore: 'desc' } },
    { importanceScore: 'desc' },
    { publishedAt: 'desc' },
  ],
  take: 1,
} satisfies Prisma.Story$articlesArgs;

export const storySelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  country: true,
  articleCount: true,
  sourceCount: true,
  viewCount: true,
  importanceScore: true,
  trendingScore: true,
  firstSeenAt: true,
  lastPublishedAt: true,
  category: { select: { slug: true, name: true } },
  articles: leadArticleSelect,
} satisfies Prisma.StorySelect;

export type StoryRecord = Prisma.StoryGetPayload<{ select: typeof storySelect }>;

export interface StoryFilter {
  categorySlug?: string;
  categorySlugs?: string[];
  country?: string;
  /** Only stories with coverage newer than this. Drives "top stories today". */
  since?: Date;
  /** Require corroboration from at least N publishers. */
  minSourceCount?: number;
}

const buildStoryWhere = (filter: StoryFilter): Prisma.StoryWhereInput => {
  const where: Prisma.StoryWhereInput = {};

  if (filter.categorySlugs && filter.categorySlugs.length > 0) {
    where.category = { slug: { in: filter.categorySlugs } };
  } else if (filter.categorySlug) {
    where.category = { slug: filter.categorySlug };
  }

  if (filter.country) where.country = filter.country.toLowerCase();
  if (filter.since) where.lastPublishedAt = { gte: filter.since };
  if (filter.minSourceCount !== undefined) where.sourceCount = { gte: filter.minSourceCount };

  // A story with no visible articles left (all hidden by an admin) must not surface.
  where.articles = { some: { status: 'PUBLISHED' } };

  return where;
};

export const findTopStories = async (
  filter: StoryFilter,
  limit: number,
): Promise<StoryRecord[]> =>
  prisma.story.findMany({
    where: buildStoryWhere(filter),
    select: storySelect,
    orderBy: [{ importanceScore: 'desc' }, { lastPublishedAt: 'desc' }],
    take: limit,
  });

export const findTrendingStories = async (limit: number): Promise<StoryRecord[]> =>
  prisma.story.findMany({
    where: buildStoryWhere({}),
    select: storySelect,
    orderBy: [{ trendingScore: 'desc' }, { lastPublishedAt: 'desc' }],
    take: limit,
  });

export const findStories = async (
  filter: StoryFilter,
  page: number,
  limit: number,
): Promise<PageResult<StoryRecord>> => {
  const where = buildStoryWhere(filter);
  const [items, total] = await prisma.$transaction([
    prisma.story.findMany({
      where,
      select: storySelect,
      orderBy: [{ lastPublishedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.story.count({ where }),
  ]);
  return { items, total };
};

export const findStoryBySlug = async (slug: string): Promise<StoryRecord | null> =>
  prisma.story.findUnique({ where: { slug }, select: storySelect });

/** Full coverage list for a story, ordered by publisher trust. */
export const findStoryArticles = async (storyId: string): Promise<ArticleRecord[]> =>
  prisma.newsArticle.findMany({
    where: { storyId, status: 'PUBLISHED' },
    select: articleSelect,
    orderBy: [{ source: { trustScore: 'desc' } }, { publishedAt: 'desc' }],
  });

export const countStories = async (where: Prisma.StoryWhereInput = {}): Promise<number> =>
  prisma.story.count({ where });
