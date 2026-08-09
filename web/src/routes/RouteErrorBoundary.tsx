import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Router-level error boundary.
 *
 * Catches render errors and failed lazy chunk loads. Without it, an error in any page
 * component unmounts the whole tree and leaves a blank white page with nothing but a
 * console message.
 *
 * A failed dynamic import is called out specifically: it almost always means the user
 * has an old build open after a deploy, and a reload genuinely fixes it.
 */
export const RouteErrorBoundary = () => {
  const error = useRouteError();

  const isChunkLoadError =
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      error.message,
    );

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : isChunkLoadError
      ? 'A new version is available'
      : 'Something went wrong';

  const message = isChunkLoadError
    ? 'This page could not be loaded because the app was updated. Reloading will fix it.'
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred while rendering this page.';

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="size-10 text-brand-500" aria-hidden="true" />
      <h1 className="font-serif text-2xl font-bold">{title}</h1>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>

      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Reload
        </button>
        <Link
          to="/"
          className="rounded-full border border-[var(--border-subtle)] px-5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
};
