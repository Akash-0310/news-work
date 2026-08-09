import { PrismaClient, type Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { loadEnvFiles } from '../src/config/loadEnv.js';
import { calculateImportanceScore, calculateTrendingScore } from '../src/pipeline/ranking.js';
import { hashTitle, slugify, titleTokens } from '../src/utils/text.js';
import { canonicalizeUrl, hashUrl } from '../src/utils/url.js';
import { CATEGORIES, SOURCES, STORIES, imageForSlug, type SeedStory } from './seed-data.js';

/**
 * Database seed.
 *
 * Two properties matter here:
 *
 * 1. **Idempotent.** Everything is upserted on a natural key, so `npm run db:seed` can
 *    run repeatedly (and on top of real ingested data) without duplicating rows or
 *    throwing on unique constraints.
 *
 * 2. **Uses the real pipeline.** Slugs, URL hashes, title hashes and importance scores
 *    are produced by the same functions the ingestion worker uses, rather than being
 *    hardcoded. Seeded rows are therefore indistinguishable from fetched ones, and a
 *    bug in those helpers shows up here instead of only in production.
 */

// Must happen before PrismaClient is constructed: the client resolves DATABASE_URL at
// construction time. This script is executed directly by tsx rather than by the Prisma
// CLI, so nothing else would have loaded the root .env for it.
loadEnvFiles();

const prisma = new PrismaClient();

/** Fixed reference time so all relative timestamps in one run are consistent. */
const NOW = new Date();

const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 3_600_000);

const seedCategories = async (): Promise<Map<string, string>> => {
  const idBySlug = new Map<string, string>();

  // Two passes: every parent must exist before a child can reference it.
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        weight: category.weight,
        position: category.position,
        isPrimary: category.isPrimary,
        colorHex: category.colorHex,
        iconName: category.iconName,
      },
      update: {
        name: category.name,
        description: category.description,
        weight: category.weight,
        position: category.position,
        isPrimary: category.isPrimary,
        colorHex: category.colorHex,
        iconName: category.iconName,
      },
      select: { id: true },
    });
    idBySlug.set(category.slug, row.id);
  }

  for (const category of CATEGORIES) {
    if (!category.parentSlug) continue;
    const parentId = idBySlug.get(category.parentSlug);
    if (!parentId) {
      throw new Error(`Category "${category.slug}" references unknown parent "${category.parentSlug}"`);
    }
    await prisma.category.update({ where: { slug: category.slug }, data: { parentId } });
  }

  console.log(`  categories: ${idBySlug.size}`);
  return idBySlug;
};

interface SourceInfo {
  id: string;
  name: string;
  domain: string;
  homepage: string;
  trustScore: number;
}

const seedSources = async (): Promise<Map<string, SourceInfo>> => {
  const bySlug = new Map<string, SourceInfo>();

  for (const source of SOURCES) {
    const row = await prisma.source.upsert({
      where: { slug: source.slug },
      create: {
        name: source.name,
        slug: source.slug,
        domain: source.domain,
        homepage: source.homepage,
        country: source.country,
        trustScore: source.trustScore,
        ...(source.feedUrl ? { feedUrl: source.feedUrl, providerKey: 'rss' } : {}),
      },
      update: {
        name: source.name,
        domain: source.domain,
        homepage: source.homepage,
        country: source.country,
        trustScore: source.trustScore,
        ...(source.feedUrl ? { feedUrl: source.feedUrl, providerKey: 'rss' } : {}),
      },
      select: { id: true, name: true, domain: true, homepage: true, trustScore: true },
    });

    bySlug.set(source.slug, {
      id: row.id,
      name: row.name,
      domain: row.domain,
      homepage: row.homepage ?? source.homepage,
      trustScore: row.trustScore,
    });
  }

  console.log(`  sources: ${bySlug.size}`);
  return bySlug;
};

/**
 * Builds a plausible article URL for seeded coverage.
 *
 * Real-looking but non-resolving by design: pointing sample data at real publisher URLs
 * would imply those outlets published this generated copy.
 */
const buildArticleUrl = (domain: string, storyTitle: string, sourceSlug: string): string =>
  `https://${domain}/sample/${slugify(storyTitle, 60)}-${sourceSlug}`;

const seedStory = async (
  story: SeedStory,
  categoryIds: ReadonlyMap<string, string>,
  sources: ReadonlyMap<string, SourceInfo>,
): Promise<{ articles: number }> => {
  const categoryId = categoryIds.get(story.category) ?? null;
  const categoryWeight = CATEGORIES.find((c) => c.slug === story.category)?.weight ?? 1;
  const storySlug = slugify(story.title, 90);
  const canonicalKey = hashTitle(story.title);

  // Newest article in the cluster defines the story's freshness; older siblings are
  // staggered behind it, which is how real multi-source coverage actually arrives.
  const newestPublishedAt = hoursAgo(story.publishedHoursAgo);
  const sourceCount = story.coverage.length;

  const storyImportance = calculateImportanceScore({
    publishedAt: newestPublishedAt,
    // Story-level trust is the best publisher in the cluster.
    sourceTrust: Math.max(...story.coverage.map((c) => sources.get(c.sourceSlug)?.trustScore ?? 0.5)),
    viewCount: story.viewCount,
    bookmarkCount: story.bookmarkCount,
    categoryWeight,
    sourceCount,
    now: NOW,
  });

  const firstSeenAt = hoursAgo(story.publishedHoursAgo + sourceCount);

  const trendingScore = calculateTrendingScore({
    lastPublishedAt: newestPublishedAt,
    viewCount: story.viewCount,
    bookmarkCount: story.bookmarkCount,
    sourceCount,
    importanceScore: storyImportance,
    firstSeenAt,
    now: NOW,
  });

  const storyData = {
    title: story.title,
    summary: story.summary,
    imageUrl: imageForSlug(storySlug),
    keyTokens: titleTokens(story.title),
    country: story.country,
    articleCount: sourceCount,
    sourceCount,
    viewCount: story.viewCount,
    bookmarkCount: story.bookmarkCount,
    importanceScore: storyImportance,
    trendingScore,
    firstSeenAt,
    lastPublishedAt: newestPublishedAt,
    ...(categoryId ? { categoryId } : {}),
  } satisfies Prisma.StoryUpdateInput;

  const storyRow = await prisma.story.upsert({
    where: { canonicalKey },
    create: { ...storyData, slug: storySlug, canonicalKey },
    update: storyData,
    select: { id: true },
  });

  let articleCount = 0;

  for (const [index, coverage] of story.coverage.entries()) {
    const source = sources.get(coverage.sourceSlug);
    if (!source) {
      throw new Error(`Story "${story.title}" references unknown source "${coverage.sourceSlug}"`);
    }

    const url = buildArticleUrl(source.domain, story.title, coverage.sourceSlug);
    const canonicalUrl = canonicalizeUrl(url);
    // Index 0 is the lead (newest); each subsequent publisher lags by an hour.
    const publishedAt = hoursAgo(story.publishedHoursAgo + index);

    // Per-article engagement: the lead article draws most of the story's traffic.
    const share = index === 0 ? 0.45 : 0.55 / Math.max(1, sourceCount - 1);
    const viewCount = Math.round(story.viewCount * share);
    const bookmarkCount = Math.round(story.bookmarkCount * share);

    const importanceScore = calculateImportanceScore({
      publishedAt,
      sourceTrust: source.trustScore,
      viewCount,
      bookmarkCount,
      categoryWeight,
      sourceCount,
      now: NOW,
    });

    const articleData = {
      title: coverage.title,
      description: coverage.description,
      content: coverage.excerpt ?? null,
      // Sample excerpts are original copy, so they are not full publisher bodies.
      isFullContent: false,
      url,
      canonicalUrl,
      titleHash: hashTitle(coverage.title),
      imageUrl: imageForSlug(`${storySlug}-${coverage.sourceSlug}`),
      sourceName: source.name,
      sourceUrl: source.homepage,
      author: coverage.author ?? null,
      country: story.country,
      language: 'en',
      category: story.category,
      subcategory: story.subcategory ?? null,
      publishedAt,
      fetchedAt: NOW,
      importanceScore,
      viewCount,
      bookmarkCount,
      topics: titleTokens(story.title).slice(0, 5),
      status: 'PUBLISHED',
      providerKey: 'seed',
      storyId: storyRow.id,
      sourceId: source.id,
      ...(categoryId ? { categoryId } : {}),
    } satisfies Prisma.NewsArticleUncheckedUpdateInput;

    await prisma.newsArticle.upsert({
      where: { urlHash: hashUrl(url) },
      create: {
        ...articleData,
        urlHash: hashUrl(url),
        externalId: `seed:${slugify(story.title, 40)}:${coverage.sourceSlug}`,
      },
      update: articleData,
    });

    articleCount += 1;
  }

  return { articles: articleCount };
};

const seedUsers = async (categoryIds: ReadonlyMap<string, string>): Promise<void> => {
  // Development credentials only. Both accounts are advertised in the README so nobody
  // mistakes them for real ones; a production deploy should never run this seed.
  const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: 'admin@newsflow.dev' },
    create: {
      name: 'NewsFlow Admin',
      email: 'admin@newsflow.dev',
      passwordHash,
      role: 'ADMIN',
      onboardedAt: NOW,
    },
    update: { role: 'ADMIN', passwordHash },
  });

  const reader = await prisma.user.upsert({
    where: { email: 'reader@newsflow.dev' },
    create: {
      name: 'Demo Reader',
      email: 'reader@newsflow.dev',
      passwordHash,
      role: 'USER',
      onboardedAt: NOW,
    },
    update: { passwordHash },
    select: { id: true },
  });

  // Give the demo reader interests so /my-feed is populated on first login.
  const interests = ['technology', 'ai', 'startups', 'finance', 'cricket'];
  for (const slug of interests) {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) continue;
    await prisma.userPreference.upsert({
      where: { userId_categoryId: { userId: reader.id, categoryId } },
      create: { userId: reader.id, categoryId, weight: 1 },
      update: {},
    });
  }

  // A couple of bookmarks so the bookmarks page is not empty in a demo.
  const bookmarkable = await prisma.newsArticle.findMany({
    where: { category: { in: ['ai', 'cricket'] }, status: 'PUBLISHED' },
    orderBy: { importanceScore: 'desc' },
    take: 3,
    select: { id: true },
  });

  for (const article of bookmarkable) {
    await prisma.bookmark.upsert({
      where: { userId_articleId: { userId: reader.id, articleId: article.id } },
      create: { userId: reader.id, articleId: article.id },
      update: {},
    });
  }

  console.log('  users: 2 (admin@newsflow.dev, reader@newsflow.dev)');
  console.log(`  preferences: ${interests.length}, bookmarks: ${bookmarkable.length}`);
};

/**
 * A synthetic ingestion run so the admin dashboard and /health have something to show
 * before the real worker has ever executed.
 */
const seedIngestionRun = async (articleCount: number): Promise<void> => {
  await prisma.ingestionRun.create({
    data: {
      providerKey: 'seed',
      status: 'SUCCESS',
      fetchedCount: articleCount,
      storedCount: articleCount,
      duplicateCount: 0,
      rejectedCount: 0,
      requestCount: 0,
      startedAt: new Date(NOW.getTime() - 4_000),
      finishedAt: NOW,
      durationMs: 4_000,
      details: { note: 'Database seed, not a live provider fetch' },
    },
  });
};

const main = async (): Promise<void> => {
  console.log('Seeding NewsFlow database...');

  const categoryIds = await seedCategories();
  const sources = await seedSources();

  let totalArticles = 0;
  for (const story of STORIES) {
    const result = await seedStory(story, categoryIds, sources);
    totalArticles += result.articles;
  }
  console.log(`  stories: ${STORIES.length}`);
  console.log(`  articles: ${totalArticles}`);

  await seedUsers(categoryIds);
  await seedIngestionRun(totalArticles);

  console.log('Seed complete.');
  console.log('  Login: reader@newsflow.dev / Password123!  (admin@newsflow.dev for admin)');
};

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
