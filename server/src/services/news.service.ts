import { log } from '../config/logger.js';
import * as articleRepo from '../repositories/article.repository.js';
import * as storyRepo from '../repositories/story.repository.js';
import type {
  ArticleDTO,
  ArticleQuery,
  ArticleSort,
  PageResult,
  StoryDTO,
} from '../types/domain.js';
import { NotFoundError, toErrorMessage } from '../utils/errors.js';
import { resolveCategorySlugs } from './category.service.js';
import { toArticleDTO, toArticleDTOs, toStoryDTO, toStoryDTOs, type ArticleMapOptions } from './mappers.js';

const logger = log('news-service');

/**
 * News read service: all business logic for public news endpoints.
 *
 * Responsibilities kept here rather than in controllers: category expansion, the
 * homepage section composition, view-count side effects, and assembling an article
 * page (article + coverage + related) with a single round of parallel queries.
 */

export interface ListArticlesInput extends Omit<ArticleQuery, 'sort'> {
  sort: ArticleSort;
  includeChildren?: boolean;
}

export const listArticles = async (
  input: ListArticlesInput,
  options: ArticleMapOptions = {},
): Promise<PageResult<ArticleDTO>> => {
  const categorySlugs = input.category
    ? await resolveCategorySlugs(input.category, input.includeChildren ?? false)
    : undefined;

  const result = await articleRepo.findArticles({
    ...input,
    ...(categorySlugs ? { categorySlugs } : {}),
  });

  return { items: toArticleDTOs(result.items, options), total: result.total };
};

/**
 * A single article plus everything the article page needs.
 *
 * The view counter is intentionally not awaited: a failed counter update must never
 * fail the read, and the extra write should not add latency to the response.
 */
export const getArticleDetail = async (
  id: string,
  options: ArticleMapOptions = {},
): Promise<{ article: ArticleDTO; coverage: ArticleDTO[]; related: ArticleDTO[] }> => {
  const record = await articleRepo.findArticleById(id);
  if (!record) throw new NotFoundError('Article');

  const [coverage, related] = await Promise.all([
    record.story ? articleRepo.findSiblingArticles(record.story.id, record.id) : Promise.resolve([]),
    articleRepo.findRelatedArticles(record),
  ]);

  void articleRepo
    .incrementViewCount(record.id, record.story?.id ?? null)
    .catch((error: unknown) =>
      logger.warn({ articleId: id, err: toErrorMessage(error) }, 'view count update failed'),
    );

  return {
    // Content is only included on the detail endpoint, never in list payloads.
    article: toArticleDTO(record, { ...options, includeContent: true }),
    coverage: toArticleDTOs(coverage, options),
    related: toArticleDTOs(related, options),
  };
};

export const getTopStories = async (
  input: { limit: number; category?: string; country?: string; hours: number },
  options: ArticleMapOptions = {},
): Promise<StoryDTO[]> => {
  const since = new Date(Date.now() - input.hours * 3_600_000);
  const categorySlugs = input.category ? await resolveCategorySlugs(input.category, true) : undefined;

  let stories = await storyRepo.findTopStories(
    {
      ...(categorySlugs ? { categorySlugs } : {}),
      ...(input.country ? { country: input.country } : {}),
      since,
    },
    input.limit,
  );

  // A brand-new deployment (or a quiet news window) can have nothing inside the
  // look-back window. Falling back to the all-time top avoids an empty homepage.
  if (stories.length === 0) {
    stories = await storyRepo.findTopStories(
      {
        ...(categorySlugs ? { categorySlugs } : {}),
        ...(input.country ? { country: input.country } : {}),
      },
      input.limit,
    );
  }

  return toStoryDTOs(stories, options);
};

export const getStoryBySlug = async (
  slug: string,
  options: ArticleMapOptions = {},
): Promise<StoryDTO> => {
  const story = await storyRepo.findStoryBySlug(slug);
  if (!story) throw new NotFoundError('Story');

  const articles = await storyRepo.findStoryArticles(story.id);
  return {
    ...toStoryDTO(story, options),
    articles: toArticleDTOs(articles, options),
  };
};

/** Sections rendered on the homepage, in display order. */
export const HOME_SECTIONS = [
  { key: 'india', label: 'India', category: 'india', country: undefined },
  { key: 'world', label: 'World', category: 'world', country: undefined },
  { key: 'technology', label: 'Technology', category: 'technology', country: undefined },
  { key: 'ai', label: 'AI & Machine Learning', category: 'ai', country: undefined },
  { key: 'business', label: 'Business & Economy', category: 'business', country: undefined },
  { key: 'finance', label: 'Finance & Markets', category: 'finance', country: undefined },
  { key: 'sports', label: 'Sports', category: 'sports', country: undefined },
  { key: 'science', label: 'Science', category: 'science', country: undefined },
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number]['key'];

export interface HomeSection {
  key: string;
  label: string;
  category: string;
  articles: ArticleDTO[];
}

export interface HomeFeed {
  topStories: StoryDTO[];
  latest: ArticleDTO[];
  sections: HomeSection[];
}

/**
 * The whole homepage in one response.
 *
 * One request instead of ten means one round trip, one cache entry, and no waterfall of
 * spinners on first paint. Section queries run concurrently, and `allSettled` ensures a
 * single failing section degrades to empty rather than blanking the page.
 */
export const getHomeFeed = async (
  input: { perSection: number; topStories: number },
  options: ArticleMapOptions = {},
): Promise<HomeFeed> => {
  const sectionSlugLists = await Promise.all(
    HOME_SECTIONS.map((section) => resolveCategorySlugs(section.category, true)),
  );

  // Grouped as a 3-tuple rather than a spread so TypeScript keeps each element's
  // distinct type instead of collapsing them into a union.
  const [topStories, latest, sectionResults] = await Promise.all([
    getTopStories({ limit: input.topStories, hours: 24 }, options),
    articleRepo
      .findArticles({ page: 1, limit: input.perSection * 2, sort: 'latest' })
      .then((result) => toArticleDTOs(result.items, options)),
    Promise.all(
      HOME_SECTIONS.map((section, index) =>
        articleRepo
          .findTopByCategory(
            sectionSlugLists[index] ?? [section.category],
            input.perSection,
            'importance',
          )
          .then((records) => toArticleDTOs(records, options))
          .catch((error: unknown) => {
            logger.warn(
              { section: section.key, err: toErrorMessage(error) },
              'home section query failed, rendering empty',
            );
            return [] as ArticleDTO[];
          }),
      ),
    ),
  ]);

  const sections: HomeSection[] = HOME_SECTIONS.map((section, index) => ({
    key: section.key,
    label: section.label,
    category: section.category,
    articles: sectionResults[index] ?? [],
  }))
    // Do not render a heading with nothing under it.
    .filter((section) => section.articles.length > 0);

  return { topStories, latest, sections };
};
