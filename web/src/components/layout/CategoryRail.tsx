import { NavLink } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/utils/cn';

/**
 * Horizontally scrollable category rail.
 *
 * On mobile this is the primary way to move between sections, so it scrolls rather
 * than wrapping or collapsing into a menu -- a wrapped rail would push content below
 * the fold on small screens.
 *
 * Rendered from the API taxonomy rather than a hardcoded list, so adding a category in
 * the database surfaces it in the nav with no frontend change.
 */
export const CategoryRail = () => {
  const { data: categories, isPending } = useCategories();

  if (isPending) {
    return (
      <div className="flex gap-6 overflow-hidden py-3" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-4 w-16 shrink-0 animate-shimmer rounded bg-[var(--surface-sunken)]"
          />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) return null;

  // Parents plus their children, flattened: the rail is a flat list of destinations,
  // and hiding "Cricket" behind "Sports" would cost a tap for a very popular section.
  const items = categories.flatMap((category) => [category, ...(category.children ?? [])]);

  return (
    <nav aria-label="News categories" className="relative">
      <ul className="scrollbar-none flex gap-1 overflow-x-auto py-1">
        {items.map((category) => (
          <li key={category.id} className="shrink-0">
            <NavLink
              to={`/category/${category.slug}`}
              className={({ isActive }) =>
                cn(
                  'block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-[var(--text-primary)] text-[var(--surface)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                )
              }
            >
              {category.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
