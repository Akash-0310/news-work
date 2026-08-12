import type { NormalizedArticle } from './normalize.js';

/**
 * Post-normalization validation.
 *
 * Separate from normalization on purpose: normalization asks "can this be understood?",
 * validation asks "should this be stored?". Keeping them apart means the rejection
 * reason is specific enough to act on, and the counts land in `IngestionRun` so the
 * admin dashboard can show *why* a provider's yield dropped rather than just that it
 * did.
 *
 * Pure, so every rule is unit-testable.
 */

export type RejectionReason =
  | 'title-too-short'
  | 'title-is-boilerplate'
  | 'no-description'
  | 'too-old'
  | 'unsupported-language'
  | 'blocked-url';

export interface ValidationResult {
  valid: boolean;
  reason?: RejectionReason;
}

const VALID = { valid: true } as const;
const invalid = (reason: RejectionReason): ValidationResult => ({ valid: false, reason });

/** Below this, a "headline" is a section label, not an article. */
const MIN_TITLE_LENGTH = 20;

/**
 * Feed furniture that is not news. Publishers emit these as regular items, and without
 * filtering they end up ranked alongside real stories.
 */
const BOILERPLATE_TITLES = [
  'live updates',
  'top stories',
  'latest news',
  'news headlines',
  'breaking news',
  'photo gallery',
  'in pictures',
  'daily briefing',
  'morning digest',
  'evening digest',
  'newsletter',
  'subscribe',
  'privacy policy',
  'terms of service',
  'cookie policy',
];

/** Non-article paths that show up in feeds. */
const BLOCKED_URL_PATTERNS = [
  /\/tag\//i,
  /\/tags\//i,
  /\/author\//i,
  /\/category\//i,
  /\/subscribe/i,
  /\/newsletter/i,
  /\/live-blog\/?$/i,
  /\/videos?\/?$/i,
  /\/photos?\/?$/i,
];

export interface ValidateOptions {
  /** Reject anything older than this many days; matches the retention window. */
  maxAgeDays: number;
  /** Accepted language codes. Empty means accept all. */
  allowedLanguages?: string[];
  now?: Date;
}

export const validateArticle = (
  article: NormalizedArticle,
  options: ValidateOptions,
): ValidationResult => {
  const now = options.now ?? new Date();

  const lowerTitle = article.title.toLowerCase().trim();

  // Boilerplate is checked BEFORE length. Feed furniture ("Top stories", "In
  // pictures") is usually short, so a length check first would reject it with the
  // misleading reason 'title-too-short' and hide the real pattern from the admin
  // dashboard. Both reject; only the reported reason differs, and that reason is the
  // whole point of tracking them separately.
  //
  // Exact-ish match only: a real headline may legitimately contain "breaking news",
  // so only titles that are essentially just the phrase are rejected.
  if (BOILERPLATE_TITLES.some((phrase) => lowerTitle === phrase || lowerTitle.startsWith(`${phrase} |`))) {
    return invalid('title-is-boilerplate');
  }

  if (article.title.length < MIN_TITLE_LENGTH) return invalid('title-too-short');

  if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(article.canonicalUrl))) {
    return invalid('blocked-url');
  }

  const ageDays = (now.getTime() - article.publishedAt.getTime()) / 86_400_000;
  // Storing articles older than the cleanup worker's retention window would mean
  // writing rows that are deleted on the next cleanup pass.
  if (ageDays > options.maxAgeDays) return invalid('too-old');

  if (
    options.allowedLanguages &&
    options.allowedLanguages.length > 0 &&
    !options.allowedLanguages.includes(article.language)
  ) {
    return invalid('unsupported-language');
  }

  // A headline with no description at all still ranks and renders, so this is
  // permitted; the UI handles a null description.
  return VALID;
};

export interface PartitionResult {
  accepted: NormalizedArticle[];
  rejected: { article: NormalizedArticle; reason: RejectionReason }[];
  /** Counts per reason, for the IngestionRun record. */
  reasonCounts: Record<string, number>;
}

export const partitionValid = (
  articles: readonly NormalizedArticle[],
  options: ValidateOptions,
): PartitionResult => {
  const accepted: NormalizedArticle[] = [];
  const rejected: { article: NormalizedArticle; reason: RejectionReason }[] = [];
  const reasonCounts: Record<string, number> = {};

  for (const article of articles) {
    const result = validateArticle(article, options);
    if (result.valid) {
      accepted.push(article);
    } else if (result.reason) {
      rejected.push({ article, reason: result.reason });
      reasonCounts[result.reason] = (reasonCounts[result.reason] ?? 0) + 1;
    }
  }

  return { accepted, rejected, reasonCounts };
};
