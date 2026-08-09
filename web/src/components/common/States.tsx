import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { ApiError } from '@/services/api/client';
import { cn } from '@/utils/cn';

/**
 * Error and empty states.
 *
 * Both are explicit components rather than inline JSX because they appear on every
 * data-driven page and must stay consistent. The error state distinguishes "the API is
 * unreachable" from "the API said no" -- those need different user actions, and a
 * generic "Something went wrong" helps nobody diagnose a server that simply is not
 * running.
 */

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  /** Compact variant for use inside a section rather than a whole page. */
  compact?: boolean;
}

const describe = (error: unknown): { title: string; message: string; offline: boolean } => {
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return {
        title: 'Cannot reach the server',
        message: error.message,
        offline: true,
      };
    }
    if (error.isNotFound) {
      return {
        title: 'Not found',
        message: 'That content does not exist, or it may have been removed.',
        offline: false,
      };
    }
    return { title: 'Something went wrong', message: error.message, offline: false };
  }

  return {
    title: 'Something went wrong',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    offline: false,
  };
};

export const ErrorState = ({ error, onRetry, className, compact = false }: ErrorStateProps) => {
  const { title, message, offline } = describe(error);
  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] text-center',
        compact ? 'px-4 py-8' : 'px-6 py-16',
        className,
      )}
    >
      <Icon className={cn('text-brand-500', compact ? 'size-6' : 'size-9')} aria-hidden="true" />
      <div>
        <p className={cn('font-semibold', compact ? 'text-sm' : 'text-lg')}>{title}</p>
        <p
          className={cn(
            'mx-auto mt-1 max-w-md text-[var(--text-secondary)]',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
};

export const EmptyState = ({
  title = 'Nothing here yet',
  message = 'There are no articles to show right now. Check back shortly.',
  action,
  className,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] px-6 py-16 text-center',
      className,
    )}
  >
    <Inbox className="size-9 text-[var(--text-muted)]" aria-hidden="true" />
    <div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
    {action}
  </div>
);
