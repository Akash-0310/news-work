import type { ArticleStatus } from '@prisma/client';
import { Prisma, prisma } from '../config/prisma.js';
import type { ArticleQuery, ArticleSort, PageResult } from '../types/domain.js';

/**
 * Article persistence. The only module allowed to build NewsArticle Prisma queries.
 *
 * Every read is column-projected via `articleSelect` rather than returning whole rows:
 * internal dedup columns (urlHash, titleHash, providerKey) must never travel to a
 * service that might serialize them, and narrower rows mean less I/O per page.
 */

export const articleSelect = {
  id: true,
  title: true,
  description: true,
  content: true,
  isFullContent: true,
  url: true,
  imageUrl: true,
  sourceName: true,
  sourceUrl: true,
  author: true,
  country: true,
  language: true,
  category: true,
  subcategory: true,
  publishedAt: true,
  importanceScore: true,
  sentiment: true,
  topics: true,
  viewCount: true,
  bookmarkCount: true,
  source: {
    select: { id: true, name: true, homepage: true, logoUrl: true, trustScore: true },
  },
  story: {
    select: { id: true, slug: true, title: true, sourceCount: true, articleCount: true },
  },
} satisfies Prisma.NewsArticleSelect;

export type ArticleRecord = Prisma.NewsArticleGetPayload<{ select: typeof articleSelect }>;

const ORDER_BY: Record<ArticleSort, Prisma.NewsArticleOrderByWithRelationInput[]> = {
  latest: [{ publishedAt: 'desc' }],
  oldest: [{ publishedAt: 'asc' }],
  // Importance ties are broken by recency so the top of a feed is never arbitrary.
  importance: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
  popular: [{ viewCount: 'desc' }, { importanceScore: 'desc' }],
};

export interface ArticleFilter extends Omit<ArticleQuery, 'page' | 'limit' | 'sort'> {
  /** Resolved category slugs (parent plus children when includeChildren was requested). */
  categorySlugs?: string[];
  /** Exclude these ids, used by "related articles" to drop the current one. */
  excludeIds?: string[];
  storyId?: string;
}

export const buildArticleWhere = (filter: ArticleFilter): Prisma.NewsArticleWhereInput => {
  const where: Prisma.NewsArticleWhereInput = {
    // Hidden and removed articles are invisible to every public read path.
    status: filter.status ?? ('PUBLISHED' satisfies ArticleStatus),
  };

  if (filter.categorySlugs && filter.categorySlugs.length > 0) {
    where.category = filter.categorySlugs.length === 1 ? filter.categorySlugs[0] : { in: filter.categorySlugs };
  } else if (filter.category) {
    where.category = filter.category;
  }

  if (filter.country) where.country = filter.country.toLowerCase();
  if (filter.language) where.language = filter.language.toLowerCase();
  if (filter.storyId) where.storyId = filter.storyId;

  if (filter.source) {
    // Match either the denormalized publisher name or the linked Source slug, so
    // `?source=the-hindu` and `?source=The Hindu` both work.
    where.OR = [
      { sourceName: { equals: filter.source, mode: 'insensitive' } },
      { source: { slug: filter.source.toLowerCase() } },
    ];
  }

  if (filter.from || filter.to) {
    where.publishedAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  if (filter.excludeIds && filter.excludeIds.length > 0) {
    where.id = { notIn: filter.excludeIds };
  }

  return where;
};

/**
 * One page of articles plus the total count.
 *
 * findMany and count run in a single transaction so the pagination metadata cannot
 * disagree with the page contents while the ingestion worker is writing.
 */
export const findArticles = async (
  query: ArticleQuery & { categorySlugs?: string[]; excludeIds?: string[] },
): Promise<PageResult<ArticleRecord>> => {
  const where = buildArticleWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.newsArticle.findMany({
      where,
      select: articleSelect,
      orderBy: ORDER_BY[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return { items, total };
};

export const findArticleById = async (id: string): Promise<ArticleRecord | null> =>
  prisma.newsArticle.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: articleSelect,
  });

/** Top articles for a category, used to build the homepage sections in one pass. */
export const findTopByCategory = async (
  categorySlugs: readonly string[],
  limit: number,
  sort: ArticleSort = 'importance',
): Promise<ArticleRecord[]> =>
  prisma.newsArticle.findMany({
    where: buildArticleWhere({ categorySlugs: [...categorySlugs] }),
    select: articleSelect,
    orderBy: ORDER_BY[sort],
    take: limit,
  });

/** Other articles attached to the same story: the "covered by N sources" list. */
export const findSiblingArticles = async (
  storyId: string,
  excludeArticleId: string,
  limit = 12,
): Promise<ArticleRecord[]> =>
  prisma.newsArticle.findMany({
    where: { storyId, status: 'PUBLISHED', id: { not: excludeArticleId } },
    select: articleSelect,
    // Highest-trust publishers first so the comparison list leads with quality.
    orderBy: [{ source: { trustScore: 'desc' } }, { publishedAt: 'desc' }],
    take: limit,
  });

/**
 * Related articles: same category, recent, excluding the current story to avoid
 * showing the same event twice on one page.
 */
export const findRelatedArticles = async (
  article: Pick<ArticleRecord, 'id' | 'category' | 'story'>,
  limit = 6,
): Promise<ArticleRecord[]> =>
  prisma.newsArticle.findMany({
    where: {
      status: 'PUBLISHED',
      category: article.category,
      id: { not: article.id },
      ...(article.story ? { storyId: { not: article.story.id } } : {}),
    },
    select: articleSelect,
    orderBy: [{ importanceScore: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });

/**
 * Fire-and-forget view counter.
 *
 * Increments the article and its story together so trending has both signals.
 * Callers must not await this on the request path.
 */
export const incrementViewCount = async (id: string, storyId: string | null): Promise<void> => {
  await prisma.$transaction([
    prisma.newsArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } }),
    ...(storyId
      ? [prisma.story.update({ where: { id: storyId }, data: { viewCount: { increment: 1 } } })]
      : []),
  ]);
};

export const countArticles = async (where: Prisma.NewsArticleWhereInput = {}): Promise<number> =>
  prisma.newsArticle.count({ where });

/** Per-category totals for the category index, in one grouped query. */
export const countByCategory = async (): Promise<Map<string, number>> => {
  const rows = await prisma.newsArticle.groupBy({
    by: ['category'],
    where: { status: 'PUBLISHED' },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.category, row._count._all]));
};
