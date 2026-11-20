# syntax=docker/dockerfile:1.7
#
# Okidoc server images for a Linux host (amd64 or arm64). One Dockerfile, two targets:
#   docker build --target api -t okidoc-api .
#   docker build --target web -t okidoc-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.in .
# Normally you use docker-compose.yml, which builds both. See docs/DEPLOY.md.
# The mobile app is not part of these images — it is built and released separately.

ARG NODE_VERSION=22

# ---------------------------------------------------------------- base
# Debian slim (glibc) rather than Alpine: Prisma, argon2 and Next's SWC ship glibc binaries.
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false
WORKDIR /app

# ---------------------------------------------------------------- manifests
# Only package files, so the npm install layers stay cached until dependencies change.
# The mobile package.json is needed for the lockfile to match, but its dependencies are never installed.
FROM base AS manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/

# ---------------------------------------------------------------- build (all dev deps)
FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w @okidoc/shared -w @okidoc/api -w @okidoc/web
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
# Public URL of the API as the browser sees it. Next.js bakes NEXT_PUBLIC_* in at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_OUTPUT=standalone
RUN npm run build -w @okidoc/shared \
 && cd apps/api \
 && npx prisma generate \
 && npm run build \
 && npx tsc prisma/seed.ts --outDir prisma/dist --module commonjs --target es2022 --esModuleInterop --skipLibCheck --types node \
 && cd ../web \
 && npm run build

# ---------------------------------------------------------------- api production deps
FROM manifests AS api-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev -w @okidoc/shared -w @okidoc/api

# ---------------------------------------------------------------- api (NestJS, port 4000)
FROM base AS api
ENV NODE_ENV=production \
    PORT=4000 \
    STORAGE_DIR=/data/uploads
COPY --from=api-deps /app/node_modules ./node_modules
# Prisma client generated for this schema and Linux.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/okidoc-api
RUN sed -i 's/\r$//' /usr/local/bin/okidoc-api \
 && chmod +x /usr/local/bin/okidoc-api \
 && mkdir -p /data/uploads \
 && chown -R node:node /data
USER node
WORKDIR /app/apps/api
VOLUME ["/data/uploads"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applies pending database migrations, then runs the command.
ENTRYPOINT ["okidoc-api"]
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------- web (Next.js, port 3000)
FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
