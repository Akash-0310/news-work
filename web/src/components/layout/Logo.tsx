import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/** Wordmark. A link to home from everywhere, which is the convention users expect. */
export const Logo = ({ className }: { className?: string }) => (
  <Link
    to="/"
    className={cn('flex shrink-0 items-center gap-2', className)}
    aria-label="NewsFlow home"
  >
    <span
      aria-hidden="true"
      className="grid size-8 place-items-center rounded-lg bg-brand-600 font-serif text-lg font-bold text-white"
    >
      N
    </span>
    <span className="font-serif text-xl font-bold tracking-tight">
      News<span className="text-brand-600 dark:text-brand-400">Flow</span>
    </span>
  </Link>
);
