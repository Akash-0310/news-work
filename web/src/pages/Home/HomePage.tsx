import { useHomeFeed } from '@/hooks/useNews';
import { HeroSkeleton, NewsGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { NewsCard } from '@/components/news/NewsCard';
import { SectionHeader } from '@/components/news/SectionHeader';
import { TopStories } from './TopStories';
import type { Article } from '@/types/api';

/**
 * Homepage.
 *
 * Renders from a single `/api/news/home` request rather than one request per section.
 * That is one round trip instead of ten, one cache entry on the server, and no
 * waterfall of independent spinners on first paint.
 *
 * Section order and membership are decided by the server, so editorial changes to the
 * homepage do not require a frontend deploy.
 */
const HomePage = () => {
  const { data, isPending, isError, error, refetch } = useHomeFeed(6, 6);

  if (isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
        <HeroSkeleton />
        <NewsGridSkeleton count={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const { topStories, latest, sections } = data;
  const hasAnything = topStories.length > 0 || latest.length > 0 || sections.length > 0;

  if (!hasAnything) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="No news yet"
          message="The database has no articles. Run `npm run db:seed` for sample data, or start the ingestion worker to fetch live news."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {topStories.length > 0 && <TopStories stories={topStories} />}

      {latest.length > 0 && <LatestStrip articles={latest} />}

      <div className="mt-12 space-y-14">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={`section-${section.key}`}>
            <SectionHeader
              title={section.label}
              viewAllHref={`/category/${section.category}`}
            />
            <h2 id={`section-${section.key}`} className="sr-only">
              {section.label}
            </h2>

            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {section.articles.map((article) => (
                <NewsCard key={article.id} article={article} showCategory={false} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

/**
 * "Latest news" chronological strip.
 *
 * A horizontal scroller on mobile and a compact list on desktop: it is a scanning
 * surface, not a reading one, so density beats imagery here.
 */
const LatestStrip = ({ articles }: { articles: Article[] }) => (
  <section className="mt-12" aria-labelledby="latest-heading">
    <SectionHeader title="Latest" viewAllHref="/category/india" viewAllLabel="Browse all" />
    <h2 id="latest-heading" className="sr-only">
      Latest news
    </h2>

    <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-4">
      {articles.slice(0, 8).map((article) => (
        <div key={article.id} className="sm:border-b sm:border-[var(--border-subtle)]">
          <NewsCard article={article} variant="list" showDescription={false} />
        </div>
      ))}
    </div>
  </section>
);

export default HomePage;
