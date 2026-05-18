# Rakhal Auth Implementation Stages

This file is the resumable implementation tracker for Rakhal authentication and authorization.

When a stage is completed, update its checkbox from `[ ]` to `[x]`, add the completion date, and write a short handoff note. Future work should start from the first unchecked stage unless the user explicitly requests a different stage.

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

## Current Stage Pointer

Current next stage: **Stage 4 - Registration, Password Hashing, And Email Token Foundation**

Last updated: 2026-05-18

## Stage 0 - Planning Documents

Status: `[x]`

Completed on: 2026-05-16

Goal:

Create architecture and implementation planning docs that preserve the required production-grade auth, authorization, tenant isolation, subscription access, and audit boundaries.

Deliverables:

- `[x]` Create `plan.md`.
- `[x]` Create `auth_implementation_stage.md`.
- `[x]` Document access-token payload rules.
- `[x]` Document refresh-token rotation and reuse detection.
- `[x]` Document protected request guard flow.
- `[x]` Document stage-by-stage implementation order.

Handoff notes:

- No application code was changed in this stage.
- Existing Prisma schemas were inspected and referenced by model names.
- Next stage must validate Prisma schema correctness before auth code is generated.

## Stage 1 - Schema Validation And Security Alignment

Status: `[x]`

Completed on: 2026-05-17

Goal:

Validate and harden the Prisma schema before implementing auth services. Auth implementation must not start on top of invalid or ambiguous relations.

Deliverables:

- `[x]` Run `pnpm prisma:format`.
- `[x]` Run `pnpm prisma:validate`.
- `[x]` Verify relation names for `Farm.roles` and `Role.farm`.
- `[x]` Verify relation names for `Farm.subscriptions` and `FarmSubscription.farm`.
- `[x]` Verify inverse user relations for farm ownership and invitations.
- `[x]` Verify indexes on all foreign-key columns.
- `[x]` Decide whether `RefreshToken.tokenHash` needs a unique index.
- `[x]` Decide whether `RefreshToken.parentTokenId` needs an index.
- `[x]` Decide whether `Role` requires a unique farm-scoped name constraint.
- `[x]` Add missing lifecycle fields only where the domain needs them.
- `[x]` Replace bcrypt-oriented env naming with Argon2-oriented config if password auth will be implemented now.

Security requirements:

- Refresh tokens remain hashed only.
- Session and refresh token models remain separate.
- Farm membership remains the tenant isolation source.
- Role names are not used for authorization decisions.

Verification:

- `[x]` Prisma format succeeds.
- `[x]` Prisma validate succeeds.
- `[x]` Generated Prisma Client succeeds if schema changes are made.

Handoff notes:

- Prisma relation names are now explicit on both sides for farm roles, farm subscriptions, role permissions, subscription features, audit logs, and farm ownership/invitations.
- Added missing inverse `User` relations for owned farms, farm memberships, and sent farm invitations.
- Added missing foreign-key indexes, made `RefreshToken.tokenHash` unique, indexed `RefreshToken.parentTokenId`, and added `@@unique([farmId, name])` for farm-scoped role names. Existing lifecycle fields were sufficient for this stage, so no extra lifecycle columns were added.
- Replaced bcrypt-oriented auth env config with Argon2 parameters: `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, and `ARGON2_PARALLELISM`.
- Verification passed with `pnpm.cmd prisma:format`, `pnpm.cmd prisma:validate`, and `pnpm.cmd prisma:generate`.

## Stage 2 - Dependency And Configuration Foundation

Status: `[x]`

Completed on: 2026-05-18

Goal:

Install and configure only the packages required for the selected implementation. Do not invent APIs or assume packages exist.

Expected dependency areas:

- JWT support for NestJS.
- Passport JWT strategy if the project chooses Passport-based guards.
- Argon2 password hashing.
- Cookie parsing.
- CSRF protection.
- Redis client or Nest-compatible Redis integration.
- Rate limiting.

Deliverables:

- `[x]` Confirm exact package names and APIs against installed package docs or official documentation before use.
- `[x]` Add auth-specific env validation for cookie names, cookie options, lockout policy, and rate limits.
- `[x]` Configure secure cookie defaults.
- `[x]` Configure rate-limit defaults.
- `[x]` Configure Redis connection provider.
- `[x]` Update `.env` example or README if present.

Security requirements:

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be independent and strong.
- Refresh cookie must be HttpOnly.
- Refresh cookie must be Secure in production.
- SameSite policy must be explicit.
- CSRF strategy must cover cookie-authenticated state-changing routes.

Verification:

- `[x]` `pnpm lint` succeeds.
- `[x]` `pnpm test` succeeds or failures are documented.
- `[x]` App boots with validated env.

Handoff notes:

- Installed Stage 2 dependencies: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/throttler`, `passport`, `passport-jwt`, `argon2`, `cookie-parser`, `csrf-csrf`, `redis`, and TypeScript types for cookie/passport packages.
- Added auth env validation and config for Argon2, refresh-cookie defaults, CSRF names/options/secret, global/login/refresh rate-limit defaults, and account lockout policy.
- Wired global JWT support, Nest throttler definitions, cookie parsing middleware, a lazy Redis client provider, and secure refresh/CSRF cookie option helpers.
- Updated README with a safe environment template because the repo does not have an `.env.example`.
- Fixed the stale `UsersModule` import path and test/Jest setup issues that blocked Stage 2 verification.
- Verification passed with `pnpm.cmd build`, `pnpm.cmd lint`, `pnpm.cmd test`, a built Nest application-context boot check, and an `argon2.hash` runtime check.

## Stage 3 - Auth Module Skeleton And Boundaries

Status: `[x]`

Completed on: 2026-05-18

Goal:

Create the auth module structure with clean boundaries. Controllers stay thin. Services own auth logic.

Deliverables:

- `[x]` Create `src/modules/auth/auth.module.ts`.
- `[x]` Create `src/modules/auth/auth.controller.ts`.
- `[x]` Create DTOs for register, login, refresh, logout, and session revocation.
- `[x]` Create `PasswordService`.
- `[x]` Create `TokenService`.
- `[x]` Create `SessionService`.
- `[x]` Create `RefreshTokenService`.
- `[x]` Create `AuthService`.
- `[x]` Create repository/data-access layer or clearly scoped Prisma access service.
- `[x]` Register module in `AppModule`.

Rules:

- Controllers only receive requests, validate DTOs, call services, and return responses.
- No business logic in controllers.
- No direct Prisma access from controllers.
- Auth services must be testable without HTTP context.

Verification:

- `[x]` Unit tests compile.
- `[x]` Auth module imports cleanly.
- `[x]` No circular dependency is introduced.

Handoff notes:

- Added `src/modules/auth` module skeleton with thin controller endpoints and application services (`AuthService`, `PasswordService`, `TokenService`, `SessionService`, `RefreshTokenService`) plus DTOs and domain payload/user types.
- Added `AuthRepository` as the auth-scoped Prisma data-access layer so controllers remain free from direct database access.
- Registered `AuthModule` in `AppModule`.
- Verification passed with `pnpm.cmd build` and `pnpm.cmd lint`; no test-coverage work was run per current instruction.

## Stage 4 - Registration, Password Hashing, And Email Token Foundation

Status: `[ ]`

Completed on:

Goal:

Implement local user registration with Argon2id password hashing and secure email verification token persistence.

Deliverables:

- `[ ]` Implement user registration service flow.
- `[ ]` Hash password with Argon2id.
- `[ ]` Create email verification `AuthToken` with hashed token.
- `[ ]` Avoid returning sensitive user fields.
- `[ ]` Add duplicate email handling.
- `[ ]` Add audit event for registration.

Security requirements:

- Never store raw passwords.
- Never store raw email verification tokens.
- Never leak whether an email exists in sensitive recovery flows.

Verification:

- `[ ]` Registration unit tests.
- `[ ]` Duplicate email test.
- `[ ]` Password hash persistence test.
- `[ ]` Raw token is not persisted.

Handoff notes:

- Add notes here after completion.

## Stage 5 - Login, Session Creation, And Access Token Issuing

Status: `[ ]`

Completed on:

Goal:

Implement credential login that creates a device session, issues a minimal access token, and sets a secure refresh cookie.

Deliverables:

- `[ ]` Validate credentials.
- `[ ]` Enforce blocked user and lockout checks.
- `[ ]` Track failed login attempts.
- `[ ]` Create `Session`.
- `[ ]` Create refresh token family.
- `[ ]` Hash and persist refresh token.
- `[ ]` Issue access token with only `sub`, `sessionId`, `farmId`, and `permissionsVersion`.
- `[ ]` Set HttpOnly secure refresh cookie.
- `[ ]` Add audit event for successful login.
- `[ ]` Add audit event or security event for suspicious login where applicable.

Security requirements:

- No permissions array in JWT.
- No subscription data in JWT.
- No raw refresh token in database or logs.
- Farm context must be selected only after membership validation.

Verification:

- `[ ]` Successful login test.
- `[ ]` Invalid password test.
- `[ ]` Blocked user test.
- `[ ]` Lockout test.
- `[ ]` Refresh token hash persistence test.
- `[ ]` JWT payload shape test.

Handoff notes:

- Add notes here after completion.

## Stage 6 - Refresh Rotation And Token Reuse Detection

Status: `[ ]`

Completed on:

Goal:

Implement secure refresh rotation with token-family reuse detection.

Deliverables:

- `[ ]` Read refresh token from HttpOnly cookie.
- `[ ]` Hash incoming refresh token for lookup/verification.
- `[ ]` Validate active session.
- `[ ]` Validate refresh token expiry.
- `[ ]` Revoke old refresh token during successful rotation.
- `[ ]` Create new refresh token linked by `parentTokenId`.
- `[ ]` Preserve `tokenFamily`.
- `[ ]` Issue new access token.
- `[ ]` Set new refresh cookie.
- `[ ]` Detect reuse of revoked/rotated token.
- `[ ]` Mark compromised session.
- `[ ]` Revoke token family on reuse.
- `[ ]` Audit suspicious activity.

Security requirements:

- Refresh endpoint must not accept refresh tokens from localStorage.
- Reuse detection must fail closed.
- Compromised sessions must not remain usable.

Verification:

- `[ ]` Refresh success test.
- `[ ]` Expired refresh token test.
- `[ ]` Revoked token test.
- `[ ]` Reuse detection test.
- `[ ]` Token family revocation test.
- `[ ]` Compromised session rejection test.

Handoff notes:

- Add notes here after completion.

## Stage 7 - Logout And Session Management

Status: `[ ]`

Completed on:

Goal:

Support logout current session, logout all sessions, session listing, and session revocation.

Deliverables:

- `[ ]` Implement logout current session.
- `[ ]` Implement logout all sessions.
- `[ ]` Implement list sessions.
- `[ ]` Implement revoke selected session.
- `[ ]` Clear refresh cookie on logout.
- `[ ]` Revoke refresh-token family when session is revoked.
- `[ ]` Audit session revocation.

Security requirements:

- Users may only manage their own sessions unless an explicit admin permission exists.
- Revoked sessions must fail protected request validation.

Verification:

- `[ ]` Logout current session test.
- `[ ]` Logout all sessions test.
- `[ ]` Session listing test.
- `[ ]` Session revocation authorization test.
- `[ ]` Revoked session guard rejection test.

Handoff notes:

- Add notes here after completion.

## Stage 8 - Authentication Guards And Request User Context

Status: `[ ]`

Completed on:

Goal:

Implement access-token authentication and active-session validation for protected routes.

Deliverables:

- `[ ]` Create JWT access-token guard or equivalent NestJS guard.
- `[ ]` Create session validation guard.
- `[ ]` Add typed authenticated request/user context.
- `[ ]` Validate `sessionId` from JWT against database session.
- `[ ]` Validate `permissionsVersion` cache behavior.
- `[ ]` Ensure expired, revoked, and compromised sessions are rejected.

Security requirements:

- Valid JWT signature alone is not enough.
- Session state must be checked.
- Deleted or blocked users must be rejected.

Verification:

- `[ ]` Missing token test.
- `[ ]` Invalid token test.
- `[ ]` Expired token test.
- `[ ]` Revoked session test.
- `[ ]` Blocked user test.

Handoff notes:

- Add notes here after completion.

## Stage 9 - Farm Membership And Tenant Isolation

Status: `[ ]`

Completed on:

Goal:

Enforce tenant isolation for every farm-scoped request.

Deliverables:

- `[ ]` Create tenant access service.
- `[ ]` Create farm membership guard.
- `[ ]` Validate farm exists and is accessible.
- `[ ]` Validate `FarmMember` exists for `userId + farmId`.
- `[ ]` Attach verified farm context to request.
- `[ ]` Reject cross-tenant access.
- `[ ]` Add tests for farm isolation.

Security requirements:

- Never trust `farmId` from frontend blindly.
- Never query farm-owned records before membership is verified.
- Archived, suspended, or deleted farms must follow explicit access rules.

Verification:

- `[ ]` User can access own farm.
- `[ ]` User cannot access another farm.
- `[ ]` Deleted farm rejected.
- `[ ]` Suspended/archived farm behavior tested according to product rule.

Handoff notes:

- Add notes here after completion.

## Stage 10 - Permission Authorization

Status: `[ ]`

Completed on:

Goal:

Implement permission-based authorization using Role -> Permission, not hardcoded role names.

Deliverables:

- `[ ]` Create permission service.
- `[ ]` Create permission guard.
- `[ ]` Create permission decorator or metadata mechanism.
- `[ ]` Resolve permissions through `FarmMember.roleId`.
- `[ ]` Add Redis cache for permission resolution if Redis foundation is ready.
- `[ ]` Invalidate permission cache when role or membership changes.

Security requirements:

- Do not hardcode role names such as `ADMIN`.
- Do not put permission arrays inside JWT.
- Permission checks require validated session and validated farm membership first.

Verification:

- `[ ]` Allowed permission test.
- `[ ]` Denied permission test.
- `[ ]` Farm-specific role test.
- `[ ]` Permission cache invalidation test if cache is implemented.

Handoff notes:

- Add notes here after completion.

## Stage 11 - Subscription Feature Gates

Status: `[ ]`

Completed on:

Goal:

Implement subscription entitlement checks independently from RBAC.

Deliverables:

- `[ ]` Create subscription access service.
- `[ ]` Create feature guard.
- `[ ]` Create feature decorator or metadata mechanism.
- `[ ]` Validate active or trialing farm subscription.
- `[ ]` Validate feature enabled for subscription plan.
- `[ ]` Enforce plan limits in write flows where applicable.
- `[ ]` Cache subscription feature access if Redis foundation is ready.

Security requirements:

- Permission does not bypass subscription.
- Subscription does not bypass permission.
- Subscription state must not be embedded in JWT.

Verification:

- `[ ]` Enabled feature test.
- `[ ]` Disabled feature test.
- `[ ]` Expired subscription test.
- `[ ]` Plan limit test where applicable.

Handoff notes:

- Add notes here after completion.

## Stage 12 - CSRF, Rate Limiting, And Cookie Hardening

Status: `[ ]`

Completed on:

Goal:

Harden browser-facing auth routes that rely on cookies.

Deliverables:

- `[ ]` Add CSRF protection for refresh/logout flows.
- `[ ]` Add rate limiting for login, register, refresh, password reset, and email verification.
- `[ ]` Add secure cookie helper.
- `[ ]` Ensure cookie clearing uses the same cookie path/domain settings used to set cookies.
- `[ ]` Validate CORS and credentials settings for frontend deployment.

Security requirements:

- Refresh cookie must be HttpOnly.
- Refresh cookie must be Secure in production.
- SameSite must be explicit.
- Login and refresh endpoints must be rate limited.

Verification:

- `[ ]` CSRF missing token test.
- `[ ]` CSRF valid token test.
- `[ ]` Rate limit test.
- `[ ]` Cookie options test.

Handoff notes:

- Add notes here after completion.

## Stage 13 - Audit Logging Integration

Status: `[ ]`

Completed on:

Goal:

Integrate audit logging across authentication, authorization-sensitive, tenant-sensitive, and subscription-sensitive events.

Deliverables:

- `[ ]` Create audit service if not implemented.
- `[ ]` Log login.
- `[ ]` Log logout.
- `[ ]` Log session revocation.
- `[ ]` Log password changes.
- `[ ]` Log refresh-token reuse detection.
- `[ ]` Log role and permission changes.
- `[ ]` Log farm membership changes.
- `[ ]` Log subscription changes.

Security requirements:

- Never log raw tokens.
- Never log passwords.
- Never log MFA secrets or backup codes.
- Keep audit metadata useful but sanitized.

Verification:

- `[ ]` Audit log creation tests.
- `[ ]` Sensitive data redaction tests.

Handoff notes:

- Add notes here after completion.

## Stage 14 - Testing Matrix And Security Regression Suite

Status: `[ ]`

Completed on:

Goal:

Add tests that prove the system rejects unsafe auth, tenant, permission, and subscription states.

Deliverables:

- `[ ]` Unit tests for auth services.
- `[ ]` Unit tests for token service.
- `[ ]` Unit tests for refresh rotation.
- `[ ]` Unit tests for permission service.
- `[ ]` Unit tests for subscription access service.
- `[ ]` Guard tests for auth/session/farm/permission/feature gates.
- `[ ]` E2E tests for login -> refresh -> protected request -> logout.
- `[ ]` E2E tests for cross-tenant rejection.
- `[ ]` E2E tests for refresh-token reuse detection.

Security requirements:

- Tests must cover failure paths, not only happy paths.
- Tests must assert JWT payload does not include permissions or subscription data.
- Tests must assert raw refresh tokens are not persisted.

Verification:

- `[ ]` `pnpm test` succeeds.
- `[ ]` `pnpm test:e2e` succeeds.
- `[ ]` `pnpm lint` succeeds.

Handoff notes:

- Add notes here after completion.

## Stage 15 - Documentation And Developer Onboarding

Status: `[ ]`

Completed on:

Goal:

Update project documentation so future developers can safely maintain the auth system.

Deliverables:

- `[ ]` Update README auth overview.
- `[ ]` Document auth request lifecycle.
- `[ ]` Document guard chain.
- `[ ]` Document env vars.
- `[ ]` Document Redis usage.
- `[ ]` Document audit logging.
- `[ ]` Document troubleshooting steps.
- `[ ]` Document security rules and gotchas.

Required README sections:

- System Overview.
- Authentication Flow.
- Authorization Flow.
- JWT Strategy.
- Refresh Rotation Flow.
- Session Management.
- RBAC Design.
- Farm Isolation Design.
- Subscription Feature Gates.
- Security Practices.
- Folder Structure.
- Database Schema Explanation.
- Middleware/Guards Flow.
- Environment Variables.
- Redis Usage.
- Audit Logging.
- Future Scalability.
- Production Security Notes.

Verification:

- `[ ]` Docs match implemented code.
- `[ ]` No docs claim a package, endpoint, or guard exists before it is implemented.
- `[ ]` Security limitations and future work are explicitly documented.

Handoff notes:

- Add notes here after completion.

## Resume Instructions For Future Codex Runs

Before starting new auth work:

1. Open this file.
2. Find `Current next stage`.
3. Confirm whether previous stage status and handoff notes are accurate.
4. Inspect current git status.
5. Continue from the first unchecked stage unless the user says otherwise.
6. After completing a stage, update this file immediately.
7. Do not mark a stage done unless implementation and verification are complete.

## Global Non-Negotiables For Every Stage

- Do not invent NestJS, Prisma, Redis, JWT, CSRF, or package APIs.
- Verify uncertain APIs against official documentation.
- Keep controllers thin.
- Keep auth logic in services.
- Use Argon2id for passwords.
- Use short-lived access tokens.
- Use rotating refresh tokens.
- Use HttpOnly secure cookies.
- Never store raw refresh tokens.
- Never trust frontend `farmId`.
- Always validate user farm membership.
- Never hardcode role names for authorization.
- Keep authentication, authorization, subscription, and tenant access separate.
- Never place permission arrays or subscription data inside JWT.
- Preserve modular monolith boundaries.
- Preserve future microservice extraction paths.
