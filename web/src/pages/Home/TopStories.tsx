import { NewsCard } from '@/components/news/NewsCard';
import { SectionHeader } from '@/components/news/SectionHeader';
import type { Story } from '@/types/api';

/**
 * Top stories block: one large lead plus a ranked list.
 *
 * Stories, not articles. Each entry is a clustered event, so the card can show how many
 * publishers covered it -- which is the ranking signal the backend actually used to put
 * it here. A story whose lead article is missing (all coverage hidden by an admin) is
 * skipped rather than rendered as an empty slot.
 */
export const TopStories = ({ stories }: { stories: Story[] }) => {
  const withLead = stories.filter((story) => story.leadArticle !== null);
  const [lead, ...rest] = withLead;

  if (!lead?.leadArticle) return null;

  return (
    <section aria-labelledby="top-stories-heading">
      <SectionHeader title="Top Stories" />
      <h2 id="top-stories-heading" className="sr-only">
        Top stories
      </h2>

      <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
        <NewsCard
          article={lead.leadArticle}
          variant="hero"
          // The single most important image on the page: load it eagerly so it is not
          // deprioritised behind lazy images further down.
          priority
        />

        {rest.length > 0 && (
          <div className="divide-y divide-[var(--border-subtle)] lg:border-l lg:border-[var(--border-subtle)] lg:pl-8">
            {rest.slice(0, 5).map((story) =>
              story.leadArticle ? (
                <NewsCard
                  key={story.id}
                  article={story.leadArticle}
                  variant="list"
                  showDescription={false}
                />
              ) : null,
            )}
          </div>
        )}
      </div>
    </section>
  );
};
