# Auth Usage Guide

## Purpose
This guide explains practical auth scenarios in this codebase: what to call, what happens internally, and what is cached in Redis.

## Auth Module at a Glance
- Presentation:
  - `src/modules/auth/presentation/controllers/auth.controller.ts`
  - Guards: JWT, session, CSRF
- Application:
  - `src/modules/auth/application/services/auth.service.ts`
  - Supporting services: password, token, session, refresh token, csrf, permissions-version cache
- Infrastructure:
  - `src/modules/auth/infrastructure/persistence/repositories/auth.repository.ts`
- Domain:
  - Auth payload/context types
  - Auth domain event: `auth.user.registered`
  - Password events:
    - `auth.password.reset_requested`
    - `auth.password.reset_successful`
    - `auth.password.changed`

## Scenario 1: User Registration
### API
- Endpoint: `POST /auth/register`
- DTO: `RegisterDto` (`email`, `name`, `password`)

### What Happens
1. Controller calls `AuthService.register(...)`.
2. Password is hashed (`PasswordService`).
3. User is created (`AuthRepository.createUser`).
4. Event emitted: `USER_REGISTERED_EVENT` (`auth.user.registered`).
5. Email listener receives event and queues verification email.

### Why It Matters
- Registration and email sending are decoupled via domain event.
- No direct email provider calls from auth flow.

## Scenario 2: Login
### API
- Endpoint: `POST /auth/login`
- DTO: `LoginDto` (`email`, `password`, `farmId`)

### What Happens
1. Controller calls `AuthService.loginWithContext(...)`.
2. User lookup by email.
3. Account lock/block checks.
4. Password verification.
5. Session + refresh token are created in DB.
6. Access token is signed.
7. Refresh cookie is set in response.
8. Permissions version is cached in Redis.

### Outputs
- Response body: `accessToken`, `sessionId`, `user`
- Cookie: refresh token cookie

## Scenario 3: Refresh Token Rotation
### API
- Endpoint: `POST /auth/refresh`
- DTO: `RefreshTokenDto` (`farmId`, optional `refreshToken`)
- Guarded by CSRF

### What Happens
1. Refresh token is read from cookie.
2. Token hash is matched in DB.
3. Session/token validity checks run.
4. Old refresh token is revoked.
5. New refresh token is created (rotation).
6. New access token is issued.
7. Permissions version cache is updated.
8. New refresh cookie is written.

### Reuse/Compromise Path
- If token/session is invalid or reused:
  - Session can be marked compromised.
  - Token family is revoked.
  - Unauthorized is returned.

## Scenario 4: Session-Guarded Requests (`/auth/me`, `/auth/sessions`, etc.)
### Guards
- `JwtAuthGuard` -> validates JWT
- `SessionGuard` -> validates DB session state + permission version freshness

### What Happens in `SessionGuard`
1. Reads JWT payload.
2. Fetches session from DB.
3. Verifies session status/expiry and user status.
4. Reads permissions version cache in Redis.
5. Syncs Redis if missing/outdated.
6. Rejects request if token permissionsVersion is stale.
7. Attaches `request.auth` context for downstream use.

## Scenario 5: Logout (Current Session / All Sessions)
### APIs
- `POST /auth/logout`
- `POST /auth/logout-all`

### What Happens
- Current session:
  - Session is revoked in DB
  - Related tokens revoked
  - Permissions cache invalidated
  - Refresh cookie cleared
- All sessions:
  - All active sessions revoked
  - Related tokens revoked
  - Permissions cache invalidated
  - Refresh cookie cleared

## Scenario 6: Email Verification
### API
- Endpoint: `POST /auth/verify-email`
- DTO: `VerifyEmailDto` (`token`)

### What Happens
1. Auth service verifies token via repository transaction.
2. Token is marked used.
3. User `isEmailVerified` is set true.
4. Audit log emitted.

## Scenario 7: Forgot Password
### API
- Endpoint: `POST /auth/forgot-password`
- DTO: `ForgotPasswordDto` (`email`)

### What Happens
1. Controller calls `AuthService.forgotPassword(email)`.
2. User lookup is performed by email.
3. If user exists:
  - secure reset token is generated
  - token is hashed and stored as `AuthToken` with type `PASSWORD_RESET`
  - token expiry is set (current implementation: 30 minutes)
  - event emitted: `auth.password.reset_requested`
4. Password reset email is queued by email listener.
5. Response is always success (`{ success: true }`) regardless of account existence.

### Security Notes
- No user-enumeration leak in API response.
- Raw reset token is not persisted in DB (hash only).

## Scenario 8: Reset Password
### API
- Endpoint: `POST /auth/reset-password`
- DTO: `ResetPasswordDto` (`token`, `newPassword`)

### What Happens
1. Controller calls `AuthService.resetPassword(...)`.
2. Incoming token is hashed and matched in DB.
3. Token validity checks happen in repository query:
  - type is `PASSWORD_RESET`
  - not used
  - not expired
4. New password is hashed (`PasswordService`).
5. User password is updated.
6. Reset token is marked used (single-use).
7. Access is revoked globally:
  - all sessions revoked
  - refresh tokens revoked through session-revocation flow
  - permissions-version cache invalidated
  - permission cache invalidated
8. Event emitted: `auth.password.reset_successful`.

## Scenario 9: Change Password (Authenticated)
### API
- Endpoint: `POST /auth/change-password`
- DTO: `ChangePasswordDto` (`currentPassword`, `newPassword`)
- Guards: `ThrottlerGuard + CsrfGuard + JwtAuthGuard + SessionGuard`

### What Happens
1. Controller resolves authenticated user from `request.auth`.
2. `AuthService.changePassword(userId, ...)` loads current user.
3. Current password is verified via `PasswordService.verifyPassword`.
4. New password is hashed and persisted.
5. Access is revoked globally:
  - all sessions revoked
  - refresh tokens revoked through session-revocation flow
  - permissions-version cache invalidated
  - permission cache invalidated
6. Event emitted: `auth.password.changed`.

## Redis Cache Usage (Short Explanation)
Current auth-related Redis caching:

1. Permissions Version Cache
- Service: `PermissionsVersionCacheService`
- Key pattern: `auth:permissions-version:<userId>`
- Stores: latest numeric `permissionsVersion` for user
- Used by: `SessionGuard` and login/refresh flows
- Purpose: detect stale access tokens and reduce repeated DB checks for version state

2. Permission Resolution Cache (Permission Module)
- Key pattern: `auth:permissions:<userId>:<farmId>:<permissionsVersion>`
- Stores: resolved permission list (`string[]`) JSON
- TTL: short-lived (current code uses 300s)
- Purpose: speed up permission checks

3. Subscription Feature Cache (Subscription Module)
- Key pattern: `auth:subscription-features:<farmId>`
- Stores: enabled feature keys for active plan
- TTL: short-lived (current code uses 300s)
- Purpose: speed up feature-gate checks

## Example: Adding a New Auth-Protected Use Case
Suppose you add `POST /auth/change-password`.

1. Presentation
- Add DTO in `src/modules/auth/presentation/dto/`.
- Add route in `auth.controller.ts`.
- Protect route with `JwtAuthGuard` + `SessionGuard` (+ CSRF where needed).

2. Application
- Add method/use-case in `src/modules/auth/application/services/`.
- Accept application input type (not presentation DTO type).

3. Infrastructure
- Reuse `AuthRepository` for DB updates.

4. Cache + Security
- Invalidate permissions/session cache if auth state implications require it.
- Audit log action.

5. Behavior Safety
- Keep existing token/session semantics unchanged unless explicitly required.

## Quick Troubleshooting
- Unauthorized on protected route:
  - Check JWT validity, session status, permissionsVersion mismatch.
- Refresh failing:
  - Check refresh cookie presence, token reuse revocation path, CSRF header/cookie.
- Email verification not sending:
  - Check user-registered event emission and email listener registration.
- Forgot-password email not sent:
  - Check `auth.password.reset_requested` emission and password reset listener registration.
  - Check `EMAIL_PASSWORD_RESET_BASE_URL` / `EMAIL_VERIFICATION_BASE_URL` config.
- Reset password says invalid token:
  - Token may be expired, already used, or not found after hashing.
