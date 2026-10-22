# Rakhal Platform (admin monorepo)

Internal Rakhal admin panel. The admin API lives in `rakhal-backend` (`src/modules/admin`), not here.

## Layout
- `apps/admin` - Next 16 admin frontend (port 3010)
- `packages/ui` - generic UI primitives + base tokens (copied from rakhal-consumer-frontend @ 9af1681)
- `packages/admin-api-client` - typed admin API envelope/client
- `packages/config` - shared tsconfig + ESLint boundary rules
- `docs/` - architecture, decisions, operations, migration

## Commands
```
pnpm install
pnpm dev          # admin on http://localhost:3010
pnpm lint | typecheck | test | build
```

Workspace packages export TypeScript source and are consumed through `transpilePackages`; there is no `dist` step.
Plan: see `docs/architecture/roadmap.md`.
