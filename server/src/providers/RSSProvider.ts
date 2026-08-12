import { fetch } from 'undici';
import { log } from '../config/logger.js';
import { prisma } from '../config/prisma.js';
import { toErrorMessage } from '../utils/errors.js';
import { parseFeed } from './rss.parser.js';
import {
  emptyResult,
  type FetchOptions,
  type NewsProvider,
  type ProviderFetchResult,
  type ProviderPartialError,
  type RawArticle,
} from './NewsProvider.js';

const logger = log('provider:rss');

/**
 * RSS provider.
 *
 * The default provider, and the reason the app needs no API keys: it reads public feeds
 * from the `Source` rows that carry a `feedUrl`. Adding a publisher is a database
 * insert, not a code change.
 *
 * Feeds are fetched concurrently but with a bounded pool, and `allSettled` semantics
 * mean a dead or slow feed costs one entry in `partialErrors` rather than the run.
 */

/** Concurrent feed fetches. Enough to be quick, low enough to be polite. */
const CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_LIMIT_PER_SOURCE = 40;

/** Identifies the crawler honestly and points publishers at the project. */
const USER_AGENT =
  'NewsFlowBot/0.1 (+https://github.com/newsflow; news aggregator; contact via repository)';

interface FeedSource {
  id: string;
  name: string;
  feedUrl: string;
  country: string | null;
  language: string;
}

const loadFeedSources = async (): Promise<FeedSource[]> => {
  const rows = await prisma.source.findMany({
    where: { isActive: true, providerKey: 'rss', feedUrl: { not: null } },
    select: { id: true, name: true, feedUrl: true, country: true, language: true },
  });

  // The `not: null` filter cannot narrow the TypeScript type, so assert it here.
  return rows.flatMap((row) => (row.feedUrl ? [{ ...row, feedUrl: row.feedUrl }] : []));
};

const fetchOne = async (
  source: FeedSource,
  options: FetchOptions,
): Promise<{ articles: RawArticle[]; error?: ProviderPartialError }> => {
  const limit = options.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE;

  try {
    const response = await fetch(source.feedUrl, {
      headers: {
        'user-agent': USER_AGENT,
        // Some publishers serve HTML unless XML is explicitly requested.
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      // Without a timeout a hanging publisher would stall the whole worker cycle.
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        articles: [],
        error: { target: source.feedUrl, message: `HTTP ${response.status} ${response.statusText}` },
      };
    }

    const body = await response.text();
    const { articles } = parseFeed(body, source.name);

    // Stamp source-level metadata the feed itself does not carry. Country in
    // particular drives the /india and /world feeds and is never present in RSS.
    const stamped = articles.slice(0, limit).map<RawArticle>((article) => ({
      ...article,
      sourceName: article.sourceName || source.name,
      country: article.country ?? source.country,
      language: article.language ?? source.language,
    }));

    return { articles: stamped };
  } catch (error) {
    // A timeout surfaces as an AbortError; report it like any other feed failure.
    return {
      articles: [],
      error: { target: source.feedUrl, message: toErrorMessage(error) },
    };
  }
};

/** Runs `worker` over `items` with at most `limit` in flight at once. */
const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item);
    }
  });

  await Promise.all(runners);
  return results;
};

const collect = async (
  sources: FeedSource[],
  options: FetchOptions,
): Promise<ProviderFetchResult> => {
  if (sources.length === 0) return emptyResult('rss');

  const outcomes = await mapWithConcurrency(sources, CONCURRENCY, (source) =>
    fetchOne(source, options),
  );

  const articles = outcomes.flatMap((outcome) => outcome.articles);
  const partialErrors = outcomes.flatMap((outcome) => (outcome.error ? [outcome.error] : []));

  if (partialErrors.length > 0) {
    logger.warn(
      { failed: partialErrors.length, total: sources.length },
      'some feeds failed; continuing with the rest',
    );
  }

  return {
    providerKey: 'rss',
    articles,
    requestCount: sources.length,
    partialErrors,
  };
};

export const createRSSProvider = (): NewsProvider => ({
  key: 'rss',
  displayName: 'RSS feeds',

  // Configured as soon as at least one active source has a feed URL.
  isConfigured: async (): Promise<boolean> => {
    const count = await prisma.source.count({
      where: { isActive: true, providerKey: 'rss', feedUrl: { not: null } },
    });
    return count > 0;
  },

  fetchLatestNews: async (options = {}) => collect(await loadFeedSources(), options),

  /**
   * RSS has no query interface, so search is a local filter over the current feed
   * contents rather than a server-side query. Postgres full-text search (Phase 7) is
   * the real search path; this exists so the interface is honestly implemented.
   */
  searchNews: async (query, options = {}) => {
    const result = await collect(await loadFeedSources(), options);
    const needle = query.toLowerCase();
    return {
      ...result,
      articles: result.articles.filter(
        (article) =>
          article.title.toLowerCase().includes(needle) ||
          (article.description?.toLowerCase().includes(needle) ?? false),
      ),
    };
  },

  /** Feeds are per-publisher, not per-category, so this filters on the feed's own hint. */
  fetchByCategory: async (category, options = {}) => {
    const result = await collect(await loadFeedSources(), options);
    const needle = category.toLowerCase();
    return {
      ...result,
      articles: result.articles.filter(
        (article) => article.category?.toLowerCase().includes(needle) ?? false,
      ),
    };
  },

  /** Country comes from the Source row, so this narrows the feed list before fetching. */
  fetchByCountry: async (country, options = {}) => {
    const sources = await loadFeedSources();
    const code = country.toLowerCase();
    return collect(
      sources.filter((source) => source.country?.toLowerCase() === code),
      options,
    );
  },
});
