import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { flattenPages, useCategoryFeed } from '@/hooks/useNews';
import { flattenCategories, useCategories } from '@/hooks/useCategories';
import { NewsGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { NewsCard } from '@/components/news/NewsCard';
import { humanizeSlug } from '@/utils/format';
import type { ArticleSort } from '@/types/api';
import { CategoryFilters, type FilterValues } from './CategoryFilters';

/**
 * Category feed with filtering, sorting and incremental loading.
 *
 * Filter state lives in the URL query string, not component state. That makes a
 * filtered view shareable and bookmarkable, survives a refresh, and lets the browser
 * back button step through filter changes -- none of which `useState` gives you.
 */
const VALID_SORTS: ArticleSort[] = ['latest', 'oldest', 'importance', 'popular'];

const parseSort = (value: string | null): ArticleSort =>
  VALID_SORTS.includes(value as ArticleSort) ? (value as ArticleSort) : 'latest';

const CategoryPage = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterValues = useMemo(
    () => ({
      sort: parseSort(searchParams.get('sort')),
      source: searchParams.get('source') ?? '',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
      country: searchParams.get('country') ?? '',
    }),
    [searchParams],
  );

  const { data: categories } = useCategories();
  const category = flattenCategories(categories).find((item) => item.slug === slug);

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCategoryFeed(slug, {
    limit: 12,
    sort: filters.sort,
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.country ? { country: filters.country } : {}),
  });

  const { articles, total } = flattenPages(data);

  const updateFilters = (next: Partial<FilterValues>): void => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };

  const clearFilters = (): void => setSearchParams(new URLSearchParams(), { replace: true });

  const title = category?.name ?? humanizeSlug(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {!isPending && !isError && (
            <span className="text-sm text-[var(--text-muted)]">
              {total.toLocaleString()} {total === 1 ? 'article' : 'articles'}
            </span>
          )}
        </div>

        {category?.description && (
          <p className="mt-2 max-w-2xl text-[15px] text-[var(--text-secondary)]">
            {category.description}
          </p>
        )}

        {/* Child categories act as refinements, e.g. Sports -> Cricket, Football. */}
        {category?.children && category.children.length > 0 && (
          <ul className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
            {category.children.map((child) => (
              <li key={child.id}>
                <a
                  href={`/category/${child.slug}`}
                  className="inline-block rounded-full border border-[var(--border-subtle)] px-3 py-1 text-sm whitespace-nowrap transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  {child.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      <CategoryFilters
        values={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        className="mb-8"
      />

      {isPending ? (
        <NewsGridSkeleton count={9} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : articles.length === 0 ? (
        <EmptyState
          title="No articles match"
          message="Try removing a filter or widening the date range."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <NewsCard
                key={article.id}
                article={article}
                // Only the first row is above the fold on most viewports.
                priority={index < 3}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-full border border-[var(--border-subtle)] px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)] disabled:cursor-wait disabled:opacity-60"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load more articles'}
              </button>
            </div>
          )}

          {/* Announce new results to screen readers, which otherwise get no signal
              that content appeared below the button they just pressed. */}
          <p aria-live="polite" className="sr-only">
            Showing {articles.length} of {total} articles
          </p>
        </>
      )}
    </div>
  );
};

export default CategoryPage;
