import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import * as newsApi from '@/services/api/news.api';
import type { ApiError } from '@/services/api/client';
import { queryKeys } from './queryKeys';
import type { Article, ArticleDetail, HomeFeed, NewsQueryParams, Page, Story } from '@/types/api';

/**
 * Data hooks.
 *
 * Components never call the API modules directly; they use these. That keeps caching
 * policy, retry behaviour and key structure out of the UI, and means a change to
 * staleness rules happens in one file.
 *
 * Staleness is tuned per resource to match how fast the underlying data actually
 * changes: a category taxonomy is effectively static, a news feed is not.
 */

const ONE_MINUTE = 60_000;

export const useHomeFeed = (
  perSection = 6,
  topStories = 6,
): UseQueryResult<HomeFeed, ApiError> =>
  useQuery({
    queryKey: queryKeys.news.home(perSection, topStories),
    queryFn: () => newsApi.fetchHomeFeed({ perSection, topStories }),
    // Matches the server's 2-minute cache for latest news: refetching sooner cannot
    // return anything new.
    staleTime: 2 * ONE_MINUTE,
  });

export const useNewsList = (params: NewsQueryParams): UseQueryResult<Page<Article>, ApiError> =>
  useQuery({
    queryKey: queryKeys.news.list(params),
    queryFn: () => newsApi.fetchNews(params),
    staleTime: 2 * ONE_MINUTE,
    // Keeps the previous page visible while the next one loads, so paging does not
    // flash an empty list.
    placeholderData: keepPreviousData,
  });

/**
 * Infinite "load more" feed for category pages.
 *
 * Page-number based rather than cursor based because the API exposes offset
 * pagination. Fine at these page depths; if feeds grow deep enough for offset scans to
 * hurt, the server can add a cursor and only this hook changes.
 */
export const useCategoryFeed = (
  category: string,
  params: Omit<NewsQueryParams, 'page' | 'category'> = {},
): UseInfiniteQueryResult<{ pages: Page<Article>[]; pageParams: number[] }, ApiError> =>
  useInfiniteQuery({
    queryKey: queryKeys.news.category(category, params),
    queryFn: ({ pageParam }) => newsApi.fetchNewsByCategory(category, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    staleTime: 2 * ONE_MINUTE,
    enabled: category.length > 0,
  });

export const useCountryFeed = (
  country: string,
  params: Omit<NewsQueryParams, 'page' | 'country'> = {},
): UseInfiniteQueryResult<{ pages: Page<Article>[]; pageParams: number[] }, ApiError> =>
  useInfiniteQuery({
    queryKey: queryKeys.news.country(country, params),
    queryFn: ({ pageParam }) => newsApi.fetchNewsByCountry(country, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    staleTime: 2 * ONE_MINUTE,
    enabled: country.length > 0,
  });

export const useTopStories = (
  params: { limit?: number; category?: string; country?: string; hours?: number } = {},
): UseQueryResult<Story[], ApiError> =>
  useQuery({
    queryKey: queryKeys.news.topStories(params),
    queryFn: () => newsApi.fetchTopStories(params),
    staleTime: 2 * ONE_MINUTE,
  });

export const useArticle = (id: string | undefined): UseQueryResult<ArticleDetail, ApiError> =>
  useQuery({
    queryKey: queryKeys.news.detail(id ?? ''),
    queryFn: () => newsApi.fetchArticle(id as string),
    enabled: Boolean(id),
    // An article's text does not change once published; only its counters do.
    staleTime: 10 * ONE_MINUTE,
  });

export const useStory = (slug: string | undefined): UseQueryResult<Story, ApiError> =>
  useQuery({
    queryKey: queryKeys.news.story(slug ?? ''),
    queryFn: () => newsApi.fetchStory(slug as string),
    enabled: Boolean(slug),
    staleTime: 5 * ONE_MINUTE,
  });

/** Flattens infinite-query pages into a single array for rendering. */
export const flattenPages = (
  data: { pages: Page<Article>[] } | undefined,
): { articles: Article[]; total: number } => {
  if (!data) return { articles: [], total: 0 };
  return {
    articles: data.pages.flatMap((page) => page.items),
    total: data.pages[0]?.pagination.total ?? 0,
  };
};
