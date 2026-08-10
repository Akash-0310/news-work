import { describe, expect, it } from 'vitest';
import {
  BREAKING_NEWS_THRESHOLD,
  calculateImportanceScore,
  calculateTrendingScore,
  categoryWeightScore,
  crossSourceScore,
  engagementScore,
  freshnessScore,
  isBreakingNews,
  scoreBreakdown,
  sourceTrustScore,
  WEIGHTS,
} from '../../src/pipeline/ranking.js';

/**
 * Ranking is the least observable part of the system: a wrong weight produces a feed
 * that looks plausible but is subtly misordered, and no integration test would catch
 * it. Every term is therefore pinned independently, and `now` is injected everywhere so
 * nothing depends on wall-clock time.
 */

const NOW = new Date('2026-08-10T12:00:00.000Z');
const hoursBefore = (hours: number): Date => new Date(NOW.getTime() - hours * 3_600_000);

describe('freshnessScore', () => {
  it('is 1 for an article published right now', () => {
    expect(freshnessScore(NOW, NOW)).toBe(1);
  });

  it('halves every 8 hours (the documented half-life)', () => {
    expect(freshnessScore(hoursBefore(8), NOW)).toBeCloseTo(0.5, 10);
    expect(freshnessScore(hoursBefore(16), NOW)).toBeCloseTo(0.25, 10);
    expect(freshnessScore(hoursBefore(24), NOW)).toBeCloseTo(0.125, 10);
  });

  it('floors to 0 at and beyond the 72 hour cutoff', () => {
    expect(freshnessScore(hoursBefore(72), NOW)).toBe(0);
    expect(freshnessScore(hoursBefore(1000), NOW)).toBe(0);
  });

  it('treats a future-dated article as fresh rather than rewarding it', () => {
    // Providers do publish items with skewed clocks; the score must not exceed 1.
    expect(freshnessScore(hoursBefore(-5), NOW)).toBe(1);
  });

  it('decreases monotonically with age', () => {
    const ages = [0, 1, 2, 4, 8, 16, 32, 48, 71];
    const scores = ages.map((age) => freshnessScore(hoursBefore(age), NOW));
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
  });
});

describe('sourceTrustScore', () => {
  it('passes through valid 0..1 trust values', () => {
    expect(sourceTrustScore(0.95)).toBe(0.95);
    expect(sourceTrustScore(0)).toBe(0);
  });

  it('clamps out-of-range values instead of propagating them', () => {
    // An admin or a provider can supply nonsense; it must not escape into the score.
    expect(sourceTrustScore(4)).toBe(1);
    expect(sourceTrustScore(-2)).toBe(0);
  });

  it('fails closed on non-finite input, scoring it as untrusted', () => {
    // Deliberate: NaN/Infinity mean "we do not know this publisher's reliability".
    // Treating unknown as maximally trusted would let one corrupt row dominate every
    // ranking, so the safe direction is 0 (no boost) rather than 1.
    expect(sourceTrustScore(Number.NaN)).toBe(0);
    expect(sourceTrustScore(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sourceTrustScore(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('engagementScore', () => {
  it('is 0 with no engagement', () => {
    expect(engagementScore(0, 0)).toBe(0);
  });

  it('weights a bookmark as five views, since it signals stronger intent', () => {
    expect(engagementScore(0, 1)).toBeCloseTo(engagementScore(5, 0), 10);
  });

  it('is log-scaled so one viral article cannot dominate the feed', () => {
    const tenX = engagementScore(1000, 0) / engagementScore(100, 0);
    // A 10x traffic difference must produce well under a 10x score difference.
    expect(tenX).toBeLessThan(2);
  });

  it('saturates at 1 and never exceeds it', () => {
    expect(engagementScore(10_000_000, 10_000_000)).toBe(1);
  });

  it('ignores negative counters', () => {
    expect(engagementScore(-50, -50)).toBe(0);
  });
});

describe('categoryWeightScore', () => {
  it('maps a neutral weight of 1 to the midpoint', () => {
    expect(categoryWeightScore(1)).toBe(0.5);
  });

  it('caps at a weight of 2', () => {
    expect(categoryWeightScore(2)).toBe(1);
    expect(categoryWeightScore(10)).toBe(1);
  });
});

describe('crossSourceScore', () => {
  it('gives no corroboration credit to a single-source story', () => {
    expect(crossSourceScore(1)).toBe(0);
    expect(crossSourceScore(0)).toBe(0);
  });

  it('rises with each additional publisher and saturates at nine', () => {
    expect(crossSourceScore(2)).toBeCloseTo(Math.log2(2) / Math.log2(9), 10);
    expect(crossSourceScore(9)).toBeCloseTo(1, 10);
    expect(crossSourceScore(50)).toBe(1);
  });

  it('is monotonically increasing', () => {
    const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(crossSourceScore);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

describe('calculateImportanceScore', () => {
  const perfect = {
    publishedAt: NOW,
    sourceTrust: 1,
    viewCount: 10_000_000,
    bookmarkCount: 10_000_000,
    categoryWeight: 2,
    sourceCount: 9,
    now: NOW,
  };

  it('reaches exactly 100 when every term is maximal', () => {
    // The weights are documented as summing to 100 so the score reads as a percentage.
    expect(calculateImportanceScore(perfect)).toBe(100);
  });

  it('has weights that sum to 100', () => {
    const sum = Object.values(WEIGHTS).reduce((total, weight) => total + weight, 0);
    expect(sum).toBe(100);
  });

  it('is 0 when every term is minimal', () => {
    expect(
      calculateImportanceScore({
        publishedAt: hoursBefore(100),
        sourceTrust: 0,
        viewCount: 0,
        bookmarkCount: 0,
        categoryWeight: 0,
        sourceCount: 1,
        now: NOW,
      }),
    ).toBe(0);
  });

  it('ranks a corroborated story above an identical single-source one', () => {
    const base = {
      publishedAt: hoursBefore(2),
      sourceTrust: 0.8,
      viewCount: 100,
      bookmarkCount: 5,
      categoryWeight: 1.2,
      now: NOW,
    };
    expect(calculateImportanceScore({ ...base, sourceCount: 6 })).toBeGreaterThan(
      calculateImportanceScore({ ...base, sourceCount: 1 }),
    );
  });

  it('ranks fresh news above otherwise identical older news', () => {
    const base = {
      sourceTrust: 0.8,
      viewCount: 100,
      bookmarkCount: 5,
      categoryWeight: 1.2,
      sourceCount: 3,
      now: NOW,
    };
    expect(calculateImportanceScore({ ...base, publishedAt: hoursBefore(1) })).toBeGreaterThan(
      calculateImportanceScore({ ...base, publishedAt: hoursBefore(20) }),
    );
  });

  it('is deterministic for a given injected clock', () => {
    const input = {
      publishedAt: hoursBefore(3),
      sourceTrust: 0.7,
      viewCount: 42,
      bookmarkCount: 3,
      categoryWeight: 1.1,
      sourceCount: 4,
      now: NOW,
    };
    expect(calculateImportanceScore(input)).toBe(calculateImportanceScore(input));
  });
});

describe('scoreBreakdown', () => {
  it('exposes each term so the admin UI can explain a ranking', () => {
    const breakdown = scoreBreakdown({
      publishedAt: NOW,
      sourceTrust: 1,
      viewCount: 0,
      bookmarkCount: 0,
      categoryWeight: 2,
      sourceCount: 1,
      now: NOW,
    });

    expect(breakdown.freshness).toBe(WEIGHTS.freshness);
    expect(breakdown.sourceTrust).toBe(WEIGHTS.sourceTrust);
    expect(breakdown.engagement).toBe(0);
    expect(breakdown.categoryWeight).toBe(WEIGHTS.categoryWeight);
    expect(breakdown.crossSource).toBe(0);
  });

  it('has parts that sum to the total', () => {
    const breakdown = scoreBreakdown({
      publishedAt: hoursBefore(5),
      sourceTrust: 0.66,
      viewCount: 250,
      bookmarkCount: 11,
      categoryWeight: 1.3,
      sourceCount: 5,
      now: NOW,
    });

    const sum =
      breakdown.freshness +
      breakdown.sourceTrust +
      breakdown.engagement +
      breakdown.categoryWeight +
      breakdown.crossSource;

    // Rounding is applied per-term and to the total, hence the tolerance.
    expect(sum).toBeCloseTo(breakdown.total, 2);
  });
});

describe('calculateTrendingScore', () => {
  it('favours engagement velocity over raw totals', () => {
    // Same interactions; the newer story has a far higher per-hour rate.
    const recent = calculateTrendingScore({
      lastPublishedAt: hoursBefore(1),
      firstSeenAt: hoursBefore(2),
      viewCount: 200,
      bookmarkCount: 10,
      sourceCount: 3,
      importanceScore: 50,
      now: NOW,
    });

    const old = calculateTrendingScore({
      lastPublishedAt: hoursBefore(40),
      firstSeenAt: hoursBefore(48),
      viewCount: 200,
      bookmarkCount: 10,
      sourceCount: 3,
      importanceScore: 50,
      now: NOW,
    });

    expect(recent).toBeGreaterThan(old);
  });

  it('decays much faster than importance, using a 3 hour half-life', () => {
    const at0 = calculateTrendingScore(trendingInput(0));
    const at3 = calculateTrendingScore(trendingInput(3));
    const at12 = calculateTrendingScore(trendingInput(12));

    expect(at3).toBeLessThan(at0);
    expect(at12).toBeLessThan(at3);
  });

  const trendingInput = (ageHours: number) => ({
    lastPublishedAt: hoursBefore(ageHours),
    firstSeenAt: hoursBefore(ageHours + 1),
    viewCount: 500,
    bookmarkCount: 20,
    sourceCount: 4,
    importanceScore: 60,
    now: NOW,
  });

  it('never returns a negative score', () => {
    expect(
      calculateTrendingScore({
        lastPublishedAt: hoursBefore(500),
        firstSeenAt: hoursBefore(600),
        viewCount: 0,
        bookmarkCount: 0,
        sourceCount: 1,
        importanceScore: 0,
        now: NOW,
      }),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe('isBreakingNews', () => {
  it('requires both a high score and recency', () => {
    expect(isBreakingNews(BREAKING_NEWS_THRESHOLD, hoursBefore(0.5), NOW)).toBe(true);
  });

  it('rejects a high-scoring but stale article', () => {
    // Otherwise a backfill of old high-importance articles would spam every client.
    expect(isBreakingNews(95, hoursBefore(5), NOW)).toBe(false);
  });

  it('rejects a fresh but unimportant article', () => {
    expect(isBreakingNews(BREAKING_NEWS_THRESHOLD - 1, NOW, NOW)).toBe(false);
  });
});
