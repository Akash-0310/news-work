import { Link } from 'react-router-dom';
import { useCategories, flattenCategories } from '@/hooks/useCategories';
import { humanizeSlug } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Category label.
 *
 * Colour comes from the database (`Category.colorHex`), applied as an inline style
 * because the values are dynamic and Tailwind cannot generate classes for arbitrary
 * runtime hues. Falls back to a neutral tone when the category has no colour or is not
 * in the taxonomy (an article's `category` is a denormalised string, so it can name a
 * category row that no longer exists).
 */
export const CategoryTag = ({
  slug,
  className,
  asLink = true,
}: {
  slug: string;
  className?: string;
  asLink?: boolean;
}) => {
  const { data } = useCategories();
  const category = flattenCategories(data).find((item) => item.slug === slug);

  const label = category?.name ?? humanizeSlug(slug);
  const color = category?.colorHex;

  const classes = cn(
    'inline-flex items-center text-[11px] font-semibold uppercase tracking-wider',
    asLink && 'transition-opacity hover:opacity-70',
    className,
  );

  const style = color ? { color } : undefined;

  if (!asLink) {
    return (
      <span className={cn(classes, !color && 'text-brand-600 dark:text-brand-400')} style={style}>
        {label}
      </span>
    );
  }

  return (
    <Link
      to={`/category/${slug}`}
      className={cn(classes, !color && 'text-brand-600 dark:text-brand-400')}
      style={style}
      // The card itself is a link to the article; stop the tag click bubbling into it.
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
};
