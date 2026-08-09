import type { NewsQueryParams } from '@/types/api';

/**
 * Centralised TanStack Query keys.
 *
 * Defined in one place so cache invalidation is reliable: a key typo scattered across
 * hooks produces a silently stale cache that is very hard to debug. The hierarchy is
 * prefix-based, so `invalidateQueries({ queryKey: queryKeys.news.all })` clears every
 * news query regardless of its parameters.
 */
export const queryKeys = {
  news: {
    all: ['news'] as const,
    lists: () => [...queryKeys.news.all, 'list'] as const,
    list: (params: NewsQueryParams) => [...queryKeys.news.lists(), params] as const,
    category: (slug: string, params: NewsQueryParams) =>
      [...queryKeys.news.all, 'category', slug, params] as const,
    country: (code: string, params: NewsQueryParams) =>
      [...queryKeys.news.all, 'country', code, params] as const,
    home: (perSection: number, topStories: number) =>
      [...queryKeys.news.all, 'home', { perSection, topStories }] as const,
    topStories: (params: Record<string, unknown>) =>
      [...queryKeys.news.all, 'top-stories', params] as const,
    detail: (id: string) => [...queryKeys.news.all, 'detail', id] as const,
    story: (slug: string) => [...queryKeys.news.all, 'story', slug] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: (withCounts: boolean) => [...queryKeys.categories.all, { withCounts }] as const,
    detail: (slug: string) => [...queryKeys.categories.all, 'detail', slug] as const,
  },
} as const;
