import { describe, expect, it } from 'vitest';
import { categorize } from '../../src/pipeline/categorize.js';

/**
 * Category assignment decides which section an article appears in, so a regression
 * here is immediately visible on the homepage. These cases are drawn from the kinds of
 * headline the seeded publishers actually produce.
 */

const category = (title: string, extra: { description?: string; hint?: string; country?: string } = {}) =>
  categorize({
    title,
    description: extra.description ?? null,
    hint: extra.hint ?? null,
    country: extra.country ?? null,
  }).category;

describe('categorize', () => {
  it('prefers the specific child category over its parent', () => {
    // "cricket" must beat the generic "sports" rule, or /cricket is always empty.
    expect(category('India seal the series with a commanding chase in the decider')).toBe('cricket');
    expect(category('Premier League title race tightens after weekend upsets')).toBe('football');
  });

  it('detects AI stories', () => {
    expect(category('OpenAI releases a new large language model for coding')).toBe('ai');
    expect(category('Anthropic and DeepMind publish new machine learning research')).toBe('ai');
  });

  it('separates crypto from general finance', () => {
    expect(category('Bitcoin steadies after a volatile week')).toBe('crypto');
    expect(category('Banks tighten unsecured lending as the regulator flags growth')).toBe('finance');
  });

  it('routes market indices to stocks', () => {
    expect(category('Sensex and Nifty close at record highs')).toBe('stocks');
  });

  it('routes rate and inflation news to economy', () => {
    expect(category('RBI holds the repo rate steady as inflation cools')).toBe('economy');
  });

  it('detects startups, software and science', () => {
    expect(category('Indian startup raises a Series B funding round')).toBe('startups');
    expect(category('New TypeScript release trims build times for open source projects')).toBe(
      'software',
    );
    expect(category('ISRO confirms the launch window for its next lunar mission')).toBe('science');
  });

  it('uses the description when the title alone is ambiguous', () => {
    expect(
      category('A quiet week for the sector', {
        description: 'Container shipping rates and crude oil prices both eased.',
      }),
    ).toBe('global-markets');
  });

  it('falls back to the publisher hint when no keyword matches', () => {
    expect(category('A short local report', { hint: 'Sport' })).toBe('sports');
    expect(category('A short local report', { hint: 'Technology' })).toBe('technology');
  });

  it('ignores a hint that maps to nothing known', () => {
    expect(category('A short local report', { hint: 'Top Stories', country: 'in' })).toBe('india');
  });

  it('falls back to geography when nothing else matches', () => {
    // Least-wrong default: general news from an Indian source belongs in /india.
    expect(category('A short local report', { country: 'in' })).toBe('india');
    expect(category('A short local report', { country: 'us' })).toBe('world');
    expect(category('A short local report')).toBe('world');
  });

  it('reports low confidence for the fallback and higher for a keyword hit', () => {
    const fallback = categorize({ title: 'A short local report', country: 'in' });
    const keyword = categorize({ title: 'Bitcoin and ethereum rally as crypto markets recover' });

    expect(fallback.confidence).toBeLessThan(keyword.confidence);
    expect(fallback.reason).toBe('fallback:country');
    expect(keyword.reason).toContain('keywords:');
  });

  it('matches word-boundary keywords without matching substrings inside words', () => {
    // ' ai ' is padded so it matches at string edges, but must not fire on "said".
    expect(category('Officials said the report was delayed', { country: 'in' })).toBe('india');
  });
});
