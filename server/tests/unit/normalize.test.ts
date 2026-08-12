import { describe, expect, it } from 'vitest';
import { normalizeArticle, normalizeBatch, normalizePublishedAt } from '../../src/pipeline/normalize.js';
import type { RawArticle } from '../../src/providers/NewsProvider.js';

const NOW = new Date('2026-08-12T12:00:00.000Z');

const raw = (overrides: Partial<RawArticle> = {}): RawArticle => ({
  title: 'India unveils a national compute mission for AI research',
  url: 'https://www.thehindu.com/news/national/compute-mission',
  sourceName: 'The Hindu',
  ...overrides,
});

const normalize = (input: RawArticle) => normalizeArticle(input, { providerKey: 'rss', now: NOW });

describe('normalizePublishedAt', () => {
  it('parses RFC 822 dates, which is what RSS uses', () => {
    expect(normalizePublishedAt('Tue, 11 Aug 2026 09:30:00 GMT', NOW).toISOString()).toBe(
      '2026-08-11T09:30:00.000Z',
    );
  });

  it('parses ISO 8601 dates, which is what Atom uses', () => {
    expect(normalizePublishedAt('2026-08-11T09:30:00Z', NOW).toISOString()).toBe(
      '2026-08-11T09:30:00.000Z',
    );
  });

  it('falls back to now for an unparseable date', () => {
    expect(normalizePublishedAt('not a date', NOW)).toEqual(NOW);
  });

  it('falls back to now when the date is missing', () => {
    expect(normalizePublishedAt(null, NOW)).toEqual(NOW);
    expect(normalizePublishedAt(undefined, NOW)).toEqual(NOW);
  });

  it('clamps a far-future date to now', () => {
    // Freshness is the heaviest ranking term, so a future date would pin the article
    // to the top of every feed indefinitely.
    expect(normalizePublishedAt('2030-01-01T00:00:00Z', NOW)).toEqual(NOW);
  });

  it('tolerates small clock skew rather than clamping it', () => {
    const slightlyAhead = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    expect(normalizePublishedAt(slightlyAhead, NOW).toISOString()).toBe(slightlyAhead);
  });

  it('rejects epoch-zero and other implausible past dates', () => {
    expect(normalizePublishedAt('1970-01-01T00:00:00Z', NOW)).toEqual(NOW);
  });
});

describe('normalizeArticle', () => {
  it('returns null without a usable title', () => {
    expect(normalize(raw({ title: '' }))).toBeNull();
    expect(normalize(raw({ title: '   ' }))).toBeNull();
  });

  it('returns null for a non-http URL', () => {
    // javascript: in particular must never reach an href in the UI.
    expect(normalize(raw({ url: 'javascript:alert(1)' }))).toBeNull();
    expect(normalize(raw({ url: 'not a url' }))).toBeNull();
    expect(normalize(raw({ url: 'ftp://example.com/x' }))).toBeNull();
  });

  it('strips HTML and entities from the title', () => {
    const result = normalize(raw({ title: '<b>Markets</b> rally &amp; bonds ease' }));
    expect(result?.title).toBe('Markets rally & bonds ease');
  });

  it('computes dedup keys that survive URL variation', () => {
    const a = normalize(raw({ url: 'https://www.thehindu.com/news/x?utm_source=rss' }));
    const b = normalize(raw({ url: 'http://thehindu.com/news/x/' }));
    expect(a?.urlHash).toBe(b?.urlHash);
  });

  it('namespaces externalId by provider so ids cannot collide', () => {
    const result = normalize(raw({ externalId: '12345' }));
    expect(result?.externalId).toBe('rss:12345');
  });

  it('leaves externalId null when the feed supplies none', () => {
    expect(normalize(raw())?.externalId).toBeNull();
  });

  it('resolves a root-relative image against the article URL', () => {
    const result = normalize(raw({ imageUrl: '/images/lead.jpg' }));
    expect(result?.imageUrl).toBe('https://www.thehindu.com/images/lead.jpg');
  });

  it('resolves a protocol-relative image', () => {
    const result = normalize(raw({ imageUrl: '//cdn.example.com/a.jpg' }));
    expect(result?.imageUrl).toBe('https://cdn.example.com/a.jpg');
  });

  it('drops an unusable image rather than storing a broken URL', () => {
    expect(normalize(raw({ imageUrl: 'data:image/png;base64,AAA' }))?.imageUrl).toBeNull();
  });

  it('cleans bylines', () => {
    expect(normalize(raw({ author: 'By  Priya Raghavan ' }))?.author).toBe('Priya Raghavan');
    expect(normalize(raw({ author: 'Staff Writer | Reuters' }))?.author).toBe('Staff Writer');
    // An email address is not a byline.
    expect(normalize(raw({ author: 'desk@thehindu.com' }))?.author).toBeNull();
  });

  it('reduces language tags to a base code', () => {
    expect(normalize(raw({ language: 'en-IN' }))?.language).toBe('en');
    expect(normalize(raw({ language: 'en_GB' }))?.language).toBe('en');
    expect(normalize(raw({ language: 'garbage' }))?.language).toBe('en');
    expect(normalize(raw({ language: null }))?.language).toBe('en');
  });

  it('accepts only two-letter country codes', () => {
    expect(normalize(raw({ country: 'IN' }))?.country).toBe('in');
    expect(normalize(raw({ country: 'India' }))?.country).toBeNull();
  });

  it('never marks feed content as licensed full text', () => {
    // Feed excerpts are not redistributable article bodies.
    const result = normalize(raw({ content: 'A short excerpt of the article.' }));
    expect(result?.isFullContent).toBe(false);
  });

  it('derives a source name from the domain when the feed omits one', () => {
    const result = normalize(raw({ sourceName: '' }));
    expect(result?.sourceName).toBe('thehindu.com');
  });

  it('assigns a category from the headline', () => {
    const result = normalize(
      raw({ title: 'Bitcoin steadies after a volatile week for crypto markets' }),
    );
    expect(result?.category).toBe('crypto');
  });
});

describe('normalizeBatch', () => {
  it('keeps usable articles and counts the rest', () => {
    const result = normalizeBatch(
      [raw(), raw({ title: '' }), raw({ url: 'nope' }), raw({ url: 'https://x.com/a' })],
      { providerKey: 'rss', now: NOW },
    );

    expect(result.articles).toHaveLength(2);
    expect(result.rejected).toBe(2);
  });
});
