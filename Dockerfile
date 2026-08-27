# Debian-based rather than Alpine: @libsql/client ships native bindings that
# want glibc, and musl builds are the usual source of arm64 breakage on a Pi.
FROM node:22-bookworm-slim AS base

# ---------------------------------------------------------------- deps
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------- build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Next collects page data at build time, which instantiates better-auth and so
# reads the environment. These placeholders exist only to satisfy validation
# during compilation; this stage is discarded and the runtime stage receives
# the real values. Nothing here is a secret.
ENV DATABASE_URL="file:/tmp/build.db" \
    BETTER_AUTH_URL="http://localhost:3000" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret-000" \
    ANILIST_CLIENT_ID="build" \
    ANILIST_CLIENT_SECRET="build" \
    MAL_CLIENT_ID="build" \
    MAL_CLIENT_SECRET="build" \
    MAL_CODE_VERIFIER="build-time-placeholder-not-a-secret-0000000000"

RUN npm run build

# ---------------------------------------------------------------- runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default location of the SQLite file inside the mounted volume.
ENV DATABASE_URL=file:/data/nekostream.db

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output carries its own traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema migrations run at startup against the mounted volume.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/

# The migrator pulls in drizzle-orm files that Next's tracer has no reason to
# keep, so they are copied explicitly rather than left to chance.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data && chown nextjs:nodejs /data

VOLUME ["/data"]
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
