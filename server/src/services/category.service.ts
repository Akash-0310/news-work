import * as articleRepo from '../repositories/article.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';
import type { CategoryDTO } from '../types/domain.js';
import { NotFoundError } from '../utils/errors.js';
import { toCategoryDTO } from './mappers.js';

/**
 * Category taxonomy service.
 *
 * The taxonomy is read on nearly every request (to expand `sports` into its children)
 * but changes only when an admin edits it, so it is memoized in process with a short
 * TTL. This avoids a database round trip per feed request without needing Redis.
 */

interface SlugIndexEntry {
  id: string;
  slug: string;
  weight: number;
  childSlugs: string[];
}

const INDEX_TTL_MS = 60_000;

let indexCache: { loadedAt: number; bySlug: Map<string, SlugIndexEntry> } | null = null;

const loadSlugIndex = async (): Promise<Map<string, SlugIndexEntry>> => {
  if (indexCache && Date.now() - indexCache.loadedAt < INDEX_TTL_MS) {
    return indexCache.bySlug;
  }
  const rows = await categoryRepo.findSlugIndex();
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  indexCache = { loadedAt: Date.now(), bySlug };
  return bySlug;
};

/** Called after an admin mutates the taxonomy so the next read is fresh. */
export const invalidateCategoryCache = (): void => {
  indexCache = null;
};

/**
 * Expands a category slug into the list of slugs a feed query should match.
 *
 * `sports` with children -> ['sports', 'cricket', 'football']; without expansion it
 * returns just the slug itself. Unknown slugs pass through unchanged so a filter on a
 * category that only exists as denormalized article data still works.
 */
export const resolveCategorySlugs = async (
  slug: string,
  includeChildren: boolean,
): Promise<string[]> => {
  if (!includeChildren) return [slug];
  const index = await loadSlugIndex();
  const entry = index.get(slug);
  if (!entry) return [slug];
  return [entry.slug, ...entry.childSlugs];
};

/** Ranking weight for a category, defaulting to neutral for unknown slugs. */
export const getCategoryWeight = async (slug: string): Promise<number> => {
  const index = await loadSlugIndex();
  return index.get(slug)?.weight ?? 1;
};

export const getCategoryId = async (slug: string): Promise<string | null> => {
  const index = await loadSlugIndex();
  return index.get(slug)?.id ?? null;
};

export const listCategories = async (withCounts = false): Promise<CategoryDTO[]> => {
  const [tree, counts] = await Promise.all([
    categoryRepo.findCategoryTree(),
    withCounts ? articleRepo.countByCategory() : Promise.resolve(undefined),
  ]);
  return tree.map((category) => toCategoryDTO(category, counts));
};

export const getCategoryBySlug = async (slug: string): Promise<CategoryDTO> => {
  const category = await categoryRepo.findCategoryBySlug(slug);
  if (!category) throw new NotFoundError('Category');
  return toCategoryDTO(category);
};
