-- Drops two partial indexes that an earlier revision of the fulltext_search migration
-- created.
--
-- Rationale: Prisma cannot express partial indexes (`WHERE status = 'PUBLISHED'`), so
-- keeping them made `prisma migrate diff` report permanent, unfixable drift -- which
-- trains everyone to ignore drift warnings. The composite indexes declared in
-- schema.prisma already serve the same queries:
--   * news_articles_status_publishedAt_idx    covers the feed's status + recency scan
--   * news_articles_category_importanceScore_idx  covers category section ranking
--
-- Forward-only: the already-applied migration is left untouched rather than edited,
-- so any environment that ran the earlier version converges to the same schema.

DROP INDEX IF EXISTS "news_articles_published_feed_idx";
DROP INDEX IF EXISTS "news_articles_category_feed_idx";
