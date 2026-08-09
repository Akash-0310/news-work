import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/**
 * Section heading with an optional "View all" link.
 *
 * The rule below the heading is decorative, so it is `aria-hidden` and built with a
 * flex spacer rather than a border, letting the label sit tight against the text at
 * any length.
 */
export const SectionHeader = ({
  title,
  viewAllHref,
  viewAllLabel = 'View all',
  accentColor,
  className,
}: {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  accentColor?: string | null;
  className?: string;
}) => (
  <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="h-5 w-1 shrink-0 rounded-full bg-brand-500"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      />
      <h2 className="font-serif text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
    </div>

    {viewAllHref && (
      <Link
        to={viewAllHref}
        className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-brand-600 dark:hover:text-brand-400"
      >
        {viewAllLabel}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    )}
  </div>
);
