import { Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Article } from '@/types/api';
import { formatAbsoluteTime, formatReadingTime, formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * The "TechCrunch - 2 hours ago - 3 min read" byline.
 *
 * `<time dateTime>` carries the machine-readable timestamp and `title` the absolute
 * one, so the relative label stays scannable without losing precision on hover.
 */
export const ArticleMeta = ({
  article,
  showReadingTime = true,
  className,
}: {
  article: Article;
  showReadingTime?: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]',
      className,
    )}
  >
    <span className="font-medium text-[var(--text-secondary)]">{article.source.name}</span>
    <span aria-hidden="true">&middot;</span>
    <time dateTime={article.publishedAt} title={formatAbsoluteTime(article.publishedAt)}>
      {formatRelativeTime(article.publishedAt)}
    </time>
    {showReadingTime && (
      <>
        <span aria-hidden="true">&middot;</span>
        <span>{formatReadingTime(article.readingMinutes)}</span>
      </>
    )}
  </div>
);

/**
 * "Covered by N sources" badge.
 *
 * The payoff of the Story clustering model, and the main entry point into coverage
 * comparison -- so it is a link, not decoration. Rendered only when more than one
 * publisher covered the story, since "covered by 1 source" is noise.
 */
export const CoverageBadge = ({
  story,
  className,
}: {
  story: { slug: string; sourceCount: number } | null | undefined;
  className?: string;
}) => {
  if (!story || story.sourceCount < 2) return null;

  return (
    <Link
      to={`/story/${story.slug}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 dark:hover:text-brand-300',
        className,
      )}
    >
      <Layers className="size-3" aria-hidden="true" />
      Covered by {story.sourceCount} sources
    </Link>
  );
};
