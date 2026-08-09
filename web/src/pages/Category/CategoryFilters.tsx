import { SlidersHorizontal, X } from 'lucide-react';
import type { ArticleSort } from '@/types/api';
import { cn } from '@/utils/cn';

/**
 * Sort and filter controls for a category feed.
 *
 * A controlled, stateless component: the page owns the values (in the URL) and this
 * only renders and reports changes. Keeping it stateless is what allows the URL to be
 * the single source of truth without a second copy drifting out of sync.
 */

export interface FilterValues {
  sort: ArticleSort;
  source: string;
  from: string;
  to: string;
  country: string;
}

const SORT_OPTIONS: { value: ArticleSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'importance', label: 'Most important' },
  { value: 'popular', label: 'Most read' },
  { value: 'oldest', label: 'Oldest' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'All countries' },
  { value: 'in', label: 'India' },
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
];

const controlClasses =
  'rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none';

export const CategoryFilters = ({
  values,
  onChange,
  onClear,
  className,
}: {
  values: FilterValues;
  onChange: (next: Partial<FilterValues>) => void;
  onClear: () => void;
  className?: string;
}) => {
  const hasActiveFilters = Boolean(
    values.source || values.from || values.to || values.country || values.sort !== 'latest',
  );

  // `to` cannot be earlier than `from`: the API rejects that with a 422, so prevent it
  // in the UI rather than surfacing a validation error the user cannot act on.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span>Filters</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-sort" className="text-xs text-[var(--text-muted)]">
          Sort by
        </label>
        <select
          id="filter-sort"
          value={values.sort}
          onChange={(event) => onChange({ sort: event.target.value as ArticleSort })}
          className={controlClasses}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-country" className="text-xs text-[var(--text-muted)]">
          Country
        </label>
        <select
          id="filter-country"
          value={values.country}
          onChange={(event) => onChange({ country: event.target.value })}
          className={controlClasses}
        >
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-source" className="text-xs text-[var(--text-muted)]">
          Source
        </label>
        <input
          id="filter-source"
          type="text"
          value={values.source}
          placeholder="e.g. Reuters"
          onChange={(event) => onChange({ source: event.target.value })}
          className={cn(controlClasses, 'w-36')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-from" className="text-xs text-[var(--text-muted)]">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          value={values.from}
          max={values.to || today}
          onChange={(event) => onChange({ from: event.target.value })}
          className={controlClasses}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-to" className="text-xs text-[var(--text-muted)]">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          value={values.to}
          min={values.from}
          max={today}
          onChange={(event) => onChange({ to: event.target.value })}
          className={controlClasses}
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          <X className="size-4" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
};
