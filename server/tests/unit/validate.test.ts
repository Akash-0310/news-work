import { describe, expect, it } from 'vitest';
import { partitionValid, validateArticle } from '../../src/pipeline/validate.js';
import type { NormalizedArticle } from '../../src/pipeline/normalize.js';

const NOW = new Date('2026-08-12T12:00:00.000Z');
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 86_400_000);

const article = (overrides: Partial<NormalizedArticle> = {}): NormalizedArticle => ({
  externalId: 'rss:1',
  title: 'India unveils a national compute mission for AI research',
  description: 'A summary of the programme.',
  content: null,
  isFullContent: false,
  url: 'https://thehindu.com/news/compute-mission',
  canonicalUrl: 'https://thehindu.com/news/compute-mission',
  urlHash: 'a'.repeat(40),
  titleHash: 'b'.repeat(40),
  keyTokens: ['compute', 'india', 'mission'],
  imageUrl: null,
  sourceName: 'The Hindu',
  sourceUrl: null,
  sourceDomain: 'thehindu.com',
  author: null,
  country: 'in',
  language: 'en',
  category: 'ai',
  subcategory: null,
  publishedAt: daysAgo(1),
  providerKey: 'rss',
  ...overrides,
});

const options = { maxAgeDays: 45, now: NOW };

describe('validateArticle', () => {
  it('accepts a well-formed recent article', () => {
    expect(validateArticle(article(), options).valid).toBe(true);
  });

  it('rejects a title too short to be a headline', () => {
    const result = validateArticle(article({ title: 'Sport' }), options);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('title-too-short');
  });

  it('rejects feed furniture masquerading as an article', () => {
    // Publishers emit these as ordinary items; unfiltered they rank beside real news.
    for (const title of ['Top stories', 'Latest news', 'Photo gallery']) {
      const result = validateArticle(article({ title }), options);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('title-is-boilerplate');
    }
  });

  it('still accepts a real headline that merely contains a boilerplate phrase', () => {
    expect(
      validateArticle(
        article({ title: 'Breaking news coverage is changing how readers find stories' }),
        options,
      ).valid,
    ).toBe(true);
  });

  it('rejects non-article URLs such as tag and author pages', () => {
    for (const url of [
      'https://thehindu.com/tag/economy',
      'https://thehindu.com/author/staff',
      'https://thehindu.com/newsletter',
    ]) {
      const result = validateArticle(article({ canonicalUrl: url }), options);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('blocked-url');
    }
  });

  it('rejects articles older than the retention window', () => {
    // Storing these would only create rows the cleanup worker deletes on its next pass.
    const result = validateArticle(article({ publishedAt: daysAgo(60) }), options);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too-old');
  });

  it('accepts an article exactly at the retention boundary', () => {
    expect(validateArticle(article({ publishedAt: daysAgo(45) }), options).valid).toBe(true);
  });

  it('filters unsupported languages only when a list is configured', () => {
    expect(validateArticle(article({ language: 'de' }), options).valid).toBe(true);

    const restricted = validateArticle(article({ language: 'de' }), {
      ...options,
      allowedLanguages: ['en'],
    });
    expect(restricted.valid).toBe(false);
    expect(restricted.reason).toBe('unsupported-language');
  });

  it('accepts an article with no description', () => {
    // The UI renders a null description; rejecting these would discard real news.
    expect(validateArticle(article({ description: null }), options).valid).toBe(true);
  });
});

describe('partitionValid', () => {
  it('splits a batch and counts rejections by reason', () => {
    const result = partitionValid(
      [
        article(),
        article({ title: 'Sport' }),
        article({ title: 'Top stories' }),
        article({ publishedAt: daysAgo(90) }),
      ],
      options,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(3);
    expect(result.reasonCounts).toEqual({
      'title-too-short': 1,
      'title-is-boilerplate': 1,
      'too-old': 1,
    });
  });
});
