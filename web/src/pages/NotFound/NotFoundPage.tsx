import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

const NotFoundPage = () => (
  <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
    <p className="font-serif text-6xl font-bold text-brand-600 dark:text-brand-400">404</p>
    <h1 className="font-serif text-2xl font-bold">This page does not exist</h1>
    <p className="text-sm text-[var(--text-secondary)]">
      The link may be out of date, or the article may have been removed by its publisher.
    </p>

    <div className="mt-2 flex flex-wrap justify-center gap-3">
      <Link
        to="/"
        className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Go to homepage
      </Link>
      <Link
        to="/explore"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-5 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
      >
        <Compass className="size-4" aria-hidden="true" />
        Explore topics
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
