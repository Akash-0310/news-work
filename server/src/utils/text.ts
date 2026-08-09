import { createHash } from 'node:crypto';

/**
 * Pure text helpers shared by the ingestion pipeline and the seed script.
 * No I/O here on purpose: these are the functions most worth unit-testing.
 *
 * All character classes use Unicode property escapes rather than literal
 * non-ASCII characters, so the source stays encoding-independent.
 */

/** Words that carry no signal when comparing headlines. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from', 'has', 'have',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'over', 'said', 'says', 'that', 'the',
  'their', 'they', 'this', 'to', 'up', 'was', 'were', 'what', 'when', 'which', 'who', 'will',
  'with', 'after', 'amid', 'new', 'more', 'than', 'about', 'his', 'her', 'not',
]);

/**
 * Publisher suffixes that many feeds append to headlines, e.g.
 * "Markets rally today - Reuters". Removing them is essential for title-based dedup:
 * otherwise the same story from two feeds never matches.
 *
 * `\p{Pd}` covers hyphen, en dash and em dash in one class.
 */
const TITLE_SUFFIX = /\s+[\p{Pd}|]\s+[^\p{Pd}|]{2,40}$/u;

/** Combining marks left behind by NFKD normalization. */
const DIACRITICS = /\p{M}+/gu;

/** ASCII apostrophe plus initial/final quote punctuation (covers typographic quotes). */
const APOSTROPHES = /['\p{Pi}\p{Pf}]/gu;

/** Lowercases, decomposes accents and drops apostrophes. Shared by slug + token paths. */
const foldCase = (input: string): string =>
  input.toLowerCase().normalize('NFKD').replace(DIACRITICS, '').replace(APOSTROPHES, '');

export const stripHtml = (input: string): string =>
  input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const collapseWhitespace = (input: string): string => input.replace(/\s+/g, ' ').trim();

/** Trims to a whole word at or before `maxLength`, appending an ellipsis when cut. */
export const truncate = (input: string, maxLength: number): string => {
  const clean = collapseWhitespace(input);
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}...`;
};

export const slugify = (input: string, maxLength = 80): string => {
  const slug = foldCase(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '') || 'untitled';
};

/**
 * Significant, de-duplicated, sorted tokens of a headline.
 *
 * Sorting makes comparison order-independent, so "Apple unveils M5 chip" and
 * "M5 chip unveiled by Apple" produce the same token sequence.
 */
export const titleTokens = (title: string): string[] => {
  const cleaned = stripHtml(title).replace(TITLE_SUFFIX, '');
  const tokens = foldCase(cleaned)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  return [...new Set(tokens)].sort();
};

/** Canonical form of a headline, used as the exact-match dedup key. */
export const normalizeTitle = (title: string): string => titleTokens(title).join(' ');

export const sha1 = (input: string): string => createHash('sha1').update(input).digest('hex');

export const hashTitle = (title: string): string => sha1(normalizeTitle(title));

/**
 * Jaccard similarity of two token sets: |A intersect B| / |A union B|.
 * Cheap, order-independent, and good enough to catch reworded headlines about the
 * same event without needing embeddings.
 */
export const jaccardSimilarity = (a: readonly string[], b: readonly string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const WORDS_PER_MINUTE = 220;

/** Estimated reading time in whole minutes, floored at 1. */
export const estimateReadingMinutes = (...parts: (string | null | undefined)[]): number => {
  const words = parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .reduce((total, part) => total + stripHtml(part).split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};
