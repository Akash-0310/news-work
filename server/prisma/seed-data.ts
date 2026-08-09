/**
 * Seed dataset.
 *
 * Kept separate from seed.ts so the *data* is readable without wading through the
 * insert logic. Content is original sample copy written for this project, not scraped
 * publisher text: the seed must be safe to ship and must not contain anyone's
 * copyrighted article body.
 *
 * Several stories deliberately carry coverage from multiple publishers with reworded
 * headlines, so the Story clustering and the "covered by N sources" UI have something
 * real to display straight after `npm run db:seed`.
 */

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  /** Ranking multiplier; see pipeline/ranking.ts. */
  weight: number;
  position: number;
  /** Shown in the main header nav. */
  isPrimary: boolean;
  colorHex: string;
  iconName: string;
  parentSlug?: string;
}

/**
 * The taxonomy. Weights encode editorial priority for a reader interested in India
 * plus global tech/business: hard news and markets outrank lifestyle sections.
 */
export const CATEGORIES: SeedCategory[] = [
  { name: 'India', slug: 'india', description: 'National news from across India', weight: 1.4, position: 1, isPrimary: true, colorHex: '#f97316', iconName: 'MapPin' },
  { name: 'World', slug: 'world', description: 'International news and global affairs', weight: 1.3, position: 2, isPrimary: true, colorHex: '#0ea5e9', iconName: 'Globe' },
  { name: 'Technology', slug: 'technology', description: 'Consumer tech, devices, platforms and the internet', weight: 1.3, position: 3, isPrimary: true, colorHex: '#6366f1', iconName: 'Cpu' },
  { name: 'AI', slug: 'ai', description: 'Artificial intelligence and machine learning', weight: 1.4, position: 4, isPrimary: true, colorHex: '#8b5cf6', iconName: 'Sparkles', parentSlug: 'technology' },
  { name: 'Software', slug: 'software', description: 'Programming, developer tools and open source', weight: 1.1, position: 5, isPrimary: false, colorHex: '#14b8a6', iconName: 'Code', parentSlug: 'technology' },
  { name: 'Startups', slug: 'startups', description: 'Funding rounds, founders and the startup economy', weight: 1.2, position: 6, isPrimary: false, colorHex: '#f43f5e', iconName: 'Rocket', parentSlug: 'business' },
  { name: 'Business', slug: 'business', description: 'Companies, deals and corporate strategy', weight: 1.3, position: 7, isPrimary: true, colorHex: '#0891b2', iconName: 'Briefcase' },
  { name: 'Economy', slug: 'economy', description: 'Growth, inflation, jobs and policy', weight: 1.3, position: 8, isPrimary: false, colorHex: '#65a30d', iconName: 'TrendingUp', parentSlug: 'business' },
  { name: 'Finance', slug: 'finance', description: 'Banking, credit and personal finance', weight: 1.25, position: 9, isPrimary: true, colorHex: '#16a34a', iconName: 'Landmark' },
  { name: 'Stock Market', slug: 'stocks', description: 'Equities, indices and market movers', weight: 1.2, position: 10, isPrimary: false, colorHex: '#22c55e', iconName: 'LineChart', parentSlug: 'finance' },
  { name: 'Cryptocurrency', slug: 'crypto', description: 'Digital assets, blockchain and regulation', weight: 1.1, position: 11, isPrimary: false, colorHex: '#f59e0b', iconName: 'Bitcoin', parentSlug: 'finance' },
  { name: 'Global Markets', slug: 'global-markets', description: 'Currencies, commodities and cross-border flows', weight: 1.15, position: 12, isPrimary: false, colorHex: '#84cc16', iconName: 'Activity', parentSlug: 'finance' },
  { name: 'Politics', slug: 'politics', description: 'Government, elections and policy', weight: 1.25, position: 13, isPrimary: false, colorHex: '#dc2626', iconName: 'Vote' },
  { name: 'Sports', slug: 'sports', description: 'Results, transfers and tournaments', weight: 1.1, position: 14, isPrimary: true, colorHex: '#ea580c', iconName: 'Trophy' },
  { name: 'Cricket', slug: 'cricket', description: 'Internationals, franchise cricket and domestic games', weight: 1.2, position: 15, isPrimary: false, colorHex: '#facc15', iconName: 'Target', parentSlug: 'sports' },
  { name: 'Football', slug: 'football', description: 'Leagues, cups and transfers', weight: 1.05, position: 16, isPrimary: false, colorHex: '#059669', iconName: 'CircleDot', parentSlug: 'sports' },
  { name: 'Science', slug: 'science', description: 'Research, space and the environment', weight: 1.15, position: 17, isPrimary: true, colorHex: '#7c3aed', iconName: 'Atom' },
  { name: 'Health', slug: 'health', description: 'Medicine, public health and wellbeing', weight: 1.2, position: 18, isPrimary: false, colorHex: '#e11d48', iconName: 'HeartPulse' },
  { name: 'Entertainment', slug: 'entertainment', description: 'Film, streaming and music', weight: 0.9, position: 19, isPrimary: false, colorHex: '#d946ef', iconName: 'Clapperboard' },
  { name: 'Education', slug: 'education', description: 'Schools, universities and skilling', weight: 1.0, position: 20, isPrimary: false, colorHex: '#2563eb', iconName: 'GraduationCap' },
  { name: 'Automobile', slug: 'automobile', description: 'Cars, EVs and mobility', weight: 1.0, position: 21, isPrimary: false, colorHex: '#475569', iconName: 'Car' },
];

export interface SeedSource {
  name: string;
  slug: string;
  domain: string;
  homepage: string;
  country: string;
  /** 0..1 reliability weight used by ranking. */
  trustScore: number;
  feedUrl?: string;
}

/**
 * Publishers, with RSS endpoints where they are publicly available. The RSS provider
 * in Phase 3 reads `feedUrl` from these rows, so adding a publisher is a data change
 * rather than a code change.
 */
export const SOURCES: SeedSource[] = [
  { name: 'Reuters', slug: 'reuters', domain: 'reuters.com', homepage: 'https://www.reuters.com', country: 'us', trustScore: 0.95 },
  { name: 'Associated Press', slug: 'ap-news', domain: 'apnews.com', homepage: 'https://apnews.com', country: 'us', trustScore: 0.94 },
  { name: 'BBC News', slug: 'bbc-news', domain: 'bbc.com', homepage: 'https://www.bbc.com/news', country: 'gb', trustScore: 0.92, feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Guardian', slug: 'the-guardian', domain: 'theguardian.com', homepage: 'https://www.theguardian.com', country: 'gb', trustScore: 0.86, feedUrl: 'https://www.theguardian.com/world/rss' },
  { name: 'The Hindu', slug: 'the-hindu', domain: 'thehindu.com', homepage: 'https://www.thehindu.com', country: 'in', trustScore: 0.88, feedUrl: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { name: 'The Indian Express', slug: 'indian-express', domain: 'indianexpress.com', homepage: 'https://indianexpress.com', country: 'in', trustScore: 0.85, feedUrl: 'https://indianexpress.com/section/india/feed/' },
  { name: 'Mint', slug: 'mint', domain: 'livemint.com', homepage: 'https://www.livemint.com', country: 'in', trustScore: 0.84, feedUrl: 'https://www.livemint.com/rss/markets' },
  { name: 'Business Standard', slug: 'business-standard', domain: 'business-standard.com', homepage: 'https://www.business-standard.com', country: 'in', trustScore: 0.83 },
  { name: 'The Economic Times', slug: 'economic-times', domain: 'economictimes.indiatimes.com', homepage: 'https://economictimes.indiatimes.com', country: 'in', trustScore: 0.8 },
  { name: 'TechCrunch', slug: 'techcrunch', domain: 'techcrunch.com', homepage: 'https://techcrunch.com', country: 'us', trustScore: 0.78, feedUrl: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', slug: 'the-verge', domain: 'theverge.com', homepage: 'https://www.theverge.com', country: 'us', trustScore: 0.79, feedUrl: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', slug: 'ars-technica', domain: 'arstechnica.com', homepage: 'https://arstechnica.com', country: 'us', trustScore: 0.85, feedUrl: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Wired', slug: 'wired', domain: 'wired.com', homepage: 'https://www.wired.com', country: 'us', trustScore: 0.8 },
  { name: 'Bloomberg', slug: 'bloomberg', domain: 'bloomberg.com', homepage: 'https://www.bloomberg.com', country: 'us', trustScore: 0.9 },
  { name: 'Financial Times', slug: 'financial-times', domain: 'ft.com', homepage: 'https://www.ft.com', country: 'gb', trustScore: 0.91 },
  { name: 'CNBC', slug: 'cnbc', domain: 'cnbc.com', homepage: 'https://www.cnbc.com', country: 'us', trustScore: 0.78 },
  { name: 'ESPNcricinfo', slug: 'espncricinfo', domain: 'espncricinfo.com', homepage: 'https://www.espncricinfo.com', country: 'in', trustScore: 0.87 },
  { name: 'Nature', slug: 'nature', domain: 'nature.com', homepage: 'https://www.nature.com', country: 'gb', trustScore: 0.96 },
  { name: 'Scientific American', slug: 'scientific-american', domain: 'scientificamerican.com', homepage: 'https://www.scientificamerican.com', country: 'us', trustScore: 0.89 },
  { name: 'Hacker News Digest', slug: 'hn-digest', domain: 'news.ycombinator.com', homepage: 'https://news.ycombinator.com', country: 'us', trustScore: 0.6 },
];

export interface SeedCoverage {
  /** Must match a `SeedSource.slug`. */
  sourceSlug: string;
  /** Deliberately reworded per publisher so dedup clustering is exercised. */
  title: string;
  description: string;
  author?: string;
  /** Short original excerpt only. Never a full publisher article body. */
  excerpt?: string;
}

export interface SeedStory {
  /** Canonical headline for the cluster. */
  title: string;
  summary: string;
  category: string;
  subcategory?: string;
  country: string;
  /** Age of the newest article in the cluster. */
  publishedHoursAgo: number;
  /** Seeded view/bookmark counts so trending and ranking have signal on day one. */
  viewCount: number;
  bookmarkCount: number;
  coverage: SeedCoverage[];
}

/**
 * Placeholder imagery. A deterministic seed per story means the same story always
 * renders the same picture, which keeps screenshots and visual diffs stable.
 */
export const imageForSlug = (slug: string): string =>
  `https://picsum.photos/seed/${slug}/1200/675`;

export const STORIES: SeedStory[] = [
  {
    title: 'India unveils national compute mission to expand domestic AI capacity',
    summary:
      'The programme pairs public funding for GPU clusters with subsidised access for universities and startups, and sets local-language model development as an explicit goal.',
    category: 'ai',
    subcategory: 'policy',
    country: 'in',
    publishedHoursAgo: 2,
    viewCount: 4820,
    bookmarkCount: 96,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'India unveils national compute mission to expand domestic AI capacity',
        description:
          'The mission will fund shared GPU clusters across six cities and reserve a share of capacity for academic researchers and early-stage companies.',
        author: 'Priya Raghavan',
        excerpt:
          'The programme is structured in three tranches. The first funds procurement of shared accelerator capacity; the second underwrites subsidised access for universities and companies below a revenue threshold; the third supports open datasets and evaluation benchmarks for Indian languages.',
      },
      {
        sourceSlug: 'mint',
        title: 'Compute mission clears cabinet: what it means for Indian AI startups',
        description:
          'Founders welcomed subsidised access but flagged that allocation rules and pricing will determine whether smaller teams actually benefit.',
        author: 'Rohit Menon',
      },
      {
        sourceSlug: 'reuters',
        title: 'India approves state-backed AI computing programme',
        description:
          'The plan positions India alongside other governments funding sovereign compute capacity for research and industry.',
      },
      {
        sourceSlug: 'techcrunch',
        title: 'India bets on shared GPU clusters to close its AI compute gap',
        description:
          'Subsidised capacity could lower the cost of training mid-sized models domestically rather than renting foreign cloud regions.',
        author: 'Dana Whitfield',
      },
    ],
  },
  {
    title: 'RBI holds policy rate steady, signals data-dependent path ahead',
    summary:
      'The monetary policy committee kept the benchmark rate unchanged, citing easing food inflation but persistent uncertainty in global energy prices.',
    category: 'economy',
    country: 'in',
    publishedHoursAgo: 4,
    viewCount: 6110,
    bookmarkCount: 141,
    coverage: [
      {
        sourceSlug: 'mint',
        title: 'RBI holds policy rate steady, signals data-dependent path ahead',
        description:
          'The committee voted to maintain the repo rate, with the governor emphasising that future decisions will follow incoming inflation prints.',
        author: 'Ananya Bose',
        excerpt:
          'The statement retained the withdrawal-of-accommodation language while acknowledging that headline inflation has moderated for a third consecutive month. Economists read the tone as neutral rather than dovish.',
      },
      {
        sourceSlug: 'business-standard',
        title: 'Repo rate unchanged as MPC waits for clearer inflation signal',
        description: 'Bond yields eased slightly as the decision matched consensus expectations.',
      },
      {
        sourceSlug: 'bloomberg',
        title: 'India central bank stands pat, keeps options open on easing',
        description:
          'Policymakers stopped short of signalling a cut, leaving markets to price the first move later in the year.',
      },
      {
        sourceSlug: 'economic-times',
        title: 'MPC keeps rates on hold: five takeaways for borrowers and savers',
        description:
          'Home loan rates linked to external benchmarks stay put, while deposit rates are expected to plateau.',
      },
    ],
  },
  {
    title: 'Sensex and Nifty close at record highs on strong domestic inflows',
    summary:
      'Benchmark indices ended firmly higher, led by financials and capital goods, as domestic institutional buying offset muted foreign participation.',
    category: 'stocks',
    country: 'in',
    publishedHoursAgo: 6,
    viewCount: 5290,
    bookmarkCount: 88,
    coverage: [
      {
        sourceSlug: 'economic-times',
        title: 'Sensex and Nifty close at record highs on strong domestic inflows',
        description:
          'Banking and infrastructure counters led gains, with market breadth positive through the session.',
        author: 'Kunal Shah',
      },
      {
        sourceSlug: 'mint',
        title: 'Indian equities hit fresh peak as domestic funds keep buying',
        description: 'Systematic investment flows continue to cushion the market against foreign outflows.',
      },
      {
        sourceSlug: 'cnbc',
        title: 'Indian benchmarks notch record close, outpacing regional peers',
        description: 'The rally widened beyond large-cap financials into mid-cap industrials.',
      },
    ],
  },
  {
    title: 'Open-source model release narrows gap with proprietary systems on coding tasks',
    summary:
      'A permissively licensed model posted competitive results on public code benchmarks, though reviewers cautioned that benchmark contamination remains unresolved.',
    category: 'ai',
    country: 'us',
    publishedHoursAgo: 5,
    viewCount: 7340,
    bookmarkCount: 212,
    coverage: [
      {
        sourceSlug: 'ars-technica',
        title: 'Open-source model release narrows gap with proprietary systems on coding tasks',
        description:
          'Independent evaluations put the release within a few points of closed competitors on several public benchmarks.',
        author: 'Marcus Feld',
        excerpt:
          'The weights ship under a permissive licence, which matters more than the benchmark deltas for teams that need to run inference on their own hardware for compliance reasons.',
      },
      {
        sourceSlug: 'the-verge',
        title: 'A new open-weights model is closing in on the closed leaders',
        description:
          'The licence permits commercial use, making self-hosted deployment viable for regulated industries.',
      },
      {
        sourceSlug: 'hn-digest',
        title: 'Open weights model posts strong coding benchmark numbers',
        description: 'Discussion focused on evaluation methodology and possible benchmark leakage.',
      },
      {
        sourceSlug: 'wired',
        title: 'Why open model weights are becoming an enterprise procurement question',
        description: 'Data-residency rules are pushing buyers toward models they can host themselves.',
      },
    ],
  },
  {
    title: 'India seal series win with commanding chase in the deciding one-day match',
    summary:
      'A composed century from the top order and disciplined middle-overs bowling delivered the series, with the captain crediting the bowlers for controlling the middle phase.',
    category: 'cricket',
    country: 'in',
    publishedHoursAgo: 9,
    viewCount: 9120,
    bookmarkCount: 174,
    coverage: [
      {
        sourceSlug: 'espncricinfo',
        title: 'India seal series win with commanding chase in the deciding one-day match',
        description:
          'An unbroken partnership through the final ten overs took the hosts home with more than four overs to spare.',
        author: 'Sriram Iyer',
        excerpt:
          'The chase was built on strike rotation rather than boundary hitting. Only twelve boundaries were struck in total, but the pair ran 61 singles between them.',
      },
      {
        sourceSlug: 'the-hindu',
        title: 'Clinical India close out the series in the decider',
        description: 'The bowling unit conceded just 38 runs across the middle ten overs.',
      },
      {
        sourceSlug: 'indian-express',
        title: 'Series decider: India chase down target with overs in hand',
        description: 'The captain praised the spinners for squeezing the run rate through the middle phase.',
      },
    ],
  },
  {
    title: 'Global shipping rates climb as operators reroute around a key corridor',
    summary:
      'Freight indices rose for a fourth straight week as carriers added days to voyages, with importers warning of knock-on costs in the next quarter.',
    category: 'global-markets',
    country: 'us',
    publishedHoursAgo: 11,
    viewCount: 2140,
    bookmarkCount: 47,
    coverage: [
      {
        sourceSlug: 'reuters',
        title: 'Global shipping rates climb as operators reroute around a key corridor',
        description:
          'Container rates on Asia-Europe lanes rose sharply, with carriers citing longer transit times.',
      },
      {
        sourceSlug: 'financial-times',
        title: 'Freight costs rise again as diversions lengthen voyages',
        description: 'Retailers with thin inventories are most exposed to the delay, analysts said.',
      },
      {
        sourceSlug: 'bloomberg',
        title: 'Container rates extend rally on longer routings',
        description: 'The increase has not yet fed through to consumer prices, economists noted.',
      },
    ],
  },
  {
    title: 'Researchers report a more efficient catalyst for green hydrogen production',
    summary:
      'A peer-reviewed paper describes a catalyst using substantially less iridium while maintaining output, though the authors stress that durability testing is at an early stage.',
    category: 'science',
    country: 'gb',
    publishedHoursAgo: 14,
    viewCount: 1880,
    bookmarkCount: 63,
    coverage: [
      {
        sourceSlug: 'nature',
        title: 'Researchers report a more efficient catalyst for green hydrogen production',
        description:
          'The team reports comparable current density with a fraction of the usual iridium loading.',
        author: 'H. Lindqvist',
        excerpt:
          'Cost, not efficiency, is the binding constraint on electrolyser deployment. Reducing precious-metal loading addresses that constraint directly, provided the catalyst survives industrial duty cycles.',
      },
      {
        sourceSlug: 'scientific-american',
        title: 'A cheaper path to green hydrogen, if it survives real conditions',
        description: 'Independent researchers called the result promising but early.',
      },
    ],
  },
  {
    title: 'Bitcoin steadies after volatile week as spot flows turn positive',
    summary:
      'Prices recovered part of the previous week decline, with analysts pointing to renewed inflows and thinner leverage in derivatives markets.',
    category: 'crypto',
    country: 'us',
    publishedHoursAgo: 7,
    viewCount: 3450,
    bookmarkCount: 71,
    coverage: [
      {
        sourceSlug: 'cnbc',
        title: 'Bitcoin steadies after volatile week as spot flows turn positive',
        description: 'Funding rates normalised after a stretch of forced liquidations.',
      },
      {
        sourceSlug: 'bloomberg',
        title: 'Crypto majors stabilise as leverage washes out',
        description: 'Open interest remains well below the level seen before the selloff.',
      },
    ],
  },
  {
    title: 'Indian startup funding rebounds, led by enterprise software and climate tech',
    summary:
      'Quarterly deal value rose from the prior period, with investors concentrating cheques in later-stage enterprise companies rather than consumer apps.',
    category: 'startups',
    country: 'in',
    publishedHoursAgo: 16,
    viewCount: 2760,
    bookmarkCount: 84,
    coverage: [
      {
        sourceSlug: 'economic-times',
        title: 'Indian startup funding rebounds, led by enterprise software and climate tech',
        description:
          'Deal counts stayed flat while average cheque size rose, indicating selectivity rather than breadth.',
        author: 'Neha Verma',
      },
      {
        sourceSlug: 'techcrunch',
        title: 'India venture funding recovers, but the money is going to fewer companies',
        description: 'Seed-stage founders report a materially harder market than the headline suggests.',
      },
      {
        sourceSlug: 'mint',
        title: 'Funding winter thaws selectively for Indian startups',
        description: 'Climate and B2B software absorbed the bulk of new capital.',
      },
    ],
  },
  {
    title: 'Major carmakers accelerate affordable EV plans for the Indian market',
    summary:
      'Several manufacturers confirmed launches in the mass-market segment, betting that charging build-out and battery costs have improved enough to move volumes.',
    category: 'automobile',
    country: 'in',
    publishedHoursAgo: 19,
    viewCount: 3110,
    bookmarkCount: 58,
    coverage: [
      {
        sourceSlug: 'business-standard',
        title: 'Major carmakers accelerate affordable EV plans for the Indian market',
        description: 'Launches target the segment below the current EV price band.',
      },
      {
        sourceSlug: 'economic-times',
        title: 'Mass-market EVs move up carmakers priority list',
        description: 'Localised battery packs are central to hitting the target price points.',
      },
    ],
  },
  {
    title: 'Parliament takes up data protection rules in a contested session',
    summary:
      'Opposition members sought referral to committee while the government pressed for passage, with industry groups split on the compliance timeline.',
    category: 'politics',
    country: 'in',
    publishedHoursAgo: 8,
    viewCount: 4020,
    bookmarkCount: 66,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'Parliament takes up data protection rules in a contested session',
        description: 'Debate centred on exemptions available to state agencies.',
        author: 'Vikram Sethi',
      },
      {
        sourceSlug: 'indian-express',
        title: 'Data rules face scrutiny over breadth of state exemptions',
        description: 'Civil society groups urged narrower carve-outs and clearer oversight.',
      },
      {
        sourceSlug: 'reuters',
        title: 'India moves on data protection implementation rules',
        description: 'Multinationals are watching localisation requirements closely.',
      },
    ],
  },
  {
    title: 'European football: title race tightens after weekend upsets',
    summary:
      'Two of the top three dropped points, cutting the gap at the summit to a single point with several fixtures still to play.',
    category: 'football',
    country: 'gb',
    publishedHoursAgo: 13,
    viewCount: 5670,
    bookmarkCount: 92,
    coverage: [
      {
        sourceSlug: 'the-guardian',
        title: 'European football: title race tightens after weekend upsets',
        description: 'A late equaliser away from home swung the goal difference calculation.',
        author: 'Tom Ackerley',
      },
      {
        sourceSlug: 'bbc-news',
        title: 'Weekend results leave title race on a knife edge',
        description: 'Managers pointed to fixture congestion after a run of midweek European games.',
      },
    ],
  },
  {
    title: 'Public health agencies expand vaccination drive ahead of the season',
    summary:
      'Health departments widened eligibility and extended clinic hours, with officials targeting coverage gaps identified in the previous cycle.',
    category: 'health',
    country: 'in',
    publishedHoursAgo: 21,
    viewCount: 1620,
    bookmarkCount: 39,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'Public health agencies expand vaccination drive ahead of the season',
        description: 'Mobile units will cover districts with the lowest recorded coverage.',
      },
      {
        sourceSlug: 'indian-express',
        title: 'Vaccination drive widened as officials target coverage gaps',
        description: 'Officials cited last-mile delivery rather than supply as the main constraint.',
      },
    ],
  },
  {
    title: 'Cloud providers cut prices on inference-optimised instances',
    summary:
      'Competing announcements lowered hourly rates for accelerator instances aimed at serving models rather than training them.',
    category: 'technology',
    country: 'us',
    publishedHoursAgo: 10,
    viewCount: 2980,
    bookmarkCount: 103,
    coverage: [
      {
        sourceSlug: 'the-verge',
        title: 'Cloud providers cut prices on inference-optimised instances',
        description: 'The cuts apply to serving workloads, not training capacity, which remains tight.',
      },
      {
        sourceSlug: 'ars-technica',
        title: 'Inference gets cheaper as cloud price competition sharpens',
        description: 'Sustained-use discounts make the effective reduction larger than headline rates.',
        author: 'Marcus Feld',
      },
      {
        sourceSlug: 'techcrunch',
        title: 'Price war moves from training to inference',
        description: 'Startups serving high request volumes stand to benefit most.',
      },
    ],
  },
  {
    title: 'A new TypeScript release trims build times on large monorepos',
    summary:
      'The release focuses on incremental checking and project references, with maintainers reporting meaningful improvements on large codebases.',
    category: 'software',
    country: 'us',
    publishedHoursAgo: 23,
    viewCount: 4410,
    bookmarkCount: 187,
    coverage: [
      {
        sourceSlug: 'hn-digest',
        title: 'A new TypeScript release trims build times on large monorepos',
        description: 'Maintainers of several large open-source repositories reported faster cold checks.',
      },
      {
        sourceSlug: 'ars-technica',
        title: 'TypeScript update targets the slowest part of large builds',
        description: 'Incremental type checking sees the largest gains.',
      },
    ],
  },
  {
    title: 'Global talks on plastics treaty end without a binding agreement',
    summary:
      'Negotiators adjourned with major questions unresolved, though delegates agreed on a further session and a narrowed text.',
    category: 'world',
    country: 'us',
    publishedHoursAgo: 17,
    viewCount: 2230,
    bookmarkCount: 51,
    coverage: [
      {
        sourceSlug: 'reuters',
        title: 'Global talks on plastics treaty end without a binding agreement',
        description: 'Production caps remained the central point of disagreement.',
      },
      {
        sourceSlug: 'the-guardian',
        title: 'Plastics treaty talks stall over production limits',
        description: 'Campaigners called the outcome a delay rather than a collapse.',
      },
      {
        sourceSlug: 'ap-news',
        title: 'Delegates leave plastics negotiations with work unfinished',
        description: 'A further round is scheduled, with a shorter draft text.',
      },
      {
        sourceSlug: 'bbc-news',
        title: 'No deal yet on plastics, but talks will resume',
        description: 'The chair said convergence had improved on waste management provisions.',
      },
    ],
  },
  {
    title: 'Universities expand credit transfer between vocational and degree programmes',
    summary:
      'Regulators approved a framework letting students carry vocational credits into degree courses, aimed at improving completion rates.',
    category: 'education',
    country: 'in',
    publishedHoursAgo: 26,
    viewCount: 1290,
    bookmarkCount: 34,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'Universities expand credit transfer between vocational and degree programmes',
        description: 'The framework sets equivalence rules across qualification levels.',
      },
      {
        sourceSlug: 'indian-express',
        title: 'Vocational credits to count toward degrees under new framework',
        description: 'Implementation timelines vary by state university.',
      },
    ],
  },
  {
    title: 'Streaming platforms shift spending toward regional-language originals',
    summary:
      'Commissioning data shows a pronounced move to regional productions, which deliver stronger retention per rupee than large national titles.',
    category: 'entertainment',
    country: 'in',
    publishedHoursAgo: 29,
    viewCount: 2510,
    bookmarkCount: 44,
    coverage: [
      {
        sourceSlug: 'mint',
        title: 'Streaming platforms shift spending toward regional-language originals',
        description: 'Retention economics, not prestige, are driving the reallocation.',
      },
      {
        sourceSlug: 'business-standard',
        title: 'Regional originals take a bigger share of streaming budgets',
        description: 'Production costs are a fraction of flagship national shows.',
      },
    ],
  },
  {
    title: 'Chipmakers report stronger demand for data-centre components',
    summary:
      'Quarterly results pointed to sustained data-centre orders offsetting softness in consumer segments, with guidance raised modestly.',
    category: 'business',
    country: 'us',
    publishedHoursAgo: 12,
    viewCount: 3890,
    bookmarkCount: 79,
    coverage: [
      {
        sourceSlug: 'bloomberg',
        title: 'Chipmakers report stronger demand for data-centre components',
        description: 'Consumer demand stayed weak, but data-centre orders more than compensated.',
      },
      {
        sourceSlug: 'financial-times',
        title: 'Data-centre orders carry chip results as consumer lags',
        description: 'Capacity commitments extend into next year, executives said.',
      },
      {
        sourceSlug: 'cnbc',
        title: 'Chip earnings beat on data-centre strength',
        description: 'Guidance implies continued tightness in advanced packaging.',
      },
    ],
  },
  {
    title: 'Monsoon forecast revised upward, easing concerns for kharif sowing',
    summary:
      'The updated outlook raised expected rainfall to above the long-period average, improving the outlook for planting and rural demand.',
    category: 'india',
    country: 'in',
    publishedHoursAgo: 3,
    viewCount: 5140,
    bookmarkCount: 112,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'Monsoon forecast revised upward, easing concerns for kharif sowing',
        description: 'The revision improves the outlook for reservoir levels and planting decisions.',
        author: 'Meera Nair',
        excerpt:
          'Distribution matters more than the aggregate. A normal seasonal total delivered unevenly can still leave individual districts in deficit during the critical sowing window.',
      },
      {
        sourceSlug: 'indian-express',
        title: 'Above-normal rainfall now expected, says updated outlook',
        description: 'Economists linked the revision to a better rural demand outlook.',
      },
      {
        sourceSlug: 'mint',
        title: 'Better monsoon outlook lifts rural demand expectations',
        description: 'Consumer goods companies with rural exposure rose on the news.',
      },
      {
        sourceSlug: 'reuters',
        title: 'India raises monsoon rainfall forecast',
        description: 'Agriculture accounts for a significant share of employment.',
      },
    ],
  },
  {
    title: 'Space agency confirms launch window for the next lunar mission',
    summary:
      'Engineers completed integration tests and confirmed a launch window, with the mission carrying an expanded instrument payload.',
    category: 'science',
    country: 'in',
    publishedHoursAgo: 15,
    viewCount: 6320,
    bookmarkCount: 155,
    coverage: [
      {
        sourceSlug: 'the-hindu',
        title: 'Space agency confirms launch window for the next lunar mission',
        description: 'Integration testing finished ahead of the review milestone.',
      },
      {
        sourceSlug: 'reuters',
        title: 'India sets launch window for follow-up lunar mission',
        description: 'The payload includes instruments for subsurface measurements.',
      },
      {
        sourceSlug: 'scientific-american',
        title: 'What the next lunar mission is designed to measure',
        description: 'Subsurface data would refine models of water-ice distribution.',
      },
    ],
  },
  {
    title: 'Banks tighten unsecured lending standards as regulator flags growth',
    summary:
      'Lenders raised score cut-offs on personal loans and credit cards after supervisory commentary on rapid unsecured growth.',
    category: 'finance',
    country: 'in',
    publishedHoursAgo: 20,
    viewCount: 2870,
    bookmarkCount: 61,
    coverage: [
      {
        sourceSlug: 'business-standard',
        title: 'Banks tighten unsecured lending standards as regulator flags growth',
        description: 'Approval rates on small-ticket personal loans fell quarter on quarter.',
      },
      {
        sourceSlug: 'mint',
        title: 'Personal loan approvals get harder as banks raise cut-offs',
        description: 'Fintech origination partners are seeing the sharpest impact.',
      },
      {
        sourceSlug: 'economic-times',
        title: 'Unsecured credit growth cools after supervisory nudge',
        description: 'Card spending growth also moderated.',
      },
    ],
  },
  {
    title: 'Enterprise software vendors bundle AI features without raising list prices',
    summary:
      'Several vendors added assistant features to existing tiers, betting that retention gains outweigh forgone upsell revenue.',
    category: 'technology',
    country: 'us',
    publishedHoursAgo: 25,
    viewCount: 1940,
    bookmarkCount: 57,
    coverage: [
      {
        sourceSlug: 'techcrunch',
        title: 'Enterprise software vendors bundle AI features without raising list prices',
        description: 'Buyers had resisted per-seat premiums for assistant functionality.',
      },
      {
        sourceSlug: 'the-verge',
        title: 'AI features become table stakes in enterprise software pricing',
        description: 'Vendors are competing on inclusion rather than add-on revenue.',
      },
    ],
  },
  {
    title: 'Currency markets calm as central bank commentary aligns with expectations',
    summary:
      'Major pairs traded in narrow ranges after policymakers offered little new guidance, with volatility gauges drifting lower.',
    category: 'global-markets',
    country: 'gb',
    publishedHoursAgo: 18,
    viewCount: 1180,
    bookmarkCount: 22,
    coverage: [
      {
        sourceSlug: 'financial-times',
        title: 'Currency markets calm as central bank commentary aligns with expectations',
        description: 'Implied volatility fell to the lower end of its recent range.',
      },
      {
        sourceSlug: 'reuters',
        title: 'Major currencies range-bound after policy remarks',
        description: 'Traders await the next inflation release for direction.',
      },
    ],
  },
  {
    title: 'City transit authorities pilot integrated ticketing across modes',
    summary:
      'A single fare product covering metro, bus and suburban rail entered pilot in two cities, with settlement handled by a common backend.',
    category: 'india',
    country: 'in',
    publishedHoursAgo: 31,
    viewCount: 1450,
    bookmarkCount: 37,
    coverage: [
      {
        sourceSlug: 'indian-express',
        title: 'City transit authorities pilot integrated ticketing across modes',
        description: 'Revenue sharing between operators was the main design challenge.',
      },
      {
        sourceSlug: 'the-hindu',
        title: 'One ticket, many modes: integrated fares enter pilot',
        description: 'Officials said full rollout depends on pilot settlement accuracy.',
      },
    ],
  },
  {
    title: 'Labour market data shows steady hiring with softer wage growth',
    summary:
      'Payroll additions held near the prior month while average earnings growth slowed, a combination economists read as consistent with a soft landing.',
    category: 'economy',
    country: 'us',
    publishedHoursAgo: 22,
    viewCount: 2650,
    bookmarkCount: 48,
    coverage: [
      {
        sourceSlug: 'reuters',
        title: 'Labour market data shows steady hiring with softer wage growth',
        description: 'The unemployment rate was unchanged.',
      },
      {
        sourceSlug: 'bloomberg',
        title: 'Hiring holds up as wage pressure eases',
        description: 'The mix supports the case for patience on rates.',
      },
      {
        sourceSlug: 'ap-news',
        title: 'Jobs report points to a cooling but resilient labour market',
        description: 'Revisions to prior months were modest.',
      },
    ],
  },
];
