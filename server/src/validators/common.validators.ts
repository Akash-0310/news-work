import { z } from 'zod';

/**
 * Reusable validation primitives.
 *
 * Query strings are always strings, so every numeric/boolean/date field is coerced here
 * exactly once. Downstream code then works with real numbers, booleans and Dates.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);

/** Capped so a client cannot request an unbounded page and exhaust the database. */
export const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE);

export const paginationSchema = z.object({
  page: pageSchema,
  limit: limitSchema,
});

/** Slugs are used directly in queries and cache keys, so the charset is restricted. */
const slugOfLength = (maxLength: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(maxLength)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug');

/** Category and source slugs. */
export const slugSchema = slugOfLength(60);

/**
 * Story slugs, generated from full headlines and so longer.
 *
 * A separate schema rather than `slugSchema.max(120)`: chained `.max()` calls both
 * apply, so the tighter limit would silently win.
 */
export const longSlugSchema = slugOfLength(120);

export const cuidSchema = z
  .string()
  .trim()
  .min(20)
  .max(40)
  .regex(/^[a-z0-9]+$/i, 'invalid id');

/** ISO 3166-1 alpha-2 country code. */
export const countrySchema = z
  .string()
  .trim()
  .toLowerCase()
  .length(2)
  .regex(/^[a-z]{2}$/, 'must be a two-letter country code');

export const languageSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(5)
  .regex(/^[a-z]{2}(-[a-z]{2})?$/, 'must be a language code such as "en" or "en-in"');

/** Accepts `2026-08-01` and full ISO timestamps; rejects unparseable input. */
export const dateSchema = z.coerce.date({ invalid_type_error: 'must be a valid ISO date' });

/** `?includeChildren=true|1|yes|on` all mean true. */
export const booleanFlagSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : ['true', '1', 'yes', 'on'].includes(value.toLowerCase()),
  );

/**
 * C0 control characters plus DEL. Built with the RegExp constructor so this source
 * file contains no literal control bytes.
 */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');

/**
 * Free-text search input. Length-capped and stripped of control characters before it
 * ever reaches the full-text query builder or a Redis cache key.
 */
export const searchTermSchema = z
  .string()
  .trim()
  .min(2, 'search term must be at least 2 characters')
  .max(120)
  .transform((value) => value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim());

/** Rejects a `to` earlier than `from` rather than silently returning an empty page. */
export const withDateRangeCheck = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, ctx) => {
    const range = value as { from?: Date; to?: Date };
    if (range.from && range.to && range.from > range.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: '`to` must be the same as or later than `from`',
      });
    }
  });
