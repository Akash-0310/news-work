# NewsFlow — Architecture

A daily news aggregation platform: multi-provider ingestion → normalization → deduplication into
**Stories** → ranking → PostgreSQL → Redis-cached REST API → React reading experience.

---

## 1. System shape

```
┌──────────────────────────────────────────────────────────────────────────┐
│  External world                                                          │
│   World News API · APITube · NewsAPI · Sports API · RSS (many publishers) │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │  (server-side only — keys never leave the API tier)
                    ┌───────────▼────────────┐
                    │  Provider layer        │  NewsProvider interface
                    │  one adapter / source  │  fetchLatestNews / searchNews
                    └───────────┬────────────┘  fetchByCategory / fetchByCountry
                                │  RawArticle[]
                    ┌───────────▼────────────┐
                    │  Ingestion pipeline    │  normalize → validate → dedupe
                    │  (pure, unit-tested)   │  → categorize → score
                    └───────────┬────────────┘
                                │  NormalizedArticle[]
       ┌────────────────────────▼─────────────────────────┐
       │  BullMQ workers (separate process)               │
       │  news-fetch · trending · cleanup                 │
       └───────┬──────────────────────────────┬───────────┘
               │ writes                       │ invalidates / recomputes
        ┌──────▼───────┐               ┌──────▼──────┐
        │  PostgreSQL  │               │    Redis    │  cache · rate limits
        │  (Prisma)    │               │             │  queues · pub/sub
        └──────┬───────┘               └──────┬──────┘
               │                              │
        ┌──────▼──────────────────────────────▼───────┐
        │  Express REST API (+ WebSocket for breaking) │
        │  route → controller → service → repository   │
        └──────────────────────┬───────────────────────┘
                               │  JSON envelope
                    ┌──────────▼───────────┐
                    │  React + Vite SPA    │  TanStack Query · Zustand
                    └──────────────────────┘
```

**Hard rule:** the frontend never talks to an external news API. It only knows `/api/*`.

---

## 2. Repository layout

```
newsflow/
├── docker-compose.yml          # postgres · redis · server · worker · web
├── .env.example                # every knob, no secrets
├── ARCHITECTURE.md
├── README.md
│
├── server/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma       # relational model
│   │   ├── migrations/         # includes hand-written FTS migration
│   │   └── seed.ts             # realistic sample news, works with zero API keys
│   └── src/
│       ├── app.ts              # express wiring (no listen) — importable by tests
│       ├── server.ts           # http listen + graceful shutdown
│       ├── config/             # env parsing (zod), prisma client, redis client, logger
│       ├── routes/             # URL → controller. No logic.
│       ├── controllers/        # HTTP in/out only. Parse, delegate, respond.
│       ├── services/           # business logic. Caching, orchestration, scoring.
│       ├── repositories/       # the only place Prisma queries live.
│       ├── middleware/         # auth, rate limit, validate, error handler, request log
│       ├── validators/         # zod schemas per route
│       ├── providers/          # NewsProvider.ts + one adapter per external source
│       ├── pipeline/           # normalize · validate · dedupe · categorize · rank
│       ├── queues/             # BullMQ queue + scheduler definitions
│       ├── workers/            # queue processors (own process)
│       ├── realtime/           # WebSocket hub for breaking news
│       ├── ai/                 # LLMProvider interface + noop impl (future features)
│       ├── utils/              # response envelope, errors, text/time helpers
│       └── types/              # shared domain types
│
└── web/
    └── src/
        ├── components/{common,news,layout}/
        ├── pages/{Home,Category,Article,Search,Bookmarks,Profile,Login,Admin}/
        ├── layouts/            # AppLayout (header/footer/bottom-nav), AdminLayout
        ├── routes/             # route table + lazy imports + guards
        ├── services/api/       # axios instance + one module per API resource
        ├── hooks/              # TanStack Query hooks wrapping services
        ├── store/              # zustand: auth session, theme, UI prefs
        ├── types/              # mirrors server DTOs
        ├── utils/              # formatters (relative time, reading time)
        ├── App.tsx
        └── main.tsx
```

### Layering rules

| Layer | May import | Must not |
| --- | --- | --- |
| route | controller, middleware, validator | prisma, service |
| controller | service, utils | prisma, redis |
| service | repository, cache, pipeline, provider | express `req`/`res` |
| repository | prisma | express, redis |
| pipeline | utils, types | prisma, redis, express |
| React component | hooks, store, utils | axios directly |

The pipeline being dependency-free is deliberate: normalization, dedup keys and ranking are the
parts most likely to be wrong, so they are pure functions with unit tests and no I/O.

---

## 3. Data model

```
User ──┬── UserPreference ──→ Category ──→ NewsArticle ──→ Story
       ├── Bookmark ─────────────────────→ NewsArticle
       ├── ReadingHistory ──────────────→ NewsArticle
       └── RefreshToken

Source ──→ NewsArticle
IngestionRun (observability: per-provider fetch outcome)
```

**Story** is the aggregation unit. One real-world event = one `Story`; each publisher's take on it
is a `NewsArticle` pointing at that story. This is what powers "Covered by 8 sources" and coverage
comparison, and it means dedup never destroys a publisher's article — it groups it.

Key indexes: `publishedAt`, `category`, `country`, `sourceName`, `importanceScore`, `externalId`,
`urlHash` (unique), `titleHash`, plus a stored `tsvector` + GIN index for full-text search.

---

## 4. Deduplication strategy (layered, cheapest first)

1. **Provider external ID** — same provider re-reporting the same item → same article, update in place.
2. **Canonical URL hash** — strip tracking params (`utm_*`, `fbclid`, …), lowercase host, drop
   trailing slash/AMP suffix → SHA-1. Unique constraint, so re-ingestion is idempotent.
3. **Normalized title hash** — lowercase, strip publisher suffix (` - Reuters`), punctuation and
   stopwords, sort-insensitive token join → exact-match clustering.
4. **Similarity** — token-set Jaccard + trigram similarity against candidate stories from the last
   48 h in the same category. Above threshold → attach to that story.

Different publishers → **different articles, same story**. Same publisher + same canonical URL →
one article, updated.

---

## 5. Ranking

```
importanceScore = freshness + sourceTrust + engagement + categoryWeight + crossSource
```

Each term is a separate pure function in `pipeline/ranking.ts` with a documented weight constant, so
the formula can be retuned without touching callers. Trending score is a second, faster-decaying
formula recomputed by the trending worker every few minutes from views/bookmarks/source-count.

---

## 6. Caching

| Key | TTL | Invalidated by |
| --- | --- | --- |
| `news:latest:*` | 2 min | fetch worker |
| `news:trending` | 2 min | trending worker |
| `news:category:<slug>:*` | 5 min | fetch worker (per touched category) |
| `news:search:<hash>` | 3 min | TTL only |
| `news:article:<id>` | 10 min | admin edit/hide |
| `feed:user:<id>` | 3 min | preference change, bookmark |

Cache is read-through in the service layer via a single `cached()` helper that records hit/miss
metrics. Every cached read must degrade gracefully: if Redis is down the service still answers from
Postgres.

---

## 7. Failure policy

- Providers are fetched with `Promise.allSettled`. One dead provider must never fail a run.
- Every provider run is recorded in `IngestionRun` with counts and error text → surfaced in the
  admin dashboard and `/health`.
- Centralized Express error handler converts `AppError` subclasses to the error envelope; unknown
  errors log a stack and return a generic 500 with an `errorCode`.
- Redis unavailability degrades to direct DB reads; Postgres unavailability is a hard 503.

---

## 8. Delivery phases

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Setup, schema, seed, basic news API, health | ← this commit |
| 2 | React homepage + category pages | |
| 3 | Ingestion workers + providers | |
| 4 | Redis caching | |
| 5 | Auth (JWT + refresh) | |
| 6 | Bookmarks + preferences + my-feed | |
| 7 | Search (PG full-text) | |
| 8 | Trending | |
| 9 | Admin dashboard | |
| 10 | WebSocket breaking news | |
| 11 | AI interfaces + daily briefing | |
| 12 | Tests, Docker, deployment | |
