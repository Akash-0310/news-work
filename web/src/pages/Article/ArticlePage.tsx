import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useArticle } from '@/hooks/useNews';
import { Skeleton, SkeletonRegion } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { ArticleImage } from '@/components/news/ArticleImage';
import { CategoryTag } from '@/components/news/CategoryTag';
import { NewsCard } from '@/components/news/NewsCard';
import { SectionHeader } from '@/components/news/SectionHeader';
import { BookmarkButton } from '@/components/news/BookmarkButton';
import {
  domainFromUrl,
  formatAbsoluteTime,
  formatReadingTime,
  formatRelativeTime,
} from '@/utils/format';
import { CoverageList } from './CoverageList';

/**
 * Article detail.
 *
 * Deliberately *not* a full article reader. We store a headline, an excerpt and
 * metadata; the body stays with the publisher. So the page's job is to summarise, show
 * how other outlets covered the same event, and hand the reader off to the source with
 * a prominent, unambiguous link.
 */
const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error, refetch } = useArticle(id);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <SkeletonRegion label="Loading article">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-full" />
          <Skeleton className="mt-2 h-9 w-3/4" />
          <Skeleton className="mt-5 h-4 w-52" />
          <Skeleton className="mt-6 aspect-[16/9] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </SkeletonRegion>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const { article, coverage, related } = data;
  const sourceDomain = domainFromUrl(article.url);

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to={`/category/${article.category}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to news
      </Link>

      <header>
        <CategoryTag slug={article.category} />

        <h1 className="mt-3 font-serif text-3xl leading-tight font-bold tracking-tight sm:text-[2.6rem]">
          {article.title}
        </h1>

        {article.description && (
          <p className="mt-4 text-lg leading-relaxed text-[var(--text-secondary)]">
            {article.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border-subtle)] py-4">
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {article.source.name}
              {article.author && (
                <span className="font-normal text-[var(--text-secondary)]"> - {article.author}</span>
              )}
            </p>
            <p className="mt-0.5 text-[var(--text-muted)]">
              <time dateTime={article.publishedAt} title={formatAbsoluteTime(article.publishedAt)}>
                {formatAbsoluteTime(article.publishedAt)}
              </time>
              <span aria-hidden="true"> &middot; </span>
              {formatReadingTime(article.readingMinutes)}
            </p>
          </div>

          <BookmarkButton article={article} />
        </div>
      </header>

      {article.imageUrl && (
        <figure className="mt-8">
          <ArticleImage src={article.imageUrl} alt="" priority className="w-full" />
          <figcaption className="mt-2 text-xs text-[var(--text-muted)]">
            Image credit: {article.source.name}
          </figcaption>
        </figure>
      )}

      {article.content && (
        <div className="mt-8">
          <p className="font-serif text-[1.0625rem] leading-[1.8] whitespace-pre-line">
            {article.content}
          </p>
          {/* Honest about what this is. The reader should never think a two-paragraph
              excerpt is the publisher's whole piece. */}
          {!article.isFullContent && (
            <p className="mt-4 text-sm text-[var(--text-muted)] italic">
              This is a summary. Read the complete article at {article.source.name}.
            </p>
          )}
        </div>
      )}

      <a
        href={article.url}
        target="_blank"
        // noopener prevents the opened page from reaching back via window.opener;
        // noreferrer also withholds the referrer header.
        rel="noopener noreferrer"
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
      >
        Read full article at {sourceDomain || article.source.name}
        <ExternalLink className="size-4" aria-hidden="true" />
      </a>

      {article.topics.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            Topics
          </span>
          {article.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {coverage.length > 0 && (
        <CoverageList
          articles={coverage}
          storySlug={article.story?.slug ?? null}
          publishedAt={article.publishedAt}
        />
      )}

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related-heading">
          <SectionHeader title="Related stories" />
          <h2 id="related-heading" className="sr-only">
            Related stories
          </h2>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
            {related.slice(0, 4).map((item) => (
              <NewsCard key={item.id} article={item} showDescription={false} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-xs leading-relaxed text-[var(--text-muted)]">
        NewsFlow aggregates headlines and short excerpts and links to the original
        reporting. Full article text remains the property of{' '}
        {article.source.name}. Published {formatRelativeTime(article.publishedAt)}.
      </p>
    </article>
  );
};

export default ArticlePage;
