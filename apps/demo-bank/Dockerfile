# @amil/demo-bank (Next.js standalone). Build context: the amil/ folder (see docker-compose.yml).
FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@amil/demo-bank

FROM node:22-bookworm-slim AS runtime
# Prisma's query engine (the demo bank reads its own records) needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/demo-bank/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/demo-bank/.next/static ./apps/demo-bank/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/demo-bank/server.js"]
