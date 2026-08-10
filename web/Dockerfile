# NewsFlow web image: build the SPA, serve it with nginx.
#
# Build context is the repository ROOT (npm workspace, see server/Dockerfile).
#
# nginx rather than a Node server because the output is entirely static: no runtime
# JavaScript is needed to serve it, and the final image is ~50 MB instead of ~200 MB.

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN npm ci --workspace web --include-workspace-root --no-audit --no-fund

COPY web ./web

# Vite inlines VITE_* variables at BUILD time, so the API URL must be known here and
# cannot be changed by an environment variable on the running container. Passed through
# from docker-compose.yml.
ARG VITE_API_BASE_URL=http://localhost:4000/api
ARG VITE_WS_URL=ws://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

# vite.config.ts reads env files from the repo root (envDir), which does not exist in
# this context. The ENV values above take precedence, so an empty file is enough to
# stop loadEnv from failing.
RUN touch .env

RUN npm run build --workspace web

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Replace the default site with the SPA config (history fallback + asset caching).
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

# nginx:alpine already runs workers as the unprivileged `nginx` user; the master needs
# root to bind port 80 inside the container.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
