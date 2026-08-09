/**
 * Presentation formatters. Pure functions, no React, so they are trivially testable.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative time, in the style news sites use: "2h ago", not
 * "about 2 hours ago". Falls back to an absolute date beyond a week, because
 * "63 days ago" is harder to read than the date itself.
 */
export const formatRelativeTime = (isoDate: string, now: Date = new Date()): string => {
  const then = new Date(isoDate);
  const elapsed = now.getTime() - then.getTime();

  if (Number.isNaN(elapsed)) return '';
  // Clock skew between client and server can make fresh items look future-dated.
  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;

  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

/** Full timestamp for `title` attributes and the article page byline. */
export const formatAbsoluteTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatReadingTime = (minutes: number): string => `${Math.max(1, minutes)} min read`;

/** 1234 -> "1.2K". Keeps view counts from wrapping card layouts. */
export const formatCompactNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
};

/** "the-hindu" -> "The Hindu". Used when only a slug is available. */
export const humanizeSlug = (slug: string): string =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Hostname without `www.`, for the "read at source" link. */
export const domainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const COUNTRY_NAMES: Record<string, string> = {
  in: 'India',
  us: 'United States',
  gb: 'United Kingdom',
  au: 'Australia',
  ca: 'Canada',
  sg: 'Singapore',
  ae: 'UAE',
};

export const countryName = (code: string | null): string | null => {
  if (!code) return null;
  return COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase();
};
