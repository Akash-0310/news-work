/**
 * API contract types.
 *
 * These mirror the DTOs in `server/src/types/domain.ts`. They are hand-maintained
 * rather than imported across the workspace boundary on purpose: the frontend must
 * depend on the API's *published* shape, not on the server's internal Prisma types.
 * If the two ever drift, that is a real contract break worth surfacing as a bug.
 */

export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type ArticleSort = 'latest' | 'oldest' | 'importance' | 'popular';
export type Role = 'USER' | 'ADMIN';

export interface SourceSummary {
  id: string | null;
  name: string;
  url: string | null;
  logoUrl: string | null;
  trustScore: number | null;
}

export interface StorySummary {
  id: string;
  slug: string;
  title: string;
  sourceCount: number;
  articleCount: number;
}

export interface Article {
  id: string;
  title: string;
  description: string | null;
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
  /** Only present on authenticated requests. */
  isBookmarked?: boolean;
  story?: StorySummary | null;
}

export interface Story extends StorySummary {
  summary: string | null;
  imageUrl: string | null;
  category: string | null;
  country: string | null;
  importanceScore: number;
  trendingScore: number;
  firstSeenAt: string;
  lastPublishedAt: string;
  viewCount: number;
  leadArticle: Article | null;
  /** Only returned by the story detail endpoint. */
  articles?: Article[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPrimary: boolean;
  position: number;
  colorHex: string | null;
  iconName: string | null;
  parentSlug: string | null;
  children?: Category[];
  articleCount?: number;
}

export interface HomeSection {
  key: string;
  label: string;
  category: string;
  articles: Article[];
}

export interface HomeFeed {
  topStories: Story[];
  latest: Article[];
  sections: HomeSection[];
}

export interface ArticleDetail {
  article: Article;
  /** Other publishers covering the same story. */
  coverage: Article[];
  related: Article[];
}

// --------------------------------------------------------------------------
// Envelopes
// --------------------------------------------------------------------------

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  pagination?: Pagination;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: Pagination;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errorCode: string;
  details?: unknown;
}

/** A page of results as consumed by the UI, with the envelope unwrapped. */
export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

// --------------------------------------------------------------------------
// Query parameters
// --------------------------------------------------------------------------

export interface NewsQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  includeChildren?: boolean;
  country?: string;
  language?: string;
  source?: string;
  from?: string;
  to?: string;
  sort?: ArticleSort;
}
