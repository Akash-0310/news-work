import type { ProviderKey } from '../config/env.js';
import type { RawArticle } from '../providers/NewsProvider.js';
import { collapseWhitespace, hashTitle, stripHtml, titleTokens, truncate } from '../utils/text.js';
import { canonicalizeUrl, extractDomain, hashUrl, isValidHttpUrl } from '../utils/url.js';
import { categorize } from './categorize.js';

/**
 * Normalization: `RawArticle` -> `NormalizedArticle`.
 *
 * Pure and I/O-free, so it is fully unit-testable. Everything a provider might get
 * wrong is fixed here exactly once: HTML in titles, tracking parameters, missing or
 * absurd dates, publisher suffixes, inconsistent language codes.
 *
 * The dedup keys (`urlHash`, `titleHash`, `keyTokens`) are computed here too, so an
 * article carries its identity before it ever reaches the database.
 */

export interface NormalizedArticle {
  /** Namespaced as "<provider>:<id>" so ids cannot collide across providers. */
  externalId: string | null;
  title: string;
  description: string | null;
  content: string | null;
  isFullContent: boolean;
  url: string;
  canonicalUrl: string;
  urlHash: string;
  titleHash: string;
  /** Significant title tokens, used for similarity clustering. */
  keyTokens: string[];
  imageUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  author: string | null;
  country: string | null;
  language: string;
  category: string;
  subcategory: string | null;
  publishedAt: Date;
  providerKey: ProviderKey;
}

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 600;
const MAX_CONTENT = 4_000;
const MAX_AUTHOR = 120;

/** Feeds sometimes put the publisher in the author field; strip obvious noise. */
const cleanAuthor = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const clean = collapseWhitespace(stripHtml(raw))
    .replace(/^by\s+/i, '')
    .replace(/\s*[|,]\s*(reuters|ap|afp|pti|ians)\s*$/i, '');
  if (!clean || clean.length > MAX_AUTHOR) return null;
  // A bare email or URL is not a byline.
  if (/^\S+@\S+$/.test(clean) || /^https?:/i.test(clean)) return null;
  return clean;
};

/** Language codes arrive as "en", "en-US", "en_GB" or nonsense. Reduce to a base tag. */
const normalizeLanguage = (raw: string | null | undefined): string => {
  if (!raw) return 'en';
  const base = raw.trim().toLowerCase().replace('_', '-').split('-')[0];
  return base && /^[a-z]{2}$/.test(base) ? base : 'en';
};

const normalizeCountry = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : null;
};

/** Images must be absolute http(s) to be usable in the UI. */
const normalizeImageUrl = (raw: string | null | undefined, articleUrl: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isValidHttpUrl(trimmed)) return trimmed;

  // Protocol-relative and root-relative URLs are common in feed HTML.
  try {
    const resolved = trimmed.startsWith('//')
      ? new URL(`https:${trimmed}`).toString()
      : new URL(trimmed, articleUrl).toString();

    // Re-check the scheme. `new URL(value, base)` ignores the base whenever `value`
    // already has one, so `data:`, `javascript:` and `blob:` URLs resolve
    // successfully and would otherwise pass straight through into an <img src>.
    return isValidHttpUrl(resolved) ? resolved : null;
  } catch {
    return null;
  }
};

/**
 * Date coercion with sanity limits.
 *
 * Feeds supply unparseable dates, epoch-zero dates, and dates years in the future.
 * Since freshness is the heaviest ranking term, a bad date does real damage: a
 * future-dated article would pin itself to the top of every feed. Anything implausible
 * falls back to "now", which is the honest reading of "we just discovered this".
 */
const FUTURE_TOLERANCE_MS = 2 * 60 * 60 * 1000;
const OLDEST_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);

export const normalizePublishedAt = (
  raw: string | Date | null | undefined,
  now: Date = new Date(),
): Date => {
  if (!raw) return now;

  const parsed = raw instanceof Date ? raw : new Date(raw);
  const time = parsed.getTime();

  if (Number.isNaN(time)) return now;
  if (time < OLDEST_PLAUSIBLE_MS) return now;
  // Clamp rather than discard: the article is real, only its clock is wrong.
  if (time > now.getTime() + FUTURE_TOLERANCE_MS) return now;

  return parsed;
};

export interface NormalizeOptions {
  providerKey: ProviderKey;
  now?: Date;
}

/**
 * Returns null when the article cannot be normalized at all (no usable title or URL).
 * Deeper business rules live in validate.ts; this only rejects the unusable.
 */
export const normalizeArticle = (
  raw: RawArticle,
  options: NormalizeOptions,
): NormalizedArticle | null => {
  const title = truncate(collapseWhitespace(stripHtml(raw.title ?? '')), MAX_TITLE);
  if (!title) return null;

  const url = (raw.url ?? '').trim();
  if (!isValidHttpUrl(url)) return null;

  const canonicalUrl = canonicalizeUrl(url);
  const description = raw.description ? truncate(stripHtml(raw.description), MAX_DESCRIPTION) : null;
  const content = raw.content ? truncate(stripHtml(raw.content), MAX_CONTENT) : null;

  const country = normalizeCountry(raw.country);
  const { category } = categorize({
    title,
    description,
    hint: raw.category ?? null,
    country,
  });

  return {
    // Namespacing matters: two providers can legitimately use the id "12345", and
    // externalId carries a unique constraint.
    externalId: raw.externalId ? `${options.providerKey}:${collapseWhitespace(raw.externalId).slice(0, 180)}` : null,
    title,
    description,
    // A feed excerpt is never licensed full text, so this stays false for RSS.
    content,
    isFullContent: false,
    url,
    canonicalUrl,
    urlHash: hashUrl(url),
    titleHash: hashTitle(title),
    keyTokens: titleTokens(title),
    imageUrl: normalizeImageUrl(raw.imageUrl, url),
    sourceName: collapseWhitespace(stripHtml(raw.sourceName ?? '')) || (extractDomain(url) ?? 'Unknown'),
    sourceUrl: raw.sourceUrl?.trim() && isValidHttpUrl(raw.sourceUrl) ? raw.sourceUrl.trim() : null,
    sourceDomain: extractDomain(url),
    author: cleanAuthor(raw.author),
    country,
    language: normalizeLanguage(raw.language),
    category,
    subcategory: null,
    publishedAt: normalizePublishedAt(raw.publishedAt, options.now),
    providerKey: options.providerKey,
  };
};

/** Normalizes a batch, dropping unusable entries and reporting how many were dropped. */
export const normalizeBatch = (
  raws: readonly RawArticle[],
  options: NormalizeOptions,
): { articles: NormalizedArticle[]; rejected: number } => {
  const articles: NormalizedArticle[] = [];
  let rejected = 0;

  for (const raw of raws) {
    const normalized = normalizeArticle(raw, options);
    if (normalized) articles.push(normalized);
    else rejected += 1;
  }

  return { articles, rejected };
};
