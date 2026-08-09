import { Link } from 'react-router-dom';
import type { Article } from '@/types/api';
import { cn } from '@/utils/cn';
import { ArticleImage } from './ArticleImage';
import { ArticleMeta, CoverageBadge } from './ArticleMeta';
import { BookmarkButton } from './BookmarkButton';
import { CategoryTag } from './CategoryTag';

/**
 * The reusable article card.
 *
 * Three variants share one component so spacing, typography and interaction stay
 * consistent everywhere:
 *   - `card`    image on top, used in grids
 *   - `list`    thumbnail beside text, used in sidebars and dense feeds
 *   - `hero`    large lead story
 *
 * Accessibility: the whole card is not a single giant link. Instead the *title* is the
 * link and it carries a `::after` overlay that makes the full card clickable. That way
 * a screen reader announces one meaningful link ("OpenAI announces...") rather than
 * reading out the image, category, source and timestamp as part of the link name, and
 * nested interactive elements (category tag, bookmark) remain reachable.
 */

export type NewsCardVariant = 'card' | 'list' | 'hero';

interface NewsCardProps {
  article: Article;
  variant?: NewsCardVariant;
  /** Skip lazy loading for above-the-fold images. */
  priority?: boolean;
  showCategory?: boolean;
  showDescription?: boolean;
  className?: string;
}

export const NewsCard = ({
  article,
  variant = 'card',
  priority = false,
  showCategory = true,
  showDescription = true,
  className,
}: NewsCardProps) => {
  const href = `/article/${article.id}`;

  if (variant === 'list') {
    return (
      <article
        className={cn(
          'group relative flex gap-4 py-4 transition-opacity focus-within:opacity-100',
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {showCategory && <CategoryTag slug={article.category} />}
          <h3 className="font-serif text-base leading-snug font-semibold">
            <Link
              to={href}
              className="line-clamp-safe-3 after:absolute after:inset-0 after:content-[''] hover:underline decoration-2 underline-offset-2"
            >
              {article.title}
            </Link>
          </h3>
          <ArticleMeta article={article} showReadingTime={false} />
          <CoverageBadge story={article.story} className="relative z-10 mt-0.5 w-fit" />
        </div>

        <ArticleImage
          src={article.imageUrl}
          alt=""
          priority={priority}
          aspect="aspect-[4/3]"
          className="h-20 w-28 shrink-0 sm:h-24 sm:w-36"
        />
      </article>
    );
  }

  if (variant === 'hero') {
    return (
      <article className={cn('group relative flex flex-col gap-4', className)}>
        <ArticleImage
          src={article.imageUrl}
          alt=""
          priority={priority}
          className="w-full shadow-sm"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            {showCategory && <CategoryTag slug={article.category} />}
            <BookmarkButton article={article} className="relative z-10" />
          </div>
          <h2 className="font-serif text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            <Link
              to={href}
              className="after:absolute after:inset-0 after:content-[''] hover:underline decoration-2 underline-offset-4"
            >
              {article.title}
            </Link>
          </h2>
          {showDescription && article.description && (
            <p className="line-clamp-safe-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {article.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ArticleMeta article={article} />
            <CoverageBadge story={article.story} className="relative z-10" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn('group relative flex flex-col gap-3', className)}>
      <ArticleImage src={article.imageUrl} alt="" priority={priority} className="w-full" />
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          {showCategory && <CategoryTag slug={article.category} />}
          <BookmarkButton article={article} className="relative z-10 -mt-1" />
        </div>
        <h3 className="font-serif text-lg leading-snug font-semibold">
          <Link
            to={href}
            className="line-clamp-safe-3 after:absolute after:inset-0 after:content-[''] hover:underline decoration-2 underline-offset-2"
          >
            {article.title}
          </Link>
        </h3>
        {showDescription && article.description && (
          <p className="line-clamp-safe-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {article.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <ArticleMeta article={article} />
        </div>
        <CoverageBadge story={article.story} className="relative z-10 w-fit" />
      </div>
    </article>
  );
};
