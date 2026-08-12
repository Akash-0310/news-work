import type { ProviderKey } from '../config/env.js';

/**
 * The provider abstraction.
 *
 * Every external news source sits behind this interface, so the ingestion pipeline
 * never knows whether an article came from an RSS feed, World News API or a sports
 * API. Adding a provider means adding one adapter file and one registry entry; no
 * pipeline, service or route changes.
 *
 * Two rules that keep this honest:
 *  - A provider returns `RawArticle`, never a database shape. Normalization,
 *    validation, dedup and scoring are the pipeline's job, not the adapter's.
 *  - A provider never throws for a partial failure. One dead feed out of twenty is
 *    reported in `partialErrors` and the run continues.
 */

/** Exactly what a provider saw, before any cleaning. Fields are optimistically typed. */
export interface RawArticle {
  /** Provider-native id, if it has one. Namespaced by the pipeline, not here. */
  externalId?: string | null;
  title: string;
  description?: string | null;
  /** Excerpt or summary. Providers rarely supply licensed full text. */
  content?: string | null;
  url: string;
  imageUrl?: string | null;
  /** Publisher display name, e.g. "Reuters". */
  sourceName: string;
  sourceUrl?: string | null;
  author?: string | null;
  /** Any parseable date form; the pipeline coerces and sanity-checks it. */
  publishedAt?: string | Date | null;
  country?: string | null;
  language?: string | null;
  /** Provider's own category hint. Treated as a suggestion, not authoritative. */
  category?: string | null;
}

export interface ProviderFetchResult {
  providerKey: ProviderKey;
  articles: RawArticle[];
  /** Upstream HTTP calls made, which approximates quota burn for metered providers. */
  requestCount: number;
  /**
   * Failures that did not abort the run, one per feed or endpoint. Recorded on the
   * IngestionRun so the admin dashboard can show a consistently failing feed instead
   * of silently ingesting less every cycle.
   */
  partialErrors: ProviderPartialError[];
}

export interface ProviderPartialError {
  /** Feed URL or endpoint that failed. */
  target: string;
  message: string;
}

export interface FetchOptions {
  /** Cap per feed/endpoint, so one prolific source cannot dominate a run. */
  limitPerSource?: number;
  /** Ignore anything older than this. Defaults to the retention window. */
  since?: Date;
  signal?: AbortSignal;
}

export interface NewsProvider {
  readonly key: ProviderKey;
  readonly displayName: string;

  /**
   * False when required configuration (an API key, or any active feed) is absent.
   * The registry skips unconfigured providers rather than letting them fail at
   * runtime, which is what makes every provider key optional.
   */
  isConfigured(): Promise<boolean> | boolean;

  fetchLatestNews(options?: FetchOptions): Promise<ProviderFetchResult>;
  searchNews(query: string, options?: FetchOptions): Promise<ProviderFetchResult>;
  fetchByCategory(category: string, options?: FetchOptions): Promise<ProviderFetchResult>;
  fetchByCountry(country: string, options?: FetchOptions): Promise<ProviderFetchResult>;
}

/** Convenience for adapters: an empty result with the provider's key attached. */
export const emptyResult = (providerKey: ProviderKey): ProviderFetchResult => ({
  providerKey,
  articles: [],
  requestCount: 0,
  partialErrors: [],
});
