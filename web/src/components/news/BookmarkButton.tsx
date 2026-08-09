import { Bookmark } from 'lucide-react';
import type { Article } from '@/types/api';
import { cn } from '@/utils/cn';

/**
 * Bookmark toggle.
 *
 * Phase 2 renders the control but has no persistence: bookmarks need authentication,
 * which lands in Phases 5-6. Rather than ship a button that silently does nothing, it
 * is presented as disabled with an explanatory tooltip, so the affordance is visible in
 * the design without lying about what it does.
 *
 * When auth arrives this component gains the mutation and the `disabled` state goes
 * away; no card markup changes.
 */
export const BookmarkButton = ({
  article,
  className,
}: {
  article: Article;
  className?: string;
}) => {
  const isBookmarked = article.isBookmarked ?? false;

  return (
    <button
      type="button"
      disabled
      aria-label={`Bookmark "${article.title}" (available once sign-in is enabled)`}
      title="Bookmarks arrive with sign-in"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'shrink-0 rounded-full p-1.5 text-[var(--text-muted)] transition-colors',
        'hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        className,
      )}
    >
      <Bookmark className={cn('size-4', isBookmarked && 'fill-current')} aria-hidden="true" />
    </button>
  );
};
