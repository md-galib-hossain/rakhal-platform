# Rakhal Authentication And Authorization Flow Plan

## 1. System Overview

Rakhal is a production-grade SaaS multi-tenant dairy and farm management platform. Authentication, tenant access, authorization, subscription access, and audit logging must remain separate concerns so the backend can scale as a modular monolith today and be extracted into services later.

The authentication system must use:

- Short-lived JWT access tokens, default target: `15m`.
- Rotating refresh tokens, default target: `7d` to `30d`.
- HttpOnly, Secure, SameSite cookies for refresh-token transport.
- Argon2id for password hashing.
- Session records as device-level login state.
- Hashed refresh tokens only; raw refresh tokens must never be stored.
- Permission lookup from database or cache; permissions must not be embedded as an array in JWT payloads.

Current repository foundation:

- NestJS backend with Prisma ORM and PostgreSQL.
- Zod-based environment validation exists in `src/core/config/env`.
- Helmet is already wired in `src/main.ts`.
- Modular Prisma schema folders already exist under `prisma/schemas`.
- Auth, farm, permission, subscription, and audit Prisma models already exist as separate schema files.

## 2. Core Auth Boundaries

Rakhal must keep these flows independent:

| Concern | Responsibility | Must Not Do |
| --- | --- | --- |
| Authentication | Verify user identity and issue tokens | Decide business permissions |
| Session management | Track device/session lifecycle | Store raw refresh tokens |
| Tenant access | Validate user membership in a farm | Trust `farmId` from frontend |
| Authorization | Resolve Role -> Permission -> Feature access | Hardcode role names |
| Subscription access | Validate enabled plan features and limits | Put subscription data in JWT |
| Audit logging | Record security and business-sensitive actions | Block critical auth flow if non-critical logging fails |

## 3. Required Access Token Payload

Access tokens must be short-lived and minimal:

```json
{
  "sub": "userId",
  "sessionId": "sessionId",
  "farmId": "farmId",
  "permissionsVersion": 1
}
```

Do not include:

- Full user object.
- Permission arrays.
- Role names as authorization source.
- Subscription plan or feature data.
- Refresh token identifiers.

## 4. Authentication Flow

```text
Client
  -> POST /auth/login
  -> AuthController validates DTO only
  -> AuthService validates credentials
  -> PasswordService verifies Argon2id hash
  -> SessionService creates device session
  -> TokenService creates access token and refresh token
  -> RefreshTokenService hashes refresh token and persists it
  -> AuditService records LOGIN
  -> Response returns access token body/header strategy and sets refresh cookie
```

Security decisions:

- Password comparison must use Argon2id.
- Failed login counters and lockout checks must be handled before session creation.
- Suspicious login detection should compare IP, user agent, device name, and login history.
- Refresh token must be set through an HttpOnly cookie with `Secure` enabled in production and an explicit SameSite policy.

## 5. Refresh Rotation Flow

```text
Client
  -> POST /auth/refresh with HttpOnly refresh cookie
  -> AuthController validates request boundary only
  -> RefreshTokenService hashes incoming token
  -> Validate token exists, is not revoked, not expired
  -> Validate linked session is ACTIVE and not expired
  -> Validate token belongs to current token family
  -> Revoke old refresh token
  -> Create new refresh token in same family with parentTokenId
  -> Issue new access token
  -> Set new HttpOnly refresh cookie
  -> Audit successful refresh when needed
```

Refresh-token reuse detection:

```text
Incoming refresh token is already revoked or already rotated
  -> Treat as token reuse
  -> Mark session COMPROMISED
  -> Revoke token family
  -> Clear refresh cookie
  -> Audit SUSPICIOUS_ACTIVITY
  -> Reject request
```

Why this matters:

- A stolen refresh token becomes detectable after the legitimate user rotates it.
- Token-family revocation limits blast radius to one device session.
- Session status gives operations and users a clear logout/revoke model.

## 6. Session Management

Sessions represent devices. The existing Prisma `Session` model already supports:

- `status`: `ACTIVE`, `REVOKED`, `EXPIRED`, `COMPROMISED`.
- `ipAddress`.
- `userAgent`.
- `deviceName`.
- `expiresAt`.
- `lastUsedAt`.
- `createdAt` and `updatedAt`.

Required session operations:

- Login creates one active session per device login.
- Refresh updates `lastUsedAt`.
- Logout current session revokes only the current session and current refresh-token family.
- Logout all sessions revokes every active session for the user.
- Suspicious refresh reuse marks the session `COMPROMISED`.
- Expired sessions must not be accepted even if the access token signature is valid.

## 7. Protected Request Lifecycle

Every protected farm-scoped request must pass this chain:

```text
Request
  -> Helmet and global platform middleware
  -> Request context middleware
  -> Access token authentication guard
  -> Session validation guard
  -> Farm membership guard
  -> Subscription feature guard
  -> Permission guard
  -> Controller
  -> Service
  -> Repository/Prisma
```

Important rule:

The controller must not perform auth, membership, subscription, or permission logic. Controllers receive the request, validate DTOs, call services, and return responses.

## 8. Farm Isolation Design

Rakhal must never trust `farmId` from the frontend by itself.

Accepted farm context sources:

- Current route parameter, for farm-scoped routes.
- Explicit farm selection during login/session creation, only after validating membership.
- Current active farm from a controlled server-side decision.

Required validation:

```text
Given userId and farmId:
  -> Farm must exist and not be deleted
  -> Farm status must allow access
  -> FarmMember must exist for userId + farmId
  -> FarmMember roleId must resolve to permissions through RolePermission
```

All farm-owned domain services must receive a verified farm context. They must not query tenant data using only user-supplied IDs.

## 9. RBAC Design

Authorization must use:

```text
User
  -> FarmMember
  -> Role
  -> RolePermission
  -> Permission
```

Role names are labels, not enforcement logic. Enforcement must check permission keys resolved from the permission graph.

Expected permission evaluation:

```text
Can user perform action?
  -> Validate session
  -> Validate farm membership
  -> Resolve membership role
  -> Resolve role permissions
  -> Compare requested permission key
  -> Validate subscription feature if action is feature gated
```

Permission cache rule:

- Cache permission decisions or permission sets by `userId`, `farmId`, and `permissionsVersion`.
- Invalidate cache when role assignments, role permissions, membership, or `permissionsVersion` changes.
- Never store the permission array inside JWT.

## 10. Subscription Feature Gates

Subscription checks must be separate from permissions.

Example:

```text
Permission says: user can access analytics.
Subscription says: farm plan includes analytics.
Access allowed only if both are true.
```

Required checks:

- Active farm subscription exists.
- Subscription status allows access, for example `ACTIVE` or `TRIALING`.
- Requested feature key exists and is enabled through `SubscriptionFeature`.
- Plan limits are enforced in write paths, such as member count or cattle count.

## 11. Database Schema Explanation

Existing model groups:

- `auth`: `User`, `Session`, `RefreshToken`, `AuthToken`, `OAuthAccount`, `UserMFA`.
- `farm`: `Farm`, `FarmMember`.
- `permission`: `Role`, `Permission`, `RolePermission`.
- `subscription`: `SubscriptionPlan`, `Feature`, `SubscriptionFeature`, `FarmSubscription`.
- `audit`: `AuditLog`.

Schema hardening tasks before implementation:

- Run `pnpm prisma:format` and `pnpm prisma:validate`.
- Verify relation names between `Farm`, `Role`, and `FarmSubscription`.
- Verify inverse relations from `User` to farm ownership and invitations.
- Confirm all foreign keys have indexes.
- Add `updatedAt` and soft-delete fields where the domain requires lifecycle tracking.
- Add uniqueness constraints where needed, such as role names per farm if required by product rules.

This should be verified against official NestJS/Prisma documentation before applying schema changes.

## 12. Proposed Auth Module Structure

```text
src/modules/auth/
  auth.module.ts
  auth.controller.ts
  application/
    auth.service.ts
    session.service.ts
    refresh-token.service.ts
    password.service.ts
    token.service.ts
  domain/
    auth-token-payload.type.ts
    authenticated-user.type.ts
    auth-cookie-options.ts
  dto/
    login.dto.ts
    register.dto.ts
    refresh-token.dto.ts
    logout.dto.ts
  guards/
    jwt-auth.guard.ts
    session.guard.ts
  strategies/
    access-token.strategy.ts
  repositories/
    auth.repository.ts
```

Suggested supporting modules:

```text
src/modules/tenant-access/
  tenant-access.service.ts
  farm-membership.guard.ts

src/modules/permission/
  permission.service.ts
  permission.guard.ts
  decorators/require-permission.decorator.ts

src/modules/subscription/
  subscription-access.service.ts
  subscription-feature.guard.ts
  decorators/require-feature.decorator.ts

src/modules/audit/
  audit.service.ts
```

## 13. Middleware And Guards Flow

```text
Public auth endpoints:
  RequestContextMiddleware
  LoggerMiddleware
  RateLimitGuard
  CsrfGuard where applicable
  Controller
  AuthService

Protected non-farm endpoint:
  RequestContextMiddleware
  LoggerMiddleware
  JwtAuthGuard
  SessionGuard
  Controller
  Service

Protected farm endpoint:
  RequestContextMiddleware
  LoggerMiddleware
  JwtAuthGuard
  SessionGuard
  FarmMembershipGuard
  SubscriptionFeatureGuard
  PermissionGuard
  Controller
  Service
```

## 14. Environment Variables

Existing env names include:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `DATABASE_URL`

Required auth env hardening:

- Replace `BCRYPT_SALT_ROUNDS` with Argon2-specific configuration or remove it if unused.
- Add cookie domain/name settings.
- Add CSRF cookie/header names.
- Add refresh cookie SameSite setting.
- Add rate-limit settings.
- Add account lockout settings.

## 15. Redis Usage

Redis should be used for:

- Rate limiting login and refresh endpoints.
- Permission and subscription access cache.
- Session denylist or short-lived revocation cache if needed.
- CSRF token state if the selected CSRF design requires server-side state.

Redis must not be the only source of truth for sessions or refresh-token rotation. PostgreSQL session and refresh-token records remain authoritative.

## 16. Audit Logging

Audit events must include:

- Login success and failure.
- Logout current session.
- Logout all sessions.
- Refresh-token reuse detection.
- Session revoked.
- Password changed.
- Password reset requested/completed.
- Email verification.
- Farm membership changes.
- Role and permission changes.
- Subscription changes.
- Suspicious activity.

Audit logging should capture:

- `actorUserId` when known.
- `farmId` when farm-scoped.
- action.
- entity type and entity ID.
- IP address.
- user agent.
- metadata without secrets or raw tokens.

## 17. API Surface Plan

Initial endpoints:

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Create local user and initial verification token | Public with rate limit |
| `POST` | `/auth/login` | Verify credentials and create session | Public with rate limit |
| `POST` | `/auth/refresh` | Rotate refresh token and issue access token | Refresh cookie |
| `POST` | `/auth/logout` | Revoke current session | Access token |
| `POST` | `/auth/logout-all` | Revoke all user sessions | Access token |
| `GET` | `/auth/sessions` | List user sessions/devices | Access token |
| `DELETE` | `/auth/sessions/:sessionId` | Revoke one session | Access token |
| `GET` | `/auth/me` | Return current user and available farm contexts | Access token |

Farm-scoped endpoints must validate membership before domain service execution.

## 18. Production Security Notes

- Use Argon2id for password hashes.
- Store refresh-token hashes only.
- Use refresh-token rotation and token-family reuse detection.
- Use HttpOnly cookies for refresh tokens.
- Use CSRF protection for cookie-authenticated refresh/logout flows.
- Keep access tokens short-lived.
- Use strong independent access and refresh secrets.
- Enforce account lockout and rate limiting.
- Avoid detailed login failure messages.
- Do not log passwords, raw tokens, verification tokens, reset tokens, or MFA secrets.
- Treat `permissionsVersion` as cache invalidation metadata, not authorization truth.
- Validate session status on protected requests.
- Validate farm membership on every protected farm request.
- Validate subscription separately from permissions.

## 19. Future Scalability

The design keeps future extraction paths clear:

- Auth service can be extracted around `User`, `Session`, `RefreshToken`, and auth token workflows.
- Authorization service can be extracted around Role -> Permission evaluation.
- Subscription service can be extracted around plan, feature, and entitlement checks.
- Audit service can be moved to async events once transactional guarantees are defined.
- Farm tenant access remains a shared contract that all future services must enforce.

## 20. Definition Of Done For Auth Architecture

The authentication and authorization system is architecture-complete when:

- Login issues a short-lived access token and secure refresh cookie.
- Refresh rotation revokes old tokens and detects reuse.
- Sessions can be listed, revoked individually, and revoked globally.
- Protected requests validate active session state.
- Farm-scoped requests validate membership.
- Permission checks resolve through Role -> Permission.
- Subscription feature checks are independent and enforced.
- Audit logs capture sensitive auth and access events.
- Tests cover login, refresh, reuse detection, logout, farm isolation, permissions, and subscription gating.
- Documentation and environment examples match the implemented behavior.
