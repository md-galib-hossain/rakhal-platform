# ADR-001: Admin API stays in rakhal-backend
Status: accepted. The backend already ships `src/modules/admin` (separate PlatformAdmin identity, JWT secret, TOTP, RBAC, audit).
A second app would need the same Prisma schema and create a second source of truth. The monorepo consumes the admin API through `@rakhal/admin-api-client`.
