import { env, type ProviderKey } from '../config/env.js';
import { log } from '../config/logger.js';
import { createRSSProvider } from './RSSProvider.js';
import type { NewsProvider } from './NewsProvider.js';

const logger = log('providers');

/**
 * Provider registry.
 *
 * Which providers run is configuration (`ENABLED_PROVIDERS`), not code. A provider that
 * is enabled but unconfigured (no API key, no active feeds) is skipped with a warning
 * rather than failing the run, which is what makes every provider key genuinely
 * optional and lets the app work with none of them set.
 */

type ProviderFactory = () => NewsProvider;

/**
 * Adapters that exist today. Keys absent from this map are accepted by the env schema
 * but not yet implemented, so they are reported as unimplemented instead of silently
 * doing nothing.
 */
const FACTORIES: Partial<Record<ProviderKey, ProviderFactory>> = {
  rss: createRSSProvider,
  // worldnews, newsapi, apitube, sports: adapters land as each is needed. Because they
  // sit behind NewsProvider, adding one touches this map and one new file.
};

export const getEnabledProviders = async (): Promise<NewsProvider[]> => {
  const requested = env.enabledProviders;

  if (requested.length === 0) {
    logger.warn(
      'ENABLED_PROVIDERS is empty; ingestion will fetch nothing. Set it to "rss" for key-free news.',
    );
    return [];
  }

  const providers: NewsProvider[] = [];

  for (const key of requested) {
    const factory = FACTORIES[key];
    if (!factory) {
      logger.warn({ provider: key }, 'provider is enabled but has no adapter yet; skipping');
      continue;
    }

    const provider = factory();
    if (!(await provider.isConfigured())) {
      logger.warn(
        { provider: key },
        'provider is enabled but not configured (missing key or no active sources); skipping',
      );
      continue;
    }

    providers.push(provider);
  }

  if (providers.length === 0) {
    logger.warn({ requested }, 'no provider is both enabled and configured');
  }

  return providers;
};

export type { NewsProvider, RawArticle, ProviderFetchResult } from './NewsProvider.js';
