# NewsFlow API / worker image.
#
# The build context is the repository ROOT, not server/, because this is an npm
# workspace: package-lock.json lives at the root and `npm ci` needs it to install
# reproducibly. See docker-compose.yml.
#
# Multi-stage so the runtime image carries no compiler toolchain, no dev dependencies
# and no TypeScript sources.

# ---------------------------------------------------------------------------
# base: shared toolchain for anything that runs npm install
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app

# argon2 is a native module with no prebuilt binary for Alpine's musl libc, so it is
# compiled from source. This toolchain stays out of the runtime image.
RUN apk add --no-cache python3 make g++

# Manifests only, so the install layer is cached until dependencies actually change.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# ---------------------------------------------------------------------------
# prod-deps: production dependency tree, plus the generated Prisma client
# ---------------------------------------------------------------------------
FROM base AS prod-deps

# `--include-workspace-root` is required: the root package.json owns the workspace
# definition, so installing a single workspace without it fails.
RUN npm ci --omit=dev --workspace server --include-workspace-root --no-audit --no-fund

# The Prisma client is generated code, and it is generated INTO node_modules. It must
# therefore be produced in the same stage whose node_modules the runtime image copies,
# otherwise the image ships a node_modules with no client and every query throws.
# (`prisma` is a runtime dependency, not a dev one, precisely because of this and
# because the container runs `prisma migrate deploy` on start.)
COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/
RUN npx prisma generate --schema server/prisma/schema.prisma

# ---------------------------------------------------------------------------
# build: full dependency tree, compile TypeScript to dist/
# ---------------------------------------------------------------------------
FROM base AS build
RUN npm ci --workspace server --include-workspace-root --no-audit --no-fund

COPY server ./server

# tsc type-checks against the generated client, so it must exist first.
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build --workspace server

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Alpine's node image has no init system. Without one, PID 1 does not forward SIGTERM,
# so the graceful shutdown in server.ts would never run and `docker stop` would kill
# the process mid-request after the 10s timeout.
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=4000

# Hoisted workspace dependencies live at the root; Node resolution from
# /app/server/dist walks up and finds them.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/server/package.json ./server/package.json

# Schema, migrations and config are needed at runtime for `prisma migrate deploy`.
COPY --from=prod-deps /app/server/prisma ./server/prisma
COPY --from=prod-deps /app/server/prisma.config.ts ./server/prisma.config.ts

COPY --from=build /app/server/dist ./server/dist

# Run unprivileged: the official node image ships a `node` user for this.
USER node

# cwd is server/ so `node dist/server.js` and `npx prisma migrate deploy` both resolve
# the way they do in local development.
WORKDIR /app/server

EXPOSE 4000

# Node can probe itself; no need to add curl to the image. Uses /health/live, which
# never touches Postgres or Redis, so a database blip cannot mark the container
# unhealthy and trigger a restart loop.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
