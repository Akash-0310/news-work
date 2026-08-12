/**
 * Category inference.
 *
 * Feeds either give no category at all or give a publisher-specific one ("Business
 * News", "Sport"), so the pipeline decides the category itself from the headline and
 * description.
 *
 * Deliberately a transparent keyword classifier rather than a model: it is
 * deterministic, debuggable, free, and instantly correctable by editing a list. The
 * `LLMProvider` interface (Phase 11) can supersede it later without changing callers,
 * because the signature is just `(text) -> slug`.
 */

/** Ordered most specific first: `cricket` must win before `sports`. */
interface CategoryRule {
  slug: string;
  /** Strong signals: one match is enough. */
  keywords: string[];
  /** Weight applied per keyword hit; higher means more confident. */
  weight?: number;
}

const RULES: CategoryRule[] = [
  {
    slug: 'cricket',
    weight: 3,
    // Real cricket headlines frequently never contain the word "cricket" -- "India
    // seal the series in the decider" is a typical example. The vocabulary of the
    // sport (decider, overs, wickets, innings) is the reliable signal, not the name.
    keywords: [
      'cricket', 'ipl', 'test match', 'odi', 't20', 'wicket', 'batsman', 'batter', 'bowler',
      'ranji', 'bcci', 'world cup cricket', 'run chase', 'innings', 'decider', 'overs',
      'half-century', 'all-rounder', 'spinner', 'pacer', 'stumps', 'crease', 'boundary',
      'seal the series', 'series win', 'run-rate',
    ],
  },
  {
    slug: 'football',
    weight: 3,
    keywords: [
      'football', 'premier league', 'la liga', 'serie a', 'bundesliga', 'uefa', 'fifa',
      'champions league', 'transfer window', 'goalkeeper', 'midfielder', 'isl',
    ],
  },
  {
    slug: 'ai',
    weight: 3,
    keywords: [
      'artificial intelligence', ' ai ', 'machine learning', 'neural network', 'llm',
      'large language model', 'openai', 'anthropic', 'deepmind', 'chatgpt', 'gemini',
      'generative ai', 'transformer model', 'inference', 'gpu cluster',
    ],
  },
  {
    slug: 'crypto',
    weight: 3,
    keywords: [
      'bitcoin', 'ethereum', 'crypto', 'blockchain', 'stablecoin', 'defi', 'nft',
      'digital asset', 'token', 'binance',
    ],
  },
  {
    slug: 'stocks',
    weight: 2,
    keywords: [
      'sensex', 'nifty', 'stock market', 'equities', 'share price', 'ipo', 'nasdaq',
      'dow jones', 's&p 500', 'bourse', 'shares closed', 'market cap',
    ],
  },
  {
    slug: 'startups',
    weight: 2,
    keywords: [
      'startup', 'seed round', 'series a', 'series b', 'venture capital', 'funding round',
      'unicorn', 'founder', 'incubator', 'valuation',
    ],
  },
  {
    slug: 'software',
    weight: 2,
    keywords: [
      'open source', 'javascript', 'typescript', 'python', 'kubernetes', 'developer',
      'programming', 'github', 'api release', 'framework', 'compiler', 'linux kernel',
    ],
  },
  {
    slug: 'economy',
    weight: 2,
    keywords: [
      'inflation', 'gdp', 'repo rate', 'monetary policy', 'central bank', 'unemployment',
      'fiscal deficit', 'interest rate', 'recession', 'rbi', 'federal reserve',
    ],
  },
  {
    slug: 'global-markets',
    weight: 2,
    keywords: [
      'currency', 'forex', 'commodities', 'crude oil', 'gold price', 'exchange rate',
      'bond yield', 'treasury yield',
    ],
  },
  {
    slug: 'finance',
    weight: 1,
    keywords: [
      'bank', 'lending', 'loan', 'credit card', 'insurance', 'mutual fund', 'deposit',
      'npa', 'fintech', 'payments',
    ],
  },
  {
    slug: 'automobile',
    weight: 2,
    keywords: [
      'electric vehicle', ' ev ', 'carmaker', 'automaker', 'suv', 'sedan', 'hatchback',
      'car launch', 'two-wheeler', 'scooter', 'automobile',
    ],
  },
  {
    slug: 'health',
    weight: 2,
    keywords: [
      'vaccine', 'hospital', 'disease', 'covid', 'health ministry', 'cancer', 'diabetes',
      'outbreak', 'clinical trial', 'public health', 'mental health',
    ],
  },
  {
    slug: 'science',
    weight: 2,
    keywords: [
      'research', 'scientists', 'study finds', 'nasa', 'isro', 'space', 'satellite',
      'climate change', 'physics', 'astronomy', 'lunar', 'mars', 'quantum',
    ],
  },
  {
    slug: 'education',
    weight: 2,
    keywords: [
      'university', 'school', 'students', 'exam', 'neet', 'jee', 'cbse', 'syllabus',
      'scholarship', 'admission', 'ugc',
    ],
  },
  {
    slug: 'entertainment',
    weight: 2,
    keywords: [
      'film', 'movie', 'box office', 'bollywood', 'hollywood', 'netflix', 'streaming',
      'album', 'actor', 'trailer', 'series premiere',
    ],
  },
  {
    slug: 'politics',
    weight: 2,
    keywords: [
      'election', 'parliament', 'minister', 'government', 'opposition', 'lok sabha',
      'rajya sabha', 'bill passed', 'cabinet', 'policy', 'president', 'prime minister',
    ],
  },
  {
    slug: 'technology',
    weight: 1,
    keywords: [
      'smartphone', 'chip', 'semiconductor', 'cloud', 'software', 'app', 'device',
      'gadget', 'processor', 'data centre', 'data center', 'cybersecurity', 'privacy',
    ],
  },
  {
    slug: 'business',
    weight: 1,
    keywords: [
      'company', 'revenue', 'profit', 'earnings', 'acquisition', 'merger', 'quarterly',
      'ceo', 'layoffs', 'jobs cut', 'deal',
    ],
  },
  {
    slug: 'sports',
    weight: 1,
    keywords: [
      'tournament', 'championship', 'olympic', 'medal', 'match', 'coach', 'athlete',
      'tennis', 'badminton', 'hockey', 'kabaddi',
    ],
  },
];

/** Maps common publisher category labels onto our slugs. */
const HINT_ALIASES: Record<string, string> = {
  sport: 'sports',
  sports: 'sports',
  business: 'business',
  'business news': 'business',
  markets: 'stocks',
  money: 'finance',
  economy: 'economy',
  tech: 'technology',
  technology: 'technology',
  science: 'science',
  health: 'health',
  politics: 'politics',
  world: 'world',
  'world news': 'world',
  india: 'india',
  national: 'india',
  entertainment: 'entertainment',
  education: 'education',
  auto: 'automobile',
  cricket: 'cricket',
  football: 'football',
  soccer: 'football',
  ai: 'ai',
  startups: 'startups',
  environment: 'science',
  opinion: 'world',
};

export interface CategorizeInput {
  title: string;
  description?: string | null;
  /** The provider's own category label, if any. */
  hint?: string | null;
  /** ISO country code, used only to choose between `india` and `world` as a fallback. */
  country?: string | null;
}

export interface CategorizeResult {
  category: string;
  /** 0..1, for observability: a low score means the fallback was used. */
  confidence: number;
  /** The rule that won, or 'hint' / 'fallback'. */
  reason: string;
}

/**
 * Scores every rule and returns the strongest match.
 *
 * A publisher hint is trusted only when it maps to a known slug AND no keyword rule
 * scores higher: hints are often too broad ("News", "Top Stories") to be useful.
 */
export const categorize = (input: CategorizeInput): CategorizeResult => {
  // Pad so ' ai ' style boundary keywords can match at string edges.
  const haystack = ` ${input.title.toLowerCase()} ${(input.description ?? '').toLowerCase()} `;

  let best: { slug: string; score: number } | null = null;

  for (const rule of RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) score += rule.weight ?? 1;
    }
    if (score > 0 && (best === null || score > best.score)) {
      best = { slug: rule.slug, score };
    }
  }

  const hintSlug = input.hint ? HINT_ALIASES[input.hint.trim().toLowerCase()] : undefined;

  if (best && best.score >= 3) {
    return { category: best.slug, confidence: Math.min(1, best.score / 6), reason: `keywords:${best.slug}` };
  }

  if (hintSlug) {
    return { category: hintSlug, confidence: 0.6, reason: 'hint' };
  }

  if (best) {
    return { category: best.slug, confidence: Math.min(1, best.score / 6), reason: `keywords:${best.slug}` };
  }

  // Nothing matched. Geography is the least-wrong default for general news.
  const fallback = input.country?.toLowerCase() === 'in' ? 'india' : 'world';
  return { category: fallback, confidence: 0.2, reason: 'fallback:country' };
};
