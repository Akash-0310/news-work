/**
 * Article and story ranking.
 *
 * importanceScore = freshness + sourceTrust + engagement + categoryWeight + crossSource
 *
 * Every term is a separate exported function with its own documented weight, so the
 * formula can be retuned (or individual terms replaced with learned models) without
 * touching any caller. All functions are pure and unit-tested: this is the code most
 * likely to be wrong in subtle ways, so it must be verifiable in isolation.
 *
 * Each term returns 0..1; WEIGHTS decides how much each contributes. Weights sum to
 * 100, making the final score a readable 0..100 number.
 */

export const WEIGHTS = {
  freshness: 35,
  sourceTrust: 20,
  engagement: 15,
  categoryWeight: 10,
  crossSource: 20,
} as const;

/** Hours after which a story is considered stale (score contribution ~0). */
const FRESHNESS_HALF_LIFE_HOURS = 8;
const FRESHNESS_MAX_AGE_HOURS = 72;

export interface RankingInput {
  publishedAt: Date;
  /** 0..1 publisher reliability. */
  sourceTrust: number;
  viewCount: number;
  bookmarkCount: number;
  /** Category multiplier from the taxonomy, typically 0.8..1.5. */
  categoryWeight: number;
  /** Distinct publishers covering the same story. 1 = uncorroborated. */
  sourceCount: number;
  /** Reference time; injected so tests are deterministic. */
  now?: Date;
}

/**
 * Exponential decay on age. Fresh news must outrank old news decisively, but the curve
 * is smooth rather than a cliff so a good 10-hour story can still beat a weak 1-hour one.
 */
export const freshnessScore = (publishedAt: Date, now: Date = new Date()): number => {
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;

  // Future-dated articles (bad provider clocks) are treated as "just published",
  // never rewarded for being in the future.
  if (ageHours <= 0) return 1;
  if (ageHours >= FRESHNESS_MAX_AGE_HOURS) return 0;

  return Math.pow(0.5, ageHours / FRESHNESS_HALF_LIFE_HOURS);
};

/** Publisher reliability, clamped in case a provider or admin supplies nonsense. */
export const sourceTrustScore = (trust: number): number => clamp01(trust);

/**
 * Engagement, log-scaled so a viral article cannot dominate the entire feed.
 * A bookmark is worth roughly five views as an intent signal.
 */
export const engagementScore = (viewCount: number, bookmarkCount: number): number => {
  const weighted = Math.max(0, viewCount) + Math.max(0, bookmarkCount) * 5;
  // log10(1 + x) / log10(1 + 1000): saturates at ~1000 weighted interactions.
  return clamp01(Math.log10(1 + weighted) / Math.log10(1001));
};

/** Taxonomy weight normalized into 0..1 (a weight of 2.0 or above is the ceiling). */
export const categoryWeightScore = (weight: number): number => clamp01(weight / 2);

/**
 * Corroboration. Independent coverage by many outlets is the strongest available
 * signal that a story actually matters, so this term saturates slowly.
 * 1 source -> 0, 2 -> ~0.3, 4 -> ~0.6, 8+ -> ~1.
 */
export const crossSourceScore = (sourceCount: number): number => {
  const extra = Math.max(0, sourceCount - 1);
  return clamp01(Math.log2(1 + extra) / Math.log2(9));
};

export interface ScoreBreakdown {
  freshness: number;
  sourceTrust: number;
  engagement: number;
  categoryWeight: number;
  crossSource: number;
  total: number;
}

/** Full breakdown, exposed so the admin dashboard can explain why a story ranks where it does. */
export const scoreBreakdown = (input: RankingInput): ScoreBreakdown => {
  const now = input.now ?? new Date();
  const parts = {
    freshness: freshnessScore(input.publishedAt, now) * WEIGHTS.freshness,
    sourceTrust: sourceTrustScore(input.sourceTrust) * WEIGHTS.sourceTrust,
    engagement: engagementScore(input.viewCount, input.bookmarkCount) * WEIGHTS.engagement,
    categoryWeight: categoryWeightScore(input.categoryWeight) * WEIGHTS.categoryWeight,
    crossSource: crossSourceScore(input.sourceCount) * WEIGHTS.crossSource,
  };

  const total = Object.values(parts).reduce((sum, value) => sum + value, 0);
  return { ...round(parts), total: roundTo(total, 3) };
};

/** The 0..100 importance score stored on articles and stories. */
export const calculateImportanceScore = (input: RankingInput): number =>
  scoreBreakdown(input).total;

/**
 * Trending is a *different* question from importance: "what is being read right now",
 * not "what matters most today". It therefore uses a much shorter half-life and leans
 * on engagement velocity rather than editorial signals.
 */
export const TRENDING_WEIGHTS = {
  velocity: 45,
  freshness: 30,
  crossSource: 15,
  importance: 10,
} as const;

const TRENDING_HALF_LIFE_HOURS = 3;

export interface TrendingInput {
  lastPublishedAt: Date;
  viewCount: number;
  bookmarkCount: number;
  sourceCount: number;
  /** The story's 0..100 importance score. */
  importanceScore: number;
  firstSeenAt: Date;
  now?: Date;
}

export const calculateTrendingScore = (input: TrendingInput): number => {
  const now = input.now ?? new Date();

  // Interactions per hour since the story appeared, so a two-hour-old story with 50
  // views outranks a two-day-old story with 200.
  const hoursLive = Math.max(0.5, (now.getTime() - input.firstSeenAt.getTime()) / 3_600_000);
  const interactions = Math.max(0, input.viewCount) + Math.max(0, input.bookmarkCount) * 5;
  const perHour = interactions / hoursLive;
  const velocity = clamp01(Math.log10(1 + perHour) / Math.log10(101));

  const ageHours = Math.max(0, (now.getTime() - input.lastPublishedAt.getTime()) / 3_600_000);
  const freshness = Math.pow(0.5, ageHours / TRENDING_HALF_LIFE_HOURS);

  const total =
    velocity * TRENDING_WEIGHTS.velocity +
    freshness * TRENDING_WEIGHTS.freshness +
    crossSourceScore(input.sourceCount) * TRENDING_WEIGHTS.crossSource +
    clamp01(input.importanceScore / 100) * TRENDING_WEIGHTS.importance;

  return roundTo(total, 3);
};

/**
 * Threshold above which an incoming article is treated as breaking news and pushed
 * over WebSocket. High on purpose: a notification that fires constantly is ignored.
 */
export const BREAKING_NEWS_THRESHOLD = 72;

export const isBreakingNews = (importanceScore: number, publishedAt: Date, now = new Date()): boolean => {
  const ageMinutes = (now.getTime() - publishedAt.getTime()) / 60_000;
  return importanceScore >= BREAKING_NEWS_THRESHOLD && ageMinutes <= 90;
};

// ---------------------------------------------------------------------------

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const round = <T extends Record<string, number>>(parts: T): T =>
  Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, roundTo(value, 3)])) as T;
