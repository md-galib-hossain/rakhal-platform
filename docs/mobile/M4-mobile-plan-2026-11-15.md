# Rakhal mobile: requirements, reuse, stack, monorepo fit, work packages (M4 plan)

Status: **plan only, for owner review.** No app code, no scaffold, no lockfile, no `apps/web` or `packages/ui` change.
Date: 2026-11-15. Base: `main` at `5cf39b06`.

Legend: **[V]** verified by reading the cited file or running a read-only command in this session. **[A]** assumption or
inference; the work package that depends on it has a verify-first step.

"M4" here is the label of this plan request. It is **not** the migration milestone M4 (`docs/migration/README.md:49`,
"Generate API types ... into `@rakhal/admin-api-client` and a consumer client"); that milestone is one input (WP4 below).

---

## 0. Findings that change the brief

1. **`apps/mobile` already exists on `main`. The "never started" premise is wrong.** [V] Commits `f418a8cf` (WP1+WP2 foundation) and
   `fb4aff7a`..`3a87127e` (WP3 core component kit, C1-C10) are in history. `apps/mobile/package.json`: `@rakhal/mobile`, Expo `~58.0.23`,
   React Native `0.88.1`, React `19.3.0`, `expo-router ~58.0.30`, `jest-expo`. Last recorded tests: 217 node + 404 Jest
   (`docs/mobile/ux-brand-plan.md`, "WP3 status"). No auth, API client, navigation tabs or offline layer yet.
2. **The earlier mobile work packages are in `docs/mobile/`**: `ux-brand-plan.md` (WP1-WP6 plan, owner decisions, status logs),
   `wp2-scaffold-spec.md`, `wp3-component-spec.md`. This plan **continues that numbering**: WP1-WP3 are done; new packages start at WP4.
3. **RAKHAL-490 is not a mobile ticket.** [V] `D:\Projects\Rakhal\docs\IN_FLIGHT.md:52`: "RAKHAL-490 (MILESTONE 31 Wave 6: remove dead
   backend surface, BREAKING ...)" on reproduction/cattle old routes. The only earlier mobile tickets in the docs are **RAKHAL-258**
   (Flutter `Repos/rakhal-app`, superseded by ADR-005) and RAKHAL-005/064/073/108 (below).
4. **The `/sync/push` and `/sync/pull` routes in the API doc do not exist in `apps/api`.** [V] `Rakhal_API.md` section 20 documents
   them, but `apps/api/openapi/customer-api.json` (378 paths) has no `/sync/*` path and no sync controller exists under
   `apps/api/src`. Offline sync is a **backend build**, not a client-only task.
5. **A direct-API mobile client cannot refresh tokens today.** [V] The refresh token only ever travels in an httpOnly cookie and refresh
   is CSRF-guarded (2.2). It needs a small backend change or a cookie workaround before WP5.
6. **Login identity (owner decision D1, revised 2026-11-15).** [V] Today `LoginDto` is `email` + `password` (min 8) and `User.email` is required and unique;
   there is no `username` column. PRD 5.2 / 23.4 describe phone + password and a 4-digit worker PIN. **Owner decision (final for now):** everyone who uses
   Rakhal has an email, and there is no SMS provider, so **no phone number and no PIN login for now**. Users sign in with **email or username + password**.
   Phone numbers for all users are a later phase once an SMS provider is integrated. The phone/PIN design is kept in 2.4 as **deferred**, not deleted.
   An earlier answer the same day asking for phone + PIN first is superseded.

---

## 1. Mobile requirements that exist (quoted)

### 1.1 PRD (`D:\Projects\Rakhal\docs\Rakhal_PRD_v3_Complete.md`)

| Where | Quote | Implication |
|---|---|---|
| line 5 | "**Platform:** Web App (primary) + Mobile App (iOS & Android)" | both stores eventually (D3) |
| line 85 | "Mobile-first: The app must work on Android phones, offline, by workers with limited literacy." | Android first |
| 105-107 | Manager "Web + Mobile"; Worker "Mobile (offline-capable) ... Milk logging, task completion, sickness reporting" | worker is the primary mobile persona |
| 187-193 (3.3) | "Local database: SQLite ... Sync queue ... processed in chronological order ... Server wins for reference data; latest timestamp wins for user entries; conflicts flagged for review ... Last 30 days of data always available offline." | offline architecture |
| 294-298 (5.2) | "Session duration 24 hours web / 7 days mobile"; "Stays logged in unless manually logged out"; "On Duty toggle" | long-lived mobile session |
| 344-352 (6.3) | "Bottom Tab Bar: Home (Dashboard) \| Cattle \| Milk \| Tasks \| More" | navigation |
| 811-818 (10.3) | "vertical list of cards ... big number input ... one session at a time ... Works offline ... Anomaly auto-flags" | milk quick entry |
| 2129-2182 (23) | "Offline-first ... Bangla ... Android 8+ with 2GB RAM ... Minimum 48px hit areas ... Minimal typing"; "Duplicate prevention: same cow + same session + same date -> warn user on sync"; "Biometric unlock"; quick sickness report (QR, photo); task completion | MVP screens and rules |
| 1868, 1948 | "Push (Firebase Cloud Messaging) ... primary mobile channel ... Built (RAKHAL-098)"; "clients call `POST /notifications/devices` after login to register their push (FCM) token, and `DELETE /notifications/devices` on logout" | push contract is live |

### 1.2 Other project docs

| File | Quote | Note |
|---|---|---|
| `Rakhal_API.md:5242-5330` (section 20) | `POST /sync/push` `{device_id, actions:[{local_id, action_type, queued_at, payload}]}` -> `{processed, results[{local_id,status,server_id}], conflicts[]}`; `GET /sync/pull?since=&scope=cattle,tasks,medicines,sheds` -> `{pulled_at, ..., deleted_ids}` | paper contract only (finding 4) |
| `Rakhal_API.md:219` | "Worker login with phone + 4-digit PIN (mobile workers)." | not in `customer-api.json` |
| `DECISIONS.md:46-50` (ADR-007) | "React Native. Local SQLite holds last 30 days of reference data + an action queue ... Conflict resolution: server wins for reference data, latest-timestamp wins for user entries, conflicts flagged." "Offline correctness is the highest-risk area (RAKHAL-108). Duplicate prevention ... and idempotent server handlers required." | decision of record |
| `PROJECT_PROGRESS.md:306-318` RAKHAL-005 | "bottom tab nav ... Local SQLite DB scaffold + action queue table ... pending sync counter ... Android 8+, 2GB RAM"; "Sync logic itself is RAKHAL-108." | `TODO` |
| `PROJECT_PROGRESS.md:1005-1013` RAKHAL-064 | "Vertical card list; one session at a time; big number inputs ... Works offline ... 'Submit Session' per shed" | `TODO` |
| `PROJECT_PROGRESS.md:2539-2550` RAKHAL-108 | "Push queued actions chronologically; pull deltas; 30-day scope ... Duplicate prevention (same cow+session+date warns)" | `TODO` |
| `PROJECT_PROGRESS.md:2528-2536` RAKHAL-107 | `User.preferredLanguage` default BN; `PATCH /auth/me/language` | backend i18n done |
| `CURRENT_STATE.md:1094` | "the mobile FCM token registration hook to `POST /notifications/devices` ... push is live" | frontend task |
| `CURRENT_STATE.md:1068` | "mobile offline-sync (now unblocked - a Flutter app was scaffolded ...)" | stale: Flutter superseded |
| `TECH_DEBT.md:182` | "Offline sync conflict resolution (RAKHAL-108) - any simplification ... (e.g., last-write-wins without flagging) is debt against PRD 23.3." | no silent last-write-wins |
| `IN_FLIGHT.md:1036` RAKHAL-258 | Flutter boilerplate; "AuthInterceptor = single-flight refresh on 401 + retry-once" | superseded; the interceptor pattern is worth copying |

### 1.3 Monorepo docs (`D:\Projects\rakhal-platform\docs`)

- `decisions/ADR-005-mobile-app-in-monorepo.md`: status **proposed**. App born in monorepo; Expo current stable, React pinned per app;
  source-exported packages; `@rakhal/ui` not shared; "**Offline sync gets its own ADR before any offline screen**"; "Auth is direct-to-API
  with tokens in `expo-secure-store` and client-side refresh. There is no BFF cookie layer"; native builds on EAS, not turbo; "No device
  builds on PRs". Sign-off on decisions 4 and 5 was pending.
- `migration/06-mobile-track.md`: steps X0-X4, gates, and "Firebase service-account key under `D:\Projects\Rakhal\conf` rotated and moved to
  EAS secrets before any push work".
- `mobile/ux-brand-plan.md`: P0/P1/P2 UX principles (48dp targets, sync state always visible, Bangla-first, undo over confirm), owner decisions
  (Inter + Noto Sans Bengali, dark label on `#00a86b`), WP1-WP3 status. Its section 4 listed WP4 nav shell, WP5 milk log, WP6 feeding + cattle; this
  plan re-cuts them into smaller PRs and inserts the missing contract/auth/sync work in front.

**Gaps (no doc answers them):** store/iOS timing; offline scope beyond milk and sickness report; worker PIN login design; app identity
(bundle id, EAS project, store accounts).

---

## 2. What is reusable from the monorepo

### 2.1 Contracts and types

| Asset | State | Use for mobile |
|---|---|---|
| `apps/api/openapi/customer-api.json` | [V] OpenAPI 3.0.0, 378 paths, `bearer` scheme, committed; `apps/api` scripts `gen:openapi` and `gen:openapi:check` | **source of truth** for generated types |
| `packages/api-client` | [V] **does not exist.** Only `packages/admin-api-client` (hand-written envelope/error types; README defers generation) | create it (WP4); mobile is its first consumer. `apps/web` depends only on `@rakhal/ui` and has its own `lib/api/{client,envelope,errors}.ts` |
| Response envelope | [V] `{ success, data, meta }` (web `lib/api/envelope.ts`) | one shared `ApiEnvelope`/`ApiError` in `api-client` |
| `@rakhal/domain` | [V] pure TS, zero deps, no `Intl`: money (`৳`, lakh), number, date, digits, locale; 225 tests | already used by mobile; the shared pure-logic home |

DTO facts for the first slices [V, `customer-api.json`]: `SaveMilkLogDto {date, session: MORNING|NOON|EVENING|NIGHT, entries[{cattleId, yieldL 0-100, tankId?, anomalyNote?, editReason?}]}`;
`SubmitMilkDto {date, session}`; `RegisterDeviceDto {token(10-4096), platform: android|ios|web, provider?: "fcm"}`; `FeedGridConfirmCowDto {offered_kg, refusal_kg, cost_tk}`;
`MilkLogTableRowDto` carries `avgYield7d`, `prevDayYieldL`, `withholding`, `log.{morningL..nightL, submittedSessions, tankLocked}`. Milk-log save has no idempotency key in its schema; whether
(cattle, date, session) is a server upsert: **[V]** in WP7 (see ADR-006): it is, and a different body silently overwrites, so WP8a adds a version check.

### 2.2 Auth flow: web (BFF) vs a direct-API mobile client

Verified in `apps/api/src/modules/auth/presentation/controllers/auth.controller.ts`, `application/services/{auth,csrf}.service.ts`, `apps/web/lib/auth/refresh-core.ts`.

| Aspect | Web today | Direct mobile client | Gap |
|---|---|---|---|
| Login | `POST /auth/login {email, password, farmId?}` via a Next route handler | same route; accepts email **or** username + password (D1, section 2.4). No phone/PIN yet | username lookup (WP5b) |
| Response | `{accessToken, sessionId, user, farmId, needsFarm, farms}`; **refresh token only as httpOnly cookie** | must hold the refresh token | **blocker**: not in body |
| Refresh | `POST /auth/refresh {farmId}`; controller reads the token **only from the cookie**; `RefreshTokenDto.refreshToken` exists but is ignored | needs body/header token | **blocker** |
| CSRF | `CsrfGuard` on refresh, logout, logout-all, change-password. Double-submit cookie, session id = SHA-256 of the refresh cookie. Web BFF calls `GET /auth/csrf` with the refresh cookie before every refresh and never caches the token | CSRF protects ambient-cookie browsers; a bearer/body-token client has none | backend should skip it for non-cookie clients |
| Farm context | access token carries `farmId`; `needsFarm` when 0 farms; 2+ farms returns `farms[]`; switch = `POST /auth/refresh {farmId}` with a membership check | same; **no `farmId` in bodies** (ADR-005 #6) | none |
| Device info | login reads `x-device-name` into the session | send `X-Device-Name` so `GET/DELETE /auth/sessions` is readable | none |
| Throttle | login `ThrottleAuth`; refresh 10/min | single-flight refresh (RAKHAL-258 pattern) | none |
| Session length | PRD 7 days mobile; workers indefinite | server TTL is config | **D2** |

**Closing the refresh gap**

- **(a) Backend ticket, recommended.** For `X-Client: mobile` (or any request without the refresh cookie): return `refreshToken` in login/refresh bodies, accept it
  in the `/auth/refresh` body, skip `CsrfGuard` when authentication is by bearer/body token. Small, testable (`auth.service.spec.ts`, e2e); browser behaviour unchanged.
- **(b) Client-only workaround.** Read `Set-Cookie` on login, store `rakhal_refresh` in SecureStore, replay the web BFF dance (CSRF fetch with the cookie, both
  cookies on refresh). [A] RN `fetch` handles `Set-Cookie` inconsistently across platforms and its native cookie jar can inject stale cookies: brittle; spike fallback only.

### 2.4 Login by email or username (now) and phone + worker PIN (deferred): backend design

**Current decision (supersedes the earlier phone-first answer):** sign in with **email or username + password**. Email stays required and unique, so there is **no nullable-email
change**, no placeholder emails and no `FarmInvitation` rework: every worker has an email and is invited as today.

**Username login (WP5b), proposal.**
- Add `User.username String?` (unique, stored lowercase, 3-32 chars `[a-z0-9._-]`, no `@`). One additive nullable column; no backfill; existing email users unaffected.
- `POST /auth/login` keeps its route and response; the body accepts `identifier` (email or username, told apart by `@`) alongside the legacy `email` field, plus `password` and optional `farmId`.
  Same `ThrottleAuth`, same per-user lockout counters (`failedLoginAttempts`, `lockedUntil`), same argon2 verification. A username is only another lookup key, so no new secret type.
- Enumeration-safe: unknown identifier and wrong password return the same status and body, and a dummy argon2 verify keeps timing alike.
- Who sets a username (S4, S9): the user in profile or at invitation acceptance; uniqueness is **global, case-insensitive** (per-farm names would force a farm code onto the login form).
  A manager can rename or clear a worker's username. Adds `PATCH /auth/me/username` (authenticated) and a username field on invite acceptance; reserved words rejected.
- RBAC and farm context unchanged: the token carries `farmId`; role comes from `FarmMember`; no `farmId` or role in any body; multi-farm users still pick via `POST /auth/refresh {farmId}`.
- Mobile login screen: one identifier field (email or username) + password; biometric unlock stays a local gate on the stored refresh token.

**Deferred: phone + worker PIN (needs an SMS provider; MimSMS is deferred).** The design below is kept for when phone numbers are added for all users. It is **not part of WP5**;
revisit S1, S2, S3, S5 and S7 then. Do not build `phone`, `pinHash`, `UserDevice` or `team.manage_pins` now.


*(Deferred section: applies only when phone login is added.)* Plan only; nothing here is built. Every number marked **(proposal)** is a sub-decision (section 6). Existing mechanisms reused [V]: per-user
lockout (`User.failedLoginAttempts`, `lastFailedLoginAt`, `lockedUntil`; env `AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS`, `_WINDOW_SECONDS` default 900, `_DURATION_SECONDS`),
`@ThrottleAuth()` rate limiting, argon2 password hashing (`PasswordService`), `Session` (has `deviceName`) + rotating `RefreshToken`, `permissionsVersion`, OTP challenge
model (`otp-challenge.prisma`, email-delivered today; SMS provider MimSMS deferred), `FarmMember {farmId, userId, roleId}` with `@@unique([farmId, userId])`.

**Identity model (proposal).** A worker is still a `User` (so sessions, refresh tokens, `FarmMember`, RBAC and audit work unchanged), not a new principal type.
- Add to `User`: `phone String?` (E.164, normalised, e.g. `+8801XXXXXXXXX`), `username String?`, `pinHash String?`, `pinSetAt`, `pinMustChange Boolean`,
  `loginMethods` implied by which of `email`/`phone`/`username` + hashes are set. Make `email` **nullable** (still unique when present). Postgres allows multiple NULLs under
  a unique index, so no placeholder emails are needed; code that assumes `email` non-null (login, invitations, transactional email, audit) must be audited (WP5b verify-first).
- Uniqueness: `phone` globally unique (a phone number is one person; E.164 normalisation is the dedupe key). `username` uniqueness scope is **S4**: globally unique is simplest and
  avoids a farm-picker before login; per-farm unique (`@@unique([farmId, username])` on a membership-level credential) keeps names short ("rahim") but then login must carry a farm code.
  Recommendation: **global, case-insensitive, 3-32 chars `[a-z0-9._-]`**, because per-farm names force workers to type a farm code on a phone.
- A phone number maps to **one user, many farms**: the login response keeps today's contract (`farmId` / `needsFarm` / `farms[]`), and the farm is chosen exactly as for email
  users (`POST /auth/refresh {farmId}` with the server-side membership check). The **role is never in the request**: it comes from `FarmMember.roleId` for the chosen farm.

**Who creates workers and issues or resets PINs (S3, recommendation).** Only a farm **owner/manager with a user-management permission** (new permission key, e.g. `team.manage_pins`)
creates a worker: name, phone, role, optional username. The server generates a random **one-time PIN** shown once to the manager (and delivered by SMS when MimSMS lands);
the worker must change it at first login (`pinMustChange`). Reset = manager action, issues a new one-time PIN, revokes all of that worker's sessions and refresh tokens,
bumps `permissionsVersion`, writes an audit row. There is **no self-service PIN reset by SMS in v1** (needs the SMS provider and a phone-ownership proof; revisit after MimSMS).
The invitation flow stays email-only; a new "create worker" endpoint replaces it for email-less workers (no invitation token is needed because the manager hands over the credential).

**PIN security (the core risk: a 4-digit PIN has only 10,000 values).**
1. **Never a stand-alone credential from the open internet.** PIN login always requires the **phone number** (identifies one user) and is attempt-limited **per user** and **per IP + device**.
2. **Hashing:** argon2id with a per-PIN salt plus a server-side **pepper** (HMAC key in env/secret manager, not in the DB). A DB leak alone then cannot brute-force 10,000 PINs offline;
   without the pepper the hashes are not testable. Pepper rotation = re-issue PINs (documented). This is the main reason PINs must not be stored with a fast hash.
3. **Lockout (S2, proposal):** 5 consecutive failures (matches PRD 5.2 "5 failed attempts -> 15 minute lockout") then 15 min lock, escalating (15 min, 1 h, 24 h) on repeated lockouts;
   after **10 failures in 24 h** the PIN is disabled until a manager reset. Counters are separate from the password counters (a PIN lock must not lock the owner's email login, and the
   reverse) so add `pinFailedAttempts`, `pinLockedUntil`, `pinLastFailedAt`, or a small `LoginAttempt` table keyed by (userId, method).
4. **Rate limits:** per-IP and per-phone throttles stricter than email login (proposal: 5 req/min per phone, 20/min per IP) using the existing `@ThrottleAuth()` plumbing plus a Redis counter;
   uniform error and timing for "unknown phone" vs "wrong PIN" to avoid account enumeration; a dummy argon2 verify on unknown phones.
5. **Device binding (S5, recommendation: bind after first login, enforce for PIN only).** First successful PIN login on a device registers a **device id** (random UUID generated by the
   app, stored in SecureStore) against the `Session`. PIN login from an **unknown** device requires the manager-issued one-time PIN or an owner-approved device (a manager taps "approve
   device" in the web app); known devices skip the extra step. This turns "someone guessed the PIN" into "someone guessed the PIN **and** holds an enrolled phone". Cost: a new
   `UserDevice` table (`userId, deviceId, label, approvedBy, approvedAt, revokedAt`), reusing the FCM `devices` row if one exists.
6. **PIN policy:** length per **S1** (proposal 6 digits instead of PRD's 4: 1,000,000 values moves brute force from trivial to impractical under lockout; 4 digits is acceptable only with
   device binding and the 10-failure disable). Reject trivial PINs (0000, 1234, repeated, phone suffix). PINs are never logged and never in URLs.
7. **Biometric unlock (PRD 23.4)** is a **local** gate on the stored refresh token (`expo-local-authentication`), not a server credential; it does not weaken the lockout.
8. **Audit and alerts:** write auth events (PIN set, reset, locked, new device) to the existing audit log; notify the manager on repeated lockouts of a worker.

**Optional username + password.** Same table and password hashing as email users (`passwordHash`, existing 8-char minimum and lockout counters). Username is only another lookup key, so no new
secret type. It is **disabled unless enabled per account** by the manager (so a worker with only a PIN has no password to guess). No security delta beyond the username uniqueness scope (S4) and enumeration-safe errors.

**Session and refresh interplay with D2.** PIN, username and email logins all end in the same `Session` + rotating `RefreshToken`, so WP5a (refresh token in the body for `X-Client: mobile`, no CSRF for
non-cookie clients) applies unchanged and **must land first**. PRD 5.2 says workers "stay logged in indefinitely": that is a long **refresh-token lifetime plus sliding rotation**, never a
long-lived access token (keep the short access TTL). Suggested (S6): workers 30-90 days sliding, owners/managers 7 days; revocation (PIN reset, manager "log out device", `logout-all`,
`permissionsVersion` bump) invalidates immediately. Reuse of a rotated refresh token keeps today's `markReuse` behaviour (revoke the family).

**RBAC and farm-context token.** Unchanged principles: the access token carries `farmId` (+ `permissionsVersion`); `FarmContextGuard` resolves permissions from `FarmMember.role` per request; **no
`farmId` or role in any body**. A worker with one farm is auto-scoped at login (as email users today); with two or more, `farms[]` is returned and the app calls `/auth/refresh {farmId}`.
A removed membership or changed role takes effect on the next request through the `permissionsVersion` check; PIN reset and role change both bump it. `GET /auth/me` keeps returning the
permission flags the mobile `PermissionGate` reads.

**DB and migration impact (Prisma, `apps/api/prisma/schemas/auth`).** One additive migration: `User.phone` (nullable, unique), `User.username` (nullable, unique, citext or lowercase check),
`User.pinHash` + PIN counters, `User.email` -> nullable, optional `UserDevice` table. Backfill: none required (all new columns nullable); existing email users unaffected. Risks to verify first
(WP5b): code paths and DB constraints that assume `email` is present (login lookup, `findUserByEmail`, mail jobs, billing/referral identity, admin console, seeds `seed-test-accounts.ts`), the
`support.prisma` note that phone-identity matching is deferred (trial-abuse checks currently cannot use phone), and the `phoneVerifiedAt` coupon gate (a manager-created worker phone is
**unverified** until an OTP proves ownership; PIN login does not require verification because the manager vouches for the number). Rollback: columns are additive; re-making `email`
non-null is blocked once an email-less worker exists, so the nullable change is the one hard-to-reverse step and ships in its own migration PR.

**API surface (`customer-api`, `/api/v1`, no `farmId` in bodies).** Proposed, to be generated into `@rakhal/api-client` (WP4) once built:
- `POST /auth/login/phone {phone, pin, deviceId, deviceName?}` -> same response shape as `/auth/login` (+ `refreshToken` in body for `X-Client: mobile`).
- `POST /auth/login/username {username, password, deviceId?}` (optional method; same response).
- `POST /auth/pin/change {currentPin, newPin}` (authenticated; clears `pinMustChange`).
- `POST /team/members` (create worker: `name, phone, roleId, username?` -> one-time PIN in the response, once) and `POST /team/members/{userId}/pin-reset`, `POST /team/members/{userId}/devices/{deviceId}/approve|revoke`,
  `GET /team/members/{userId}/devices` (farm in the token, permission `team.manage_pins`).
- Existing `GET /auth/sessions`, `DELETE /auth/sessions/{id}` stay the "log out that phone" path.
Whether these extend `LoginDto` with a discriminated union or stay separate routes is part of S8 (separate routes recommended: clearer throttles, OpenAPI and per-method lockout).

### 2.3 Shared non-UI logic (candidates)

Already shared: `@rakhal/domain`. Create or move others **only when a second consumer exists** (ADR-005 #4).

| Candidate | Today [V] | Verdict |
|---|---|---|
| `ApiEnvelope`, `ApiError`, `NetworkError` | `apps/web/lib/api/{envelope,errors}.ts`, `packages/admin-api-client` | into `@rakhal/api-client` (WP4); web adoption after m3 finishes |
| zod form schemas | `apps/web/features/*/schemas.ts` (28 files import zod) | **not now**: extraction edits `apps/web`; revisit as `@rakhal/validation` after m3 (D10) |
| date/money helpers | `apps/web/lib/{local-date,format}.ts` vs `@rakhal/domain` | check parity before duplicating |
| milk anomaly rule (">30% below average", PRD 23.2) | server sets `anomalyFlag` | tiny pure fn in `@rakhal/domain` only if WP10 needs it offline |
| feed DM/CP/ME maths | server (`/feed/requirements`, `/feed/cattle/{id}/dmi`) | **do not port**; display server results |
| permission flags (`<Can I=...>`) | web components | read flags from `GET /auth/me`; mobile `PermissionGate` (WP3 deferred) |

---

## 3. Proposed stack, trade-offs, recommendation

Already decided and built (keep): Expo SDK 58.0.23, RN 0.88.1, React 19.3.0 (exact, per-app), Expo Router, `jest-expo` + RNTL for components and `node --test` for
pure TS, hand-written Intl-free i18n (`bn` default, Latin digits default), Inter + Noto Sans Bengali, AsyncStorage for prefs, zero-dependency component kit.

| Concern | Options | Recommendation and why |
|---|---|---|
| Router | Expo Router (built) vs React Navigation | **Expo Router**; `(tabs)` group per PRD 6.3, auth gate via root layout redirect |
| Server state | TanStack Query v5 vs SWR vs hand-rolled | **TanStack Query v5**: RN-proven, `onlineManager` + NetInfo, paused mutations. For online-only surfaces (dashboard, notifications) |
| Offline store | (A) Query persistence on AsyncStorage; (B) `expo-sqlite` + hand-written outbox + delta pull; (C) WatermelonDB; (D) PowerSync / ElectricSQL / RxDB | **(B)**. PRD 3.3 and ADR-007 already say SQLite + action queue. (A) cannot search 500 animals by tag in < 300 ms nor hold a durable, ordered, transactional queue. (C) forces its own sync protocol that does not match `/sync`. (D) adds replication infra and recurring cost (cost rule: ask scale first). `expo-sqlite` runs in Expo Go |
| Sync rules | last-write-wins vs PRD rules | **PRD rules, flagged**: outbox rows `local_id` (UUID), `queued_at`, status `pending/sending/failed/conflict`; push in order; per-record glyph (saved / waiting / failed); pull by `since` cursor, 30-day window for cattle, sheds, tasks, milk-log days; apply `deleted_ids`; server wins reference data; duplicate cow+session+date is warned, never silently overwritten. Writes the server cannot dedupe are **online-only** until the backend lands. Design is **ADR-006** (before any offline screen) |
| Connectivity | NetInfo flag vs flag + probe | **both**: `@react-native-community/netinfo` (SDK pin 12.0.1) + cheap `GET /health` probe with backoff. States: no network / server unreachable / session expired |
| Token storage | `expo-secure-store` vs AsyncStorage vs MMKV | **`expo-secure-store`** (SDK pin `~58.0.2`) for the refresh token; access token in memory only; biometric unlock via `expo-local-authentication` (PRD 23.4) |
| HTTP | `fetch` wrapper vs axios/ky | **native `fetch` wrapper** in `api-client`: single-flight 401 refresh, retry-once, timeout/abort, `X-Device-Name`; no new dependency |
| Forms | RHF + zod vs controlled | **controlled state + small validators** for 3-4 field forms; revisit RHF if forms grow |
| Lists | FlatList vs FlashList | FlatList with tuned windows; FlashList only if the 500-animal test fails |
| i18n | keep custom vs i18next | **keep custom** (`src/i18n`, `LocaleProvider`); add `PATCH /auth/me/language` sync. Hermes `Intl` stays unused |
| Push | (1) native FCM token via `expo-notifications` `getDevicePushTokenAsync`; (2) Expo Push Service | **(1)**: `RegisterDeviceDto.provider` accepts only `fcm`; Expo push tokens are not FCM tokens and would need a new backend provider. Needs Firebase project, `google-services.json` via EAS secrets (APNs key for iOS) and a **dev client / EAS build** (Android remote push does not work in Expo Go). Register after login, `DELETE` on logout |
| Camera/photos | `expo-image-picker` / `expo-camera` | defer to the sickness-report slice; `POST /cattle/{id}/photo`, `GET /media/{id}/url` exist |
| Animation | Reanimated + Gesture Handler | defer; add on concrete need |
| Builds | EAS vs local | **EAS** for dev client and releases, never on PRs (ADR-005 #7); cost question D4 |
| Monitoring | Sentry | open (D5) |

---

## 4. Monorepo fit

### 4.1 State today [V]

- pnpm 11.9.0 workspace (`apps/*`, `packages/*`), isolated layout, root `.npmrc` = `auto-install-peers=true`, no `node-linker=hoisted`, **no** custom `metro.config.js`/`babel.config.js`
  (WP2 decision D5; Android Metro export OK in the WP2 review). `@rakhal/domain` is source-exported.
- React: admin 19.2.4, mobile 19.3.0 exact (`react-native@0.88.1` needs `^19.3.0`); isolated per importer, no root React.
- `turbo.json` tasks `build`, `lint`, `typecheck`, `test`, `dev`. Mobile has no `build` script, so turbo's build skips it; native builds never enter turbo.
- CI: `ci.yml` runs `turbo lint typecheck test` and `build` with `--filter='!@rakhal/web' --filter='!@rakhal/api'`, so **mobile is already verified in `ci.yml`** (Node 24) on every PR, not path-filtered.
  `web.yml` and `visual.yml` trigger on `apps/web/**`, **`packages/**`**, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json` and their own files.

### 4.2 `mobile.yml` and avoiding the web visual gate

1. **New `.github/workflows/mobile.yml`**, path-filtered to `apps/mobile/**`, `packages/{domain,api-client,config}/**`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
   `turbo.json`, itself. Jobs: (1) `turbo run lint typecheck test --filter=@rakhal/mobile...`; (2) bundle smoke `expo export --platform android` plus `expo-doctor` (both
   **not yet run** per the WP2 log). No EAS and no emulator on PRs.
2. **Remove mobile from `ci.yml`** by adding `--filter='!@rakhal/mobile'` to its two turbo lines, the same carve-out already used for web and api.
3. **Visual gate collisions.** `visual.yml` (30 min budget, builds base and head web) fires on any `packages/**` or lockfile change, so a mobile PR touching `packages/domain`,
   `packages/api-client` or the lockfile runs Web + Visual with no web risk. Mitigations:
   - Narrow `web.yml`/`visual.yml` `packages/**` to what web consumes (`packages/ui/**`, `packages/config/**`; web depends only on `@rakhal/ui`). This edits **m3-owned workflows**: a
     coordination item for WP4 after m3-wave1 is idle, **not part of this PR**.
   - The lockfile cannot be path-narrowed: accept that dependency bumps run Web and a zero-diff Visual. `visual.yml` already cancels superseded runs.
   - Optional [A]: `pnpm install --filter @rakhal/web...` in the visual job so RN dependencies are not installed there; verify frozen-lockfile behaviour first.
4. **Lockfile is the hot shared file** (mobile and m3 web PRs both change it). On conflict take `main`'s and re-run `pnpm install`; never hand-merge; land dependency-adding mobile PRs one at a time.
5. **Boundary rules.** `packages/config/eslint.mjs` restricts imports and raw `fetch`; mobile relaxes only `no-restricted-syntax`. WP4 adds a test that fails if `apps/mobile` imports `@rakhal/ui`.
6. **Node** is `>=24` in mobile/domain, `>=20.9` at root, 24 in CI. Record in the mobile README.
7. **Open WP2 items:** ignored `@parcel/watcher` build script (confirm Metro watch on Windows), clean-clone `pnpm install --frozen-lockfile`, `expo-doctor`.

---

## 5. Phased work packages (WP4 onward)

One PR each. Backend packages are claimed in the backend `IN_FLIGHT.md` first and land in `apps/api` (source of truth; `Repos/rakhal-backend` is frozen).
Mapping: WP1-WP3 = `ux-brand-plan.md` WP1-WP3 (done); X1 = WP2 (done); X2 = WP4-WP6 (backend WP5a-WP5b precedes the mobile login WP5d); X3 = WP7-WP9; X4 = WP10.

| # | Package | Depends | Scope | Acceptance criteria |
|---|---|---|---|---|
| **WP4** (built, this PR: package, drift check, mobile dependency; `mobile.yml` and `ci.yml` carve-out left for a follow-up) | `packages/api-client` + drift check | - | `openapi-typescript` over `apps/api/openapi/customer-api.json` into a source-exported `packages/api-client` (types + `ApiEnvelope`/`ApiError`); CI drift check; mobile adds `workspace:*`; `@rakhal/ui` boundary test; `mobile.yml` and the `ci.yml` carve-out (4.2) | `typecheck` green; changing a DTO in `apps/api` without regenerating fails CI; mobile imports a path type (`SaveMilkLogDto`); `apps/web`, `packages/ui` untouched; Android bundle smoke passes |
| **WP5a** (backend, built) | Mobile-safe refresh | - | `apps/api`: `X-Client: mobile` returns `refreshToken` in login/refresh bodies, accepted in the `/auth/refresh` body, `CsrfGuard` skipped without a refresh cookie; browser behaviour identical | new unit + e2e pass; existing web login/refresh e2e unchanged; reuse detection (`markReuse`) still fires; `gen:openapi:check` green |
| **WP5b** (backend, built; manager rename and invite-time username deferred) | Username login | WP5a | `apps/api`: `User.username` migration (additive, nullable, unique lowercase); `POST /auth/login` accepts `identifier` (email or username) + legacy `email`; `PATCH /auth/me/username`; username on invite acceptance; reuse lockout and throttles; seeds updated | migration applies and rolls back on a copy of the dev DB; existing email login e2e unchanged; e2e: username login works, case-insensitive, unknown identifier and wrong password indistinguishable, 5 failures lock like email login, duplicate username rejected, `@` in username rejected; no `farmId` in any body; `gen:openapi:check` green |
| **WP5c** (built; biometric gate deferred) | Auth client + token store | WP4, WP5a | `fetch` wrapper, SecureStore refresh token, in-memory access token, `AuthProvider`, forced logout on 401/revoked, `X-Device-Name`, biometric unlock gate | 10 parallel 401s cause 1 refresh; reuse -> logout; cold start restores the shell offline; no token in AsyncStorage or logs; no `farmId` in any body |
| **WP5d** (built; biometric unlock deferred) | Login + farm switch screens | WP5b, WP5c | one identifier (email or username) + password screen; `needsFarm` and multi-farm picker via `POST /auth/refresh {farmId}`; language sync | seeded owner, manager and worker log in on an emulator with email and with username; worker sees no manager-only action; wrong password, lockout, offline each show a distinct plain message; Bangla + English complete |
| **WP6** (built; icons and SyncStatusPill deferred) | Navigation shell | WP5d | `(tabs)` Home, Cattle, Milk, Tasks, More from one permission-gated config; header with farm name + language; `PermissionGate` | relaunch restores last tab; Android back never exits mid-form without draft prompt; shell renders offline; tab targets >= 48dp |
| **WP7** (written: `docs/decisions/ADR-006-offline-sync.md`, proposed, awaits owner acceptance) | ADR-006 offline sync + backend ticket | - | Doc PR: outbox schema, ids, ordering, conflict rules (PRD 3.3, TECH_DEBT:182), 30-day scope, per-entity offline matrix, idempotency header vs `/sync/*`, verify milk-log upsert behaviour | owner accepts ADR; every queueable write names its server dedupe key; "online-only for now" list explicit |
| **WP8a** (backend; built, see ADR-006 implementation notes) | Sync / idempotency | WP7 | `apps/api` (D7 decided: **per-route `Idempotency-Key`**, no `/sync/*`; see ADR-006 section 3 and 6): shared idempotency helper with request hash (422 on reuse) and 35-day expiry; key on milk-log save, milk submit, `POST /health/cases`, task complete (already-completed returns 200 `alreadyCompleted`); milk-log per-entry `baseUpdatedAt` check returning `conflicts[]`; `MilkLogEntry.updatedBy` | per-route e2e: replay returns the same result with one row; duplicate returns `conflicts[]`; no cross-farm key reuse; OpenAPI + client regenerated |
| **WP8b** (built; see ADR-006 implementation notes) | Offline foundation | WP6, WP8a | `expo-sqlite` schema + migrations, outbox, NetInfo + `/health` probe, pull of cattle/sheds/tasks (30 days), `SyncStatusPill` + sheet ("3 pending"), backoff | queue survives kill and reboot; order preserved; backoff does not hammer 2G; v1->v2 migration test; failed writes never dropped silently |
| **WP9** (built; see `docs/mobile/device-testing.md` section 7) | Cattle list + detail (read) | WP6, WP8b | `GET /cattle`, `/cattle/{id}/overview`, `/profile`; local search; status badge (icon + text + colour); read-only offline with "last updated" | tag search < 300 ms on a seeded 500-animal farm, mid-range Android profile; skeleton/empty/error/stale states; role-gated actions; both themes and locales |
| **WP10** (built, PR #86) | Milk log entry (first offline slice) | WP8b, WP9 | session chips from `PATCH /settings/modules/milk-sessions` config + clock default, `/sheds` filter, cow cards with ghost value (`prevDayYieldL`, `avgYield7d`), `StepperField`, `POST /milk/log` queued, `POST /milk/submit`, anomaly icon, 5 s undo | works in airplane mode and syncs on reconnect; each row saved/waiting/failed; double-tap and replay make one entry; `withholding` cows blocked; p50 <= 10 s per animal in a 3-user pass [A target]; no secrets in logs |
| **WP11** | Feed grid confirm | WP9 | `GET /feed/grid`, `POST /feed/grid/draft`, `POST /feed/grid/confirm` (one-tap "as planned", `refusal_kg`); **online-only** unless WP7 says otherwise | server cost totals shown; failed confirm keeps the draft; no horizontal-scroll table; nutrient values displayed, never computed on device |
| **WP12** | Tasks + notifications + push | WP6 | `GET /tasks`, `POST /tasks/{id}/complete`, `GET /notifications`, `POST /notifications/{id}/read`, `read-all`; FCM register/remove via `/notifications/devices` | first EAS dev client; token registered after login, removed on logout; test push opens the right screen; task complete queued offline; Firebase key from EAS secrets (X0 rotation done) |
| **WP13** | Hardening + release | WP10-WP12 | EAS profiles, app identity, Sentry (D5), TalkBack pass, device pass for WP3's unverified list, 200% font scale, release checklist | every WP3 "Device-unverified" item recorded pass/fail with evidence; Android 8 / 2 GB cold start measured |

**First MVP:** WP4-WP6 (login, farm switch, shell) then WP7-WP10 (cattle list, offline milk log), then WP11 (feed grid confirm) and WP12 (tasks/notifications). Sickness report (PRD 23.2) is the next slice and reuses the WP8b outbox.

MVP route inventory [V, `customer-api.json`]: `auth/{login,refresh,logout,me,me/language,sessions}`; `farms`; `cattle`, `cattle/{id}/{overview,profile,photo}`; `sheds`;
`settings/modules/milk-sessions`; `milk/{log,submit,overview,anomalies,availability}`; `feed/{grid,grid/draft,grid/confirm,today-requirement}`; `tasks`, `tasks/{id}/complete`;
`notifications`, `notifications/devices`, `notifications/{id}/read`, `notifications/read-all`. (All paths are under `/api/v1`.)

---

## 6. Open decisions for the owner

1. **D1 Login identity: RESOLVED, revised (2026-11-15).** Owner: everyone has an email and there is no SMS provider yet, so no phone number for now; users log in with **email or username + password**. Phone numbers for all users come later with an SMS provider. (An earlier answer asking for phone + worker PIN first is superseded.)
2. **D2 Refresh change (open; every mobile login depends on it, see 2.2) and session length.** Approve WP5a (refresh token in the body for `X-Client: mobile`, no CSRF for non-cookie clients) and a 7-day or longer mobile session (PRD 23.4).
3. **D3 Platforms and identity.** Android only first, or iOS too? Bundle id/package name, EAS project, Play and Apple accounts. (Windows cannot run iOS locally.)
4. **D4 EAS cost and scale.** Is the free tier enough for dev builds? Answer before WP12 (cost rule).
5. **D5 Monitoring.** Sentry for mobile now or in WP13?
6. **D6 Offline scope.** Confirm queueable writes for v1: milk log, sickness report, task complete. Is online-only acceptable for feed-grid confirm (it deducts stock and cost)?
7. **D7 Backend sync shape.** Per-route `Idempotency-Key` (smaller, matches finance/reports) or the documented `/sync/push` + `/sync/pull` (one engine, larger backend change)? **Decided 2026-11-15 by the owner: per-route `Idempotency-Key`** (ADR-006).
8. **D8 Firebase.** Who owns the Firebase project, and confirm the untracked service-account key under `D:\Projects\Rakhal\conf` is rotated into EAS secrets before WP12.
9. **D9 Carried-over WP3 items** awaiting owner confirmation (`wp3-component-spec.md` section 7: icons, haptics, number pad, toast, undo), Bangla copy proofread, lime accent token, light logo/icon/splash, `@rakhal/tokens` (Q4).
10. **D10 `@rakhal/validation` timing.** Extract shared zod schemas after m3 web work finishes, or keep schemas separate per app?

---

### Sub-decisions created by D1 (S1-S9)

Active now: **S4** (username scope), **S6** (worker session length) and **S9** (username format and ownership). **S8** is settled for now: extend `POST /auth/login` with `identifier`. S1, S2, S3, S5 and S7 are **deferred** with phone/PIN.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| S1 | PIN length | 4 (PRD) / 6 | 6 digits; 4 only with device binding and the 10-failure disable |
| S2 | Lockout policy | PRD 5 fails/15 min only / escalating + disable after 10 in 24 h | escalating (15 min, 1 h, 24 h), disable after 10 in 24 h, manager reset |
| S3 | PIN reset ownership | manager / owner only / self-service SMS | manager with `team.manage_pins`; no SMS self-service until MimSMS exists |
| S4 | Username uniqueness scope | global / per farm (+ farm code) | global, case-insensitive; per-farm forces a farm code on a phone |
| S5 | Device binding | none / bind and approve unknown devices / bind always | bind; unknown device needs manager approval or a fresh one-time PIN |
| S6 | Worker session length | 7 d / 30-90 d sliding / indefinite | 30-90 d sliding refresh, short access token, instant revoke on reset or role change |
| S7 | Phone verification for workers | require OTP / manager-vouched | manager-vouched; phone stays unverified until an OTP is available (keeps `phoneVerifiedAt` coupon gate meaning intact) |
| S8 | Route shape | extend `LoginDto` / separate routes per method | now: extend `POST /auth/login` with `identifier`; revisit when PIN is added |
| S9 | Username format and ownership | self-chosen / manager-assigned / both | both: user sets it, manager can rename or clear; 3-32 chars `[a-z0-9._-]`, lowercase, no `@`, reserved words blocked |

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Backend `/sync` does not exist; offline slice blocked | WP7/WP8a explicit; an online-only milk entry can ship behind a flag first (ux-brand-plan WP5 note) |
| 2 | Refresh/CSRF design blocks every authenticated screen | WP5a first; fallback (b) spike is time-boxed |
| 2b | Username enumeration / credential stuffing | identical errors and timing for unknown identifier vs wrong password; existing throttles and per-user lockout; username never shown in public responses |
| 3 | Lockfile and `packages/**` churn triggers web/visual CI and conflicts with m3 | 4.2 items 3-4; one dependency PR at a time; narrow workflow paths after m3 idles |
| 4 | Sync conflicts corrupt farm data | ADR-006 before code; no silent last-write-wins; server is source of truth for finance and stock |
| 5 | WP3 kit has never run on a device | WP13 device pass; WP6 and WP10 PRs must include an emulator run, not only Jest |
| 6 | Two React minors coexist (19.2.x web/admin, 19.3.0 mobile) | per-app pins, isolated pnpm layout (verified in WP2); no root React |
