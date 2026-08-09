import { Layers } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useStory } from '@/hooks/useNews';
import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { ArticleImage } from '@/components/news/ArticleImage';
import { CategoryTag } from '@/components/news/CategoryTag';
import { CoverageList } from './CoverageList';
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/format';

/**
 * Story page: one event, every publisher's version of it.
 *
 * This is the "compare coverage" surface. The lead article (highest-trust publisher)
 * heads the page, and the rest of the cluster follows so differences in framing across
 * outlets are visible side by side.
 */
const StoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: story, isPending, isError, error, refetch } = useStory(slug);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <SkeletonRegion label="Loading story">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-9 w-full" />
          <Skeleton className="mt-2 h-9 w-2/3" />
          <Skeleton className="mt-6 aspect-[16/9] w-full rounded-[var(--radius-card)]" />
        </SkeletonRegion>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const lead = story.leadArticle;
  const others = (story.articles ?? []).filter((item) => item.id !== lead?.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
        <Layers className="size-3.5" aria-hidden="true" />
        Story followed by {story.sourceCount}{' '}
        {story.sourceCount === 1 ? 'publisher' : 'publishers'}
      </div>

      {story.category && <CategoryTag slug={story.category} className="ml-1" />}

      <h1 className="mt-3 font-serif text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
        {story.title}
      </h1>

      {story.summary && (
        <p className="mt-4 text-lg leading-relaxed text-[var(--text-secondary)]">
          {story.summary}
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--text-muted)]">
        First reported{' '}
        <time dateTime={story.firstSeenAt} title={formatAbsoluteTime(story.firstSeenAt)}>
          {formatRelativeTime(story.firstSeenAt)}
        </time>
        <span aria-hidden="true"> &middot; </span>
        latest update{' '}
        <time dateTime={story.lastPublishedAt}>
          {formatRelativeTime(story.lastPublishedAt)}
        </time>
      </p>

      {(story.imageUrl ?? lead?.imageUrl) && (
        <ArticleImage
          src={story.imageUrl ?? lead?.imageUrl ?? null}
          alt=""
          priority
          className="mt-8 w-full"
        />
      )}

      {lead && (
        <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-5">
          <p className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            Lead coverage
          </p>
          <h2 className="mt-2 font-serif text-xl leading-snug font-bold">
            <Link to={`/article/${lead.id}`} className="hover:underline underline-offset-2">
              {lead.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {lead.source.name} &middot; {formatRelativeTime(lead.publishedAt)}
          </p>
          {lead.description && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {lead.description}
            </p>
          )}
        </section>
      )}

      {others.length > 0 && (
        <CoverageList
          articles={others}
          storySlug={null}
          publishedAt={lead?.publishedAt ?? story.lastPublishedAt}
        />
      )}
    </div>
  );
};

export default StoryPage;
