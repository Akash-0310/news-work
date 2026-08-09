import { ExternalLink, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Article } from '@/types/api';
import { domainFromUrl, formatRelativeTime } from '@/utils/format';

/**
 * "Covered by other sources" panel.
 *
 * The payoff of the Story clustering model: the same event as reported by different
 * publishers, so a reader can compare framing directly. Headlines are shown verbatim
 * because the *difference between them* is the entire point -- normalising them would
 * destroy the signal.
 *
 * Ordered by publisher trust (the API sorts it), and each entry shows how much earlier
 * or later that outlet published relative to the article being read.
 */
export const CoverageList = ({
  articles,
  storySlug,
  publishedAt,
}: {
  articles: Article[];
  storySlug: string | null;
  publishedAt: string;
}) => {
  const referenceTime = new Date(publishedAt).getTime();

  return (
    <section className="mt-14" aria-labelledby="coverage-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <h2 id="coverage-heading" className="font-serif text-xl font-bold sm:text-2xl">
            Also covered by {articles.length}{' '}
            {articles.length === 1 ? 'other source' : 'other sources'}
          </h2>
        </div>

        {storySlug && (
          <Link
            to={`/story/${storySlug}`}
            className="shrink-0 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            Compare all
          </Link>
        )}
      </div>

      <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
        {articles.map((item) => {
          const deltaMinutes = Math.round(
            (new Date(item.publishedAt).getTime() - referenceTime) / 60_000,
          );

          return (
            <li key={item.id} className="p-4 transition-colors hover:bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--text-secondary)]">
                  {item.source.name}
                </span>
                {item.source.trustScore !== null && (
                  <span
                    className="text-[var(--text-muted)]"
                    title="Editorial reliability weight used by the ranking algorithm"
                  >
                    trust {item.source.trustScore.toFixed(2)}
                  </span>
                )}
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  &middot;
                </span>
                <span className="text-[var(--text-muted)]">
                  {formatRelativeTime(item.publishedAt)}
                  {deltaMinutes !== 0 && (
                    <>
                      {' '}
                      ({deltaMinutes > 0 ? `${deltaMinutes}m later` : `${-deltaMinutes}m earlier`})
                    </>
                  )}
                </span>
              </div>

              <h3 className="mt-1.5 font-serif text-[15px] leading-snug font-semibold">
                <Link to={`/article/${item.id}`} className="hover:underline underline-offset-2">
                  {item.title}
                </Link>
              </h3>

              {item.description && (
                <p className="line-clamp-safe-2 mt-1 text-sm text-[var(--text-secondary)]">
                  {item.description}
                </p>
              )}

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {domainFromUrl(item.url) || 'Open source'}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
