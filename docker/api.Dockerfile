# syntax=docker/dockerfile:1.7
# @rakhal/api — NestJS + Prisma 7. Build context: repo root.
#   docker build -f docker/api.Dockerfile --target runtime  -t rakhal-api .
#   docker build -f docker/api.Dockerfile --target migrator -t rakhal-api-migrator .

ARG NODE_VERSION=22

# ---- base: glibc (argon2, sharp and Prisma engines need it; no alpine) ----
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@11.9.0 --activate
WORKDIR /repo

# ---- build: install, prisma generate, nest build ----
FROM base AS build
# Toolchain lives only in this stage, in case argon2 has no prebuilt binary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
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
    pnpm install --frozen-lockfile --filter @rakhal/api...
COPY apps/api apps/api
WORKDIR /repo/apps/api
# generate/build never connect to the DB; the URL only has to exist for prisma.config.ts.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm prisma:generate && pnpm build

# ---- migrator: one-shot `prisma migrate deploy` (prisma CLI is a devDependency) ----
FROM build AS migrator
ENV NODE_ENV=production
CMD ["pnpm", "exec", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"]

# ---- prod-deps: drop devDependencies, keep the generated Prisma client ----
FROM build AS prod-deps
RUN pnpm prune --prod

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=5005
COPY --from=prod-deps --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist /repo/apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json /repo/apps/api/package.json
WORKDIR /repo/apps/api
USER node
EXPOSE 5005
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
