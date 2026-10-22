# Rakhal Platform (admin monorepo)

Internal Rakhal admin panel. The admin API lives in `rakhal-backend` (`src/modules/admin`), not here.

## Layout
- `apps/admin` - Next 16 admin frontend (port 3010)
- `packages/ui` - generic UI primitives + base tokens (copied from rakhal-consumer-frontend @ 9af1681)
- `packages/admin-api-client` - typed admin API envelope/client
- `packages/config` - shared tsconfig + ESLint boundary rules
- `docs/` - architecture, decisions, operations, migration
  - Consumer-app migration plan (plan only, nothing executed): [`docs/migration/README.md`](docs/migration/README.md)

## Commands
```
pnpm install
pnpm dev          # admin on http://localhost:3010
pnpm lint | typecheck | test | build
```

## Admin sign-in (Phase 2)
`apps/admin` talks to the admin API in `rakhal-backend` through a same-origin BFF (`app/api/auth/*`); the browser never sees a token.
- Cookies (httpOnly, SameSite=Strict): `rk_admin_at` (access), `rk_admin_rt` (rotating refresh), `rk_admin_setup` (10-minute 2FA-setup token).
- `proxy.ts` sends signed-out visitors to `/login` and rotates the refresh token before the access token expires (single-flight, because replaying a rotated token revokes the session).
- Flow: sign in -> (first time) `/login/setup-2fa` -> sign in with a code -> (temporary password) `/change-password` -> app.
- Page gating (`PermissionGate`) and nav filtering are UX only; the backend enforces every permission.
- Config: `ADMIN_API_BASE_URL` (see `apps/admin/.env.example`). Backend side: `ADMIN_IP_ALLOWLIST` is matched against this server's address, not the human's, so keep the human-IP allowlist at nginx.

Workspace packages export TypeScript source and are consumed through `transpilePackages`; there is no `dist` step.
Plan: see `docs/architecture/roadmap.md`.
