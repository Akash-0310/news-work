import type { ArticleStatus, Sentiment } from '@prisma/client';

/**
 * Domain-level types shared across layers.
 *
 * DTOs here are the API's public shape. They are deliberately *not* Prisma models:
 * internal columns (urlHash, titleHash, providerKey, ...) must not leak to clients,
 * and the frontend types in web/src/types mirror these instead.
 */

export interface SourceSummary {
  id: string | null;
  name: string;
  url: string | null;
  logoUrl: string | null;
  trustScore: number | null;
}

export interface ArticleDTO {
  id: string;
  title: string;
  description: string | null;
  /** Excerpt only unless the publisher licenses full text. */
  content: string | null;
  isFullContent: boolean;
  url: string;
  imageUrl: string | null;
  source: SourceSummary;
  author: string | null;
  country: string | null;
  language: string;
  category: string;
  subcategory: string | null;
  publishedAt: string;
  importanceScore: number;
  sentiment: Sentiment | null;
  topics: string[];
  readingMinutes: number;
  viewCount: number;
  /** Present only on authenticated requests. */
  isBookmarked?: boolean;
  story?: StorySummary | null;
}

export interface StorySummary {
  id: string;
  slug: string;
  title: string;
  sourceCount: number;
  articleCount: number;
}

export interface StoryDTO extends StorySummary {
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  country: string | null;
  importanceScore: number;
  trendingScore: number;
  lastPublishedAt: string;
  firstSeenAt: string;
  viewCount: number;
  /** The lead article plus, optionally, the rest of the coverage. */
  leadArticle: ArticleDTO | null;
  articles?: ArticleDTO[];
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPrimary: boolean;
  position: number;
  colorHex: string | null;
  iconName: string | null;
  parentSlug: string | null;
  children?: CategoryDTO[];
  articleCount?: number;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl: string | null;
  onboardedAt: string | null;
  createdAt: string;
}

// --------------------------------------------------------------------------
// Query shapes (validated by zod, consumed by services/repositories)
// --------------------------------------------------------------------------

export type ArticleSort = 'latest' | 'oldest' | 'importance' | 'popular';

export interface PageRequest {
  page: number;
  limit: number;
}

export interface ArticleQuery extends PageRequest {
  category?: string;
  /** Include descendants of `category` (e.g. sports -> cricket, football). */
  includeChildren?: boolean;
  country?: string;
  language?: string;
  source?: string;
  from?: Date;
  to?: Date;
  sort: ArticleSort;
  search?: string;
  status?: ArticleStatus;
}

export interface SearchQuery extends PageRequest {
  q: string;
  category?: string;
  country?: string;
  source?: string;
  from?: Date;
  to?: Date;
  sort: 'relevance' | ArticleSort;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}
