# NewsFlow

A daily news aggregation platform for India and the world. Ingests from multiple
providers, clusters duplicate coverage into **stories**, ranks by importance, and serves
a modern reading experience.

- **Frontend:** React 18 + TypeScript + Vite + React Router + Tailwind + TanStack Query + Zustand
- **Backend:** Node + TypeScript + Express + Zod + JWT + Prisma
- **Data:** PostgreSQL 16, Redis 7
- **Jobs:** BullMQ workers (fetch, trending, cleanup)

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design, layering rules and
delivery phases.

---

## Quick start

Requires Node 20.11+ and Docker (for Postgres and Redis).

**Run these one line at a time.** Windows PowerShell 5.1 does not support `&&`; if you
chain them it fails with `The token '&&' is not a valid statement separator`.

```
npm install
npm run infra:up      # start Postgres + Redis
npm run db:deploy     # create the schema
npm run db:seed       # load sample news
npm run dev           # API on :4000 and web app on :5173
```

Then open **http://localhost:5173** for the app. (Port 4000 is the JSON API, not the
web interface — opening it in a browser shows a service descriptor.)

To run only one side: `npm run dev:server` or `npm run dev:web`.

Steps 2-4 are also bundled as a single cross-platform command:

```
npm run setup
```

You do **not** need to create `.env` by hand for local development — a working one is
committed-adjacent at the repo root. To start from the template instead:

- PowerShell: `Copy-Item .env.example .env`
- bash/zsh: `cp .env.example .env`

Verify it works:

```
curl http://localhost:4000/health
curl "http://localhost:4000/api/news?limit=3"
```

### Shell note (Windows)

| bash / zsh | PowerShell 5.1 |
| --- | --- |
| `a && b` | `a; if ($?) { b }` — or just run them on separate lines |
| `cp x y` | `Copy-Item x y` |
| `export K=v` | `$env:K = "v"` |

The seed loads 26 stories / 72 articles across 21 categories from 20 publishers, so
**the app is fully usable with no news-provider API keys configured.**

### Demo accounts

Created by the seed, for local development only:

| Email | Password | Role |
| --- | --- | --- |
| `reader@newsflow.dev` | `Password123!` | USER (has interests + bookmarks) |
| `admin@newsflow.dev` | `Password123!` | ADMIN |

---

## Scripts

Run from the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | API + web dev servers together |
| `npm run dev:server` | API only, with watch reload |
| `npm run dev:worker` | Background workers only |
| `npm run setup` | infra:up + db:deploy + db:seed in one go |
| `npm run infra:up` / `infra:down` | Start / stop Postgres + Redis |
| `npm run db:deploy` | Apply existing migrations (no prompts) |
| `npm run db:migrate` | Create *and* apply a new migration (development) |
| `npm run db:seed` | Load sample news (idempotent, safe to re-run) |
| `npm run db:studio` | Prisma Studio data browser |
| `npm run typecheck` | Strict TypeScript check, both packages |
| `npm run test` | Vitest unit + integration tests |

---

## API

Base URL `http://localhost:4000/api`. Health probes are at the root, outside `/api`.

### Response envelope

Success:

```json
{ "success": true, "data": {}, "message": "Success" }
```

Paginated:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25,
                  "hasNext": true, "hasPrev": false },
  "message": "Success"
}
```

Error:

```json
{ "success": false, "message": "Something went wrong", "errorCode": "NEWS_FETCH_FAILED" }
```

Validation errors (422) add a `details` object of `{ "field": ["message"] }`.

### Endpoints available now (Phase 1)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Dependency report; 503 only when Postgres is unreachable |
| GET | `/health/live` | Liveness only, touches no dependency |
| GET | `/health/metrics` | Request latency, cache hit rate, counters |
| GET | `/api/news` | Full filtering: `page limit category includeChildren country language source from to sort` |
| GET | `/api/news/latest` | Chronological feed |
| GET | `/api/news/home` | Whole homepage in one response (`perSection`, `topStories`) |
| GET | `/api/news/top-stories` | Ranked stories (`limit`, `category`, `country`, `hours`) |
| GET | `/api/news/category/:category` | Rolls child categories in by default |
| GET | `/api/news/country/:country` | ISO 3166-1 alpha-2, e.g. `in`, `us` |
| GET | `/api/news/stories/:slug` | A story plus every publisher covering it |
| GET | `/api/news/:id` | Article detail + coverage + related |
| GET | `/api/categories` | Category tree; `?withCounts=true` adds article counts |
| GET | `/api/categories/:slug` | Single category with children |

`sort` accepts `latest`, `oldest`, `importance`, `popular`. `limit` is capped at 100.

Coming in later phases: `/api/auth/*`, `/api/feed`, `/api/preferences`,
`/api/bookmarks`, `/api/news/search`, `/api/news/trending`, `/api/admin/*`,
`/api/briefing/today`.

---

## Web app

Routes available now:

| Route | Page |
| --- | --- |
| `/` | Homepage: top stories, latest strip, 8 category sections |
| `/explore` | Full category index with article counts |
| `/category/:slug` | Category feed: sort, source/country/date filters, load more |
| `/article/:id` | Article summary, coverage from other sources, related |
| `/story/:slug` | One event, every publisher's version side by side |
| `/india`, `/technology`, ... | Shortcuts that redirect to `/category/:slug` |

Notes on the implementation:

- **Filters live in the URL**, not component state, so a filtered view is shareable,
  survives refresh, and works with the back button.
- **Route-level code splitting** — each page is its own chunk; the initial load carries
  only the shell and homepage.
- **Light / dark / system theme**, applied before first paint by an inline script in
  `index.html` so there is no flash of the wrong theme.
- **Bookmarks, search and profile are visible but disabled.** They need authentication
  (Phases 5-6) and search (Phase 7). They are rendered disabled rather than hidden so
  the layout does not shift when those phases land.

## Troubleshooting

### `Port 4000 is already in use`

An earlier `npm run dev:server` is still running. Note that `tsx watch` keeps its
supervisor process alive even after the server child crashes, and restarts it on the
next file change — so a crashed dev server can silently re-take the port later.

```
# PowerShell
Get-NetTCPConnection -LocalPort 4000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# macOS / Linux
lsof -ti :4000 | xargs kill
```

Or set `PORT` in `.env` to run on a different port. The server prints these
instructions itself when the bind fails.

### `Environment variable not found: DATABASE_URL`

`.env` is missing from the repository root. Copy the template
(`Copy-Item .env.example .env`) and re-run. See [Configuration](#configuration) for how
env files are located.

### `The token '&&' is not a valid statement separator`

You are on Windows PowerShell 5.1, which has no `&&`. Run the commands on separate
lines, or use `npm run setup`.

### Seed says `0 articles` / the API returns an empty list

The schema exists but the seed never ran. `npm run db:seed` — it is idempotent and safe
to re-run at any time.

## Configuration

A single `.env` at the **repository root** is shared by docker compose and both
workspaces. Because npm scripts run with their working directory set to `server/`,
nothing finds that file by default — so three places load it explicitly:

| Consumer | Loader |
| --- | --- |
| API and workers | [`src/config/loadEnv.ts`](server/src/config/loadEnv.ts), called by `config/env.ts` |
| Seed script (run by `tsx`, not the Prisma CLI) | same loader, called before `new PrismaClient()` |
| Prisma CLI (`migrate`, `studio`, `db seed`) | [`server/prisma.config.ts`](server/prisma.config.ts) |

`dotenv` never overwrites an existing variable, so real environment variables — CI
secrets, docker compose `environment:` blocks — always win over the file. An optional
`server/.env` overrides the root one, which is handy for running two API instances.

Config is parsed and validated once by Zod in `src/config/env.ts`. Import `env` from
there; never read `process.env` elsewhere.

## Database notes

### Migrations

```bash
npm run db:migrate                    # dev: create + apply
npm run db:deploy                     # CI/prod: apply existing only
```

Migration history is **forward-only** — applied migrations are never edited. Two
migrations are hand-written because Prisma cannot express their contents:

- `..._fulltext_search` — weighted `tsvector` generated columns, GIN indexes, `pg_trgm`
- `..._drop_partial_feed_indexes` — removes indexes that caused permanent schema drift

The generated `search_vector` columns are declared in `schema.prisma` as
`Unsupported("tsvector")` with their expressions, so `prisma migrate diff` reports **no
drift**. Verify with:

```bash
cd server && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://newsflow:newsflow@localhost:5432/newsflow_shadow" \
  --exit-code
```

> `prisma migrate reset` destroys all data. Only ever run it against a local
> development database.

### Why `Story`?

Publishers report the same event separately. Rather than deleting duplicates, matching
articles are attached to one `Story`. That is what powers "covered by 4 sources", lets
readers compare framing across outlets, and feeds the `crossSourceScore` ranking term —
corroboration by many outlets is the strongest signal that a story matters.

---

## Security posture

- Provider API keys, `DATABASE_URL`, `REDIS_URL` and JWT secrets are **server-side only**.
  The browser bundle receives only `VITE_*` variables.
- The server refuses to boot in production with placeholder or reused JWT secrets.
- Passwords hashed with argon2id. Refresh tokens stored hashed and rotated on use.
- Helmet security headers, strict CORS allowlist, 100 kB body cap, Zod validation on
  every input, Redis-backed rate limiting shared across instances.
- Logs redact `authorization`, cookies, passwords, tokens and connection strings.
- Full article bodies are not stored unless a publisher licenses redistribution; the UI
  always links to the original source.

---

## Content and licensing

The seed contains **original sample copy written for this project**, not publisher text.
Sample article URLs are deliberately non-resolving so nothing implies a real outlet
published this content. Placeholder images come from `picsum.photos`.

In production the pipeline stores metadata, headlines and short excerpts, and links out
to the publisher — it does not reproduce full copyrighted articles.
