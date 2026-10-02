# AMIL API and worker. Build context: the repository root (see docker-compose.yml).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo

# The full workspace: builds the API, and runs one-shot tasks (migrate, seed, demo data).
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@amil/api
# Production dependencies only, plus the Prisma client generated above (its CLI is a dev
# dependency, so the client is copied rather than generated again).
RUN pnpm --filter @amil/api deploy --prod --legacy /out \
  && for d in /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma; do \
       pkg="$(basename "$(dirname "$(dirname "$d")")")"; \
       rm -rf "$d/client" && cp -r "/repo/node_modules/.pnpm/$pkg/node_modules/.prisma/client" "$d/client"; \
     done

# Slim runtime: the bundled API, its production dependencies and nothing else.
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
