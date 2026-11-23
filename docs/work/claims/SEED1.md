---
id: SEED1
title: "Seed: update backend seed for staging deployment (opt-in demo data, test accounts, env passwords, chart of accounts)"
agent: nexus
harness: antigravity
branch: main
status: done
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/api/prisma/seed.ts
  - apps/api/prisma/seed-test-accounts.ts
shared: []
depends_on: []
blocked_by: []
resolved: []
---

## Scope & Implementation Notes

Updated backend database seed scripts to support staging and production deployments:
1. **Environment-driven dataset gating**:
   - `SEED_DEMO_DATA=true|false` (default: false when `NODE_ENV=production` unless `STAGE=true`, true otherwise).
   - `SEED_TEST_ACCOUNTS=true|false` (default: true in development/staging, false in production unless opted in).
   - `SEED_PLATFORM_ADMIN=true|false` (default: false in pure production unless opted in).
2. **Configurable credentials with env overrides**:
   - `SEED_OWNER_EMAIL`, `SEED_OWNER_USERNAME`, `SEED_OWNER_PASSWORD`
   - `SEED_MANAGER_EMAIL`, `SEED_MANAGER_USERNAME`, `SEED_MANAGER_PASSWORD`
   - `SEED_WORKER_EMAIL`, `SEED_WORKER_USERNAME`, `SEED_WORKER_PASSWORD`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_TOTP_SECRET`
   - `SEED_TEST_ACCOUNTS_PASSWORD`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`
3. **Log security & masking**:
   - Sensitive environment-provided passwords masked as `<from env>` in output logs.
4. **Deterministic re-seeding & lockout recovery**:
   - On user upsert, re-asserts password and resets lockout state (`isBlocked: false`, `failedLoginAttempts: 0`, `lockedUntil: null`).
5. **Mobile & web username login support**:
   - Added `username` handles: `demo_owner`, `demo_manager`, `demo_worker`, `galib`, and `mahadi`.
6. **Chart of Accounts and Legal Consent bootstrap**:
   - In `seed-test-accounts.ts`, bootstrapped `DEFAULT_CHART_OF_ACCOUNTS` (`LedgerAccount`) and pre-accepted `legalDocument` consent for test users and farms.

## Verification

- `pnpm --filter @rakhal/api build`: 0 errors (Nest build successful).
- `pnpm seed` (development): passes completely (116 permissions, 3 roles, catalogues, demo data, test accounts).
- `NODE_ENV=production SEED_DEMO_DATA=false SEED_TEST_ACCOUNTS=false pnpm seed`: passes cleanly; catalogues seed, demo data and test accounts safely skip.
- `NODE_ENV=production STAGE=true SUPERADMIN_PASSWORD=... SEED_OWNER_PASSWORD=... pnpm seed`: passes cleanly; staging demo & test accounts run, passwords masked in logs.
- `node scripts/work.mjs check --no-network`: 39 claims, branch main, 0 errors, 0 warnings.
