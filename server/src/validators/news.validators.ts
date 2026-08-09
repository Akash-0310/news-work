import { z } from 'zod';
import {
  booleanFlagSchema,
  countrySchema,
  cuidSchema,
  dateSchema,
  languageSchema,
  limitSchema,
  longSlugSchema,
  pageSchema,
  slugSchema,
  withDateRangeCheck,
} from './common.validators.js';

/** Sort options exposed on list endpoints. */
export const articleSortSchema = z.enum(['latest', 'oldest', 'importance', 'popular']).default('latest');

/** Publisher filter: a display name or a source slug. */
const sourceFilterSchema = z.string().trim().min(1).max(80);

export const listNewsQuerySchema = withDateRangeCheck(
  z.object({
    page: pageSchema,
    limit: limitSchema,
    category: slugSchema.optional(),
    /** Roll child categories (cricket, football) into a parent request (sports). */
    includeChildren: booleanFlagSchema.default(false),
    country: countrySchema.optional(),
    language: languageSchema.optional(),
    source: sourceFilterSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    sort: articleSortSchema,
  }),
);

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;

export const latestNewsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  category: slugSchema.optional(),
  country: countrySchema.optional(),
});

export const categoryFeedParamsSchema = z.object({ category: slugSchema });

export const categoryFeedQuerySchema = withDateRangeCheck(
  z.object({
    page: pageSchema,
    limit: limitSchema,
    includeChildren: booleanFlagSchema.default(true),
    country: countrySchema.optional(),
    source: sourceFilterSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    sort: articleSortSchema,
  }),
);

export const countryFeedParamsSchema = z.object({ country: countrySchema });

export const articleIdParamsSchema = z.object({ id: cuidSchema });

export const storySlugParamsSchema = z.object({ slug: longSlugSchema });

export const topStoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  category: slugSchema.optional(),
  country: countrySchema.optional(),
  /** Look-back window in hours for "top stories today". */
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

/** Homepage bundle: how many items to include per section. */
export const homeFeedQuerySchema = z.object({
  perSection: z.coerce.number().int().min(2).max(12).default(6),
  topStories: z.coerce.number().int().min(2).max(12).default(6),
});
