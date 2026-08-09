import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import * as categoriesApi from '@/services/api/categories.api';
import type { ApiError } from '@/services/api/client';
import { queryKeys } from './queryKeys';
import type { Category } from '@/types/api';

/**
 * The taxonomy changes only when an admin edits it, so it is cached aggressively.
 * Every page renders the nav from this, and a per-navigation refetch would be pure
 * waste.
 */
const CATEGORY_STALE_TIME = 30 * 60_000;

export const useCategories = (withCounts = false): UseQueryResult<Category[], ApiError> =>
  useQuery({
    queryKey: queryKeys.categories.list(withCounts),
    queryFn: () => categoriesApi.fetchCategories(withCounts),
    staleTime: CATEGORY_STALE_TIME,
  });

export const useCategory = (slug: string | undefined): UseQueryResult<Category, ApiError> =>
  useQuery({
    queryKey: queryKeys.categories.detail(slug ?? ''),
    queryFn: () => categoriesApi.fetchCategory(slug as string),
    enabled: Boolean(slug),
    staleTime: CATEGORY_STALE_TIME,
  });

/** Flattens the tree so a slug lookup does not need to recurse at every call site. */
export const flattenCategories = (categories: Category[] | undefined): Category[] => {
  if (!categories) return [];
  return categories.flatMap((category) => [category, ...(category.children ?? [])]);
};
