# syntax=docker/dockerfile:1.7
# Shared by @rakhal/web (port 3005) and @rakhal/admin (port 3010). Build context: repo root.
#   docker build -f docker/next.Dockerfile --build-arg APP=web   --build-arg APP_PORT=3005 -t rakhal-web .
#   docker build -f docker/next.Dockerfile --build-arg APP=admin --build-arg APP_PORT=3010 -t rakhal-admin .
# Server-only vars (API_BASE_URL / ADMIN_API_BASE_URL) are read at RUNTIME, so one image serves every
# environment. NEXT_PUBLIC_* vars are inlined by Next at BUILD time: pass them as build args.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@11.9.0 --activate
WORKDIR /repo

FROM base AS build
ARG APP
RUN test -n "$APP" || (echo "build-arg APP=web|admin is required" && exit 1)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/admin-api-client/package.json packages/admin-api-client/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@rakhal/${APP}..."
COPY packages packages
COPY apps/${APP} apps/${APP}
# Build-time public vars (inlined into the client bundle).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_FARM_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_FARM_URL=${NEXT_PUBLIC_FARM_URL} \
    NEXT_STANDALONE=1
WORKDIR /repo/apps/${APP}
RUN pnpm build

FROM base AS runtime
ARG APP
ARG APP_PORT=3000
ENV NODE_ENV=production \
    APP=${APP} \
    PORT=${APP_PORT} \
    HOSTNAME=0.0.0.0
WORKDIR /repo
# Standalone output keeps the monorepo layout: /repo/apps/<app>/server.js
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build --chown=node:node /repo/apps/${APP}/public ./apps/${APP}/public
USER node
EXPOSE ${APP_PORT}
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "exec node apps/${APP}/server.js"]
