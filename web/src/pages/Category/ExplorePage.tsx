import { Link } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';

/**
 * Category index.
 *
 * The destination for the mobile "Explore" tab and the full taxonomy view that the
 * header rail cannot show. Article counts come from `?withCounts=true` so a section
 * that is empty is obviously empty before the user taps into it.
 */
const ExplorePage = () => {
  const { data: categories, isPending, isError, error, refetch } = useCategories(true);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Explore</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-[var(--text-secondary)]">
          Every section, from national politics to cricket. Pick a topic to see the latest
          reporting on it.
        </p>
      </header>

      {isPending ? (
        <SkeletonRegion label="Loading categories">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-[var(--radius-card)]" />
            ))}
          </div>
        </SkeletonRegion>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => (
            <section
              key={category.id}
              className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-5 transition-colors hover:border-[var(--text-muted)]"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/category/${category.slug}`}
                  className="font-serif text-lg font-bold hover:underline decoration-2 underline-offset-2"
                  style={category.colorHex ? { color: category.colorHex } : undefined}
                >
                  {category.name}
                </Link>
                {typeof category.articleCount === 'number' && (
                  <span className="shrink-0 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {category.articleCount}
                  </span>
                )}
              </div>

              {category.description && (
                <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                  {category.description}
                </p>
              )}

              {category.children && category.children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        to={`/category/${child.slug}`}
                        className="inline-block rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        {child.name}
                        {typeof child.articleCount === 'number' && child.articleCount > 0 && (
                          <span className="ml-1 opacity-60">{child.articleCount}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
