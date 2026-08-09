import { z } from 'zod';
import { loadEnvFiles } from './loadEnv.js';

// Must run before the schema below reads process.env. In containers the variables are
// already injected, so missing files are not an error.
loadEnvFiles();

/** Comma-separated env var -> trimmed, non-empty string list. */
const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  );

/** Numeric env var with a default, rejecting NaN rather than silently coercing to 0. */
const num = (fallback: number) =>
  z.coerce.number({ invalid_type_error: 'must be a number' }).int().positive().default(fallback);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: num(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Auth. Enforced to a real length in production by the refinement below.
  JWT_SECRET: z.string().min(1).default('dev-only-insecure-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-only-insecure-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // News providers. Every key is optional: with none set the app serves seeded
  // data plus public RSS feeds, so a fresh clone still works end to end.
  NEWS_API_KEY: z.string().optional(),
  WORLD_NEWS_API_KEY: z.string().optional(),
  APITUBE_API_KEY: z.string().optional(),
  SPORTS_API_KEY: z.string().optional(),
  GNEWS_API_KEY: z.string().optional(),
  ENABLED_PROVIDERS: csv,

  NEWS_FETCH_CRON: z.string().default('*/10 * * * *'),
  TRENDING_CRON: z.string().default('*/5 * * * *'),
  CLEANUP_CRON: z.string().default('0 3 * * *'),
  ARTICLE_RETENTION_DAYS: num(45),
  INGEST_BATCH_SIZE: num(100),

  RATE_LIMIT_WINDOW_MS: num(60_000),
  RATE_LIMIT_MAX: num(120),
  AUTH_RATE_LIMIT_MAX: num(10),

  CACHE_TTL_LATEST: num(120),
  CACHE_TTL_TRENDING: num(120),
  CACHE_TTL_CATEGORY: num(300),
  CACHE_TTL_SEARCH: num(180),
  CACHE_TTL_ARTICLE: num(600),

  AI_PROVIDER: z.enum(['none', 'anthropic']).default('none'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail fast and loudly: a half-configured server is worse than one that refuses to boot.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

// Refuse to run in production with the development fallback secrets.
if (raw.NODE_ENV === 'production') {
  const weak = (secret: string) => secret.startsWith('dev-only-') || secret.length < 32;
  if (weak(raw.JWT_SECRET) || weak(raw.JWT_REFRESH_SECRET)) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET must each be set to a unique random string of at least 32 characters in production.',
    );
  }
  if (raw.JWT_SECRET === raw.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
}

export type ProviderKey = 'rss' | 'worldnews' | 'newsapi' | 'apitube' | 'sports';

const KNOWN_PROVIDERS: readonly ProviderKey[] = ['rss', 'worldnews', 'newsapi', 'apitube', 'sports'];

const isProviderKey = (value: string): value is ProviderKey =>
  (KNOWN_PROVIDERS as readonly string[]).includes(value);

/**
 * Frozen, typed application configuration. Import this instead of touching
 * `process.env` anywhere else in the codebase.
 */
export const env = Object.freeze({
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  /** Providers requested via ENABLED_PROVIDERS, filtered to keys we actually implement. */
  enabledProviders: raw.ENABLED_PROVIDERS.filter(isProviderKey),
  /** Origins allowed by CORS. */
  corsOrigins: [raw.CLIENT_URL],
});

export type Env = typeof env;
