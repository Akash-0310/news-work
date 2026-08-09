import type { ArticleRecord } from '../repositories/article.repository.js';
import type { CategoryRecord, CategoryWithChildren } from '../repositories/category.repository.js';
import type { StoryRecord } from '../repositories/story.repository.js';
import type { ArticleDTO, CategoryDTO, StoryDTO } from '../types/domain.js';
import { estimateReadingMinutes, truncate } from '../utils/text.js';

/**
 * Persistence records -> API DTOs.
 *
 * This is the single boundary where internal columns are dropped and dates become ISO
 * strings. Keeping it in one file means the API contract can be audited by reading one
 * module, and adding a column to Prisma never silently changes the public response.
 */

/** Description length cap for list responses. Full text stays on the article page. */
const CARD_DESCRIPTION_LENGTH = 260;

export interface ArticleMapOptions {
  /** Ids the current user has bookmarked; omit for anonymous requests. */
  bookmarkedIds?: ReadonlySet<string>;
  /** Include the (longer) content field. List endpoints omit it to keep payloads small. */
  includeContent?: boolean;
}

export const toArticleDTO = (
  record: ArticleRecord,
  options: ArticleMapOptions = {},
): ArticleDTO => {
  const description = record.description ? truncate(record.description, CARD_DESCRIPTION_LENGTH) : null;

  const dto: ArticleDTO = {
    id: record.id,
    title: record.title,
    description,
    content: options.includeContent ? record.content : null,
    isFullContent: record.isFullContent,
    url: record.url,
    imageUrl: record.imageUrl,
    source: {
      id: record.source?.id ?? null,
      name: record.source?.name ?? record.sourceName,
      url: record.source?.homepage ?? record.sourceUrl,
      logoUrl: record.source?.logoUrl ?? null,
      trustScore: record.source?.trustScore ?? null,
    },
    author: record.author,
    country: record.country,
    language: record.language,
    category: record.category,
    subcategory: record.subcategory,
    publishedAt: record.publishedAt.toISOString(),
    importanceScore: record.importanceScore,
    sentiment: record.sentiment,
    topics: record.topics,
    // Computed rather than stored: it is a pure function of the text and would
    // otherwise need a backfill every time the words-per-minute constant changes.
    readingMinutes: estimateReadingMinutes(record.title, record.description, record.content),
    viewCount: record.viewCount,
    story: record.story
      ? {
          id: record.story.id,
          slug: record.story.slug,
          title: record.story.title,
          sourceCount: record.story.sourceCount,
          articleCount: record.story.articleCount,
        }
      : null,
  };

  // Only present the flag when we actually know the answer, so the client can
  // distinguish "not bookmarked" from "not logged in".
  if (options.bookmarkedIds) {
    dto.isBookmarked = options.bookmarkedIds.has(record.id);
  }

  return dto;
};

export const toArticleDTOs = (
  records: readonly ArticleRecord[],
  options: ArticleMapOptions = {},
): ArticleDTO[] => records.map((record) => toArticleDTO(record, options));

export const toStoryDTO = (record: StoryRecord, options: ArticleMapOptions = {}): StoryDTO => {
  // `articles` is the take:1 lead article from storySelect.
  const lead = record.articles[0];

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    imageUrl: record.imageUrl ?? lead?.imageUrl ?? null,
    category: record.category?.slug ?? null,
    country: record.country,
    articleCount: record.articleCount,
    sourceCount: record.sourceCount,
    viewCount: record.viewCount,
    importanceScore: record.importanceScore,
    trendingScore: record.trendingScore,
    firstSeenAt: record.firstSeenAt.toISOString(),
    lastPublishedAt: record.lastPublishedAt.toISOString(),
    leadArticle: lead ? toArticleDTO(lead, options) : null,
  };
};

export const toStoryDTOs = (
  records: readonly StoryRecord[],
  options: ArticleMapOptions = {},
): StoryDTO[] => records.map((record) => toStoryDTO(record, options));

export const toCategoryDTO = (
  record: CategoryRecord | CategoryWithChildren,
  articleCounts?: ReadonlyMap<string, number>,
): CategoryDTO => {
  const dto: CategoryDTO = {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    isPrimary: record.isPrimary,
    position: record.position,
    colorHex: record.colorHex,
    iconName: record.iconName,
    parentSlug: record.parent?.slug ?? null,
  };

  if ('children' in record && record.children.length > 0) {
    dto.children = record.children.map((child) => toCategoryDTO(child, articleCounts));
  }

  if (articleCounts) {
    dto.articleCount = articleCounts.get(record.slug) ?? 0;
  }

  return dto;
};
