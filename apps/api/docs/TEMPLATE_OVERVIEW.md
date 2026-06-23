# Rakhal Backend — Template Overview & Capability Map

> **Purpose.** A single, complete reference for the NestJS boilerplate we are building Rakhal on top of.
> It describes what already exists (architecture, auth, authorization, multi-tenancy, subscriptions,
> middleware, exceptions, config, Prisma, Redis, email + job queues, observability, health) and — critically —
> **what is NOT yet wired** so feature work against [`docs/PROJECT_PROGRESS.md`](../../../docs/PROJECT_PROGRESS.md)
> and [`docs/Rakhaal_API.md`](../../../docs/Rakhaal_API.md) doesn't trip over hidden assumptions.
>
> **Read order for a new agent:** this file → [`ARCHITECTURE.md`](ARCHITECTURE.md) → [`AUTH_USAGE.md`](AUTH_USAGE.md) →
> [`PermissionArcitecture.md`](PermissionArcitecture.md) → [`ERROR_FLOW_GUIDE.md`](ERROR_FLOW_GUIDE.md) → [`OBSERVABILITY_GUIDE.md`](OBSERVABILITY_GUIDE.md).
>
> **Last verified against code:** 2026-06-23.

---

## 1. Tech Stack at a Glance

| Concern | Choice | Package |
|--------|--------|---------|
| Framework | NestJS 11 | `@nestjs/common`, `@nestjs/core` |
| Language | TypeScript 5.7 (strict) | `typescript` |
| HTTP | Express | `@nestjs/platform-express` |
| Package manager | **pnpm** | — |
| ORM / DB | Prisma 7 + PostgreSQL (driver adapter `@prisma/adapter-pg`) | `@prisma/client`, `prisma` |
| Cache / KV | Redis (node-redis client) | `redis`, `ioredis` (for BullMQ) |
| Job queues | BullMQ (Redis-backed) | `@nestjs/bullmq`, `bullmq` |
| Auth tokens | JWT access + rotating refresh | `@nestjs/jwt`, `passport-jwt` |
| Password hashing | **Argon2id** | `argon2` |
| Rate limiting | Throttler (default/login/refresh) | `@nestjs/throttler` |
| CSRF | Double-submit cookie | `csrf-csrf` |
| Security headers | Helmet | `helmet` |
| Validation | class-validator + class-transformer (DTOs); zod (env) | `class-validator`, `zod` |
| Email | Resend or SMTP via provider factory | `resend` |
| PDF | pdfkit (email attachments / reports) | `pdfkit` |
| Logging | Pino (structured) | `nestjs-pino`, `pino-http` |
| Metrics | Prometheus | `prom-client` |
| Error tracking | Sentry | `@sentry/node` |
| Scheduling | `@nestjs/schedule` — `ScheduleModule.forRoot()` wired; add `@Cron`/`@Interval` jobs as needed | `@nestjs/schedule` |

Scripts you will use most (`package.json`): `start:dev`, `prisma:generate`, `prisma:studio`, `redis:up` / `redis:down` / `redis:logs`, `test`, `lint`, `security`.

---

## 2. Folder Structure, Layering & Coding Conventions

> This is the **contract every new module/feature must follow**. The §14 cookbook is the step-by-step;
> this section is the *why* and the idioms. When in doubt, copy the `email` module (cleanest full example)
> or `cattle` (cleanest feature example).

### 2.1 Top-level layout
```
src/
  main.ts                 # bootstrap (prefix, helmet, cookies, CORS, ValidationPipe, interceptor, Sentry, Pino)
  app.module.ts           # composition root: imports modules, wires global middleware/filter/interceptor
  common/                 # cross-cutting, NOT domain-specific
    events/               #   DomainEventBusService (in-process EventEmitter) + module
    exceptions/           #   BaseException, AppError, BusinessException, ExceptionCode enum
    filters/              #   GlobalExceptionFilter (error envelope)
    interceptors/         #   ResponseEnvelopeInterceptor (success envelope)
    middleware/           #   RequestContextMiddleware (request/trace IDs)
    presentation/         #   infra HealthController (/health,/ready,/live,/metrics)
  core/                   # platform plumbing (framework-coupled, app-wide)
    config/env/           #   zod env schema + registerAs() config namespaces
    database/prisma/      #   PrismaService (+ PrismaModule)
    logger/               #   Pino LoggerService, middleware, interceptor
    redis/                #   REDIS_CLIENT provider (node-redis)
    observability/        #   metrics (Prometheus) + sentry
    security/             #   auth cookie option builders
  modules/                # feature + platform modules — the bulk of the app (see §3)
    <module>/
      domain/
      application/
      infrastructure/
      presentation/
      <module>.module.ts
  types/                  # express.d.ts (Request augmentation: user, auth, farm) + ambient decls
```

**Rule of thumb:** `common/` = reusable, domain-agnostic building blocks. `core/` = app-wide infrastructure singletons. `modules/` = bounded contexts. Never put business logic in `common/` or `core/`.

### 2.2 The four layers of a module

Every module uses the same DDD-lite split. Dependency direction is enforced by convention (also in [`ARCHITECTURE.md`](ARCHITECTURE.md)).

| Layer | Contains | May import | Must NOT import |
|-------|----------|-----------|-----------------|
| `domain/` | Contracts, enums, value types, event payloads, **repository interfaces + DI tokens** | nothing framework-y | Nest, Prisma, Redis, Express, `core`, other layers |
| `application/` | Use-cases + orchestration **services**, **ports** (interfaces), application input DTOs | `domain` | `presentation` |
| `infrastructure/` | Prisma repositories, BullMQ queues/processors, providers, template engines, SDK adapters | `application`, `domain`, `core` | `presentation` |
| `presentation/` | Controllers, guards, decorators, **listeners**, request DTOs | `application` | another module's `presentation` |

```
src/modules/<module>/
  domain/
    <entity>.type.ts                 # value/result types (no Prisma types leaking to API shape)
    enums/<name>.enum.ts
    events/<name>.event.ts           # event name constant + payload interface
    repositories/<name>.repository.ts# interface + `export const X_REPOSITORY = Symbol('X_REPOSITORY')`
  application/
    services/<name>.service.ts       # orchestration (the common case for feature modules)
    use-cases/<action>.use-case.ts   # single-action orchestration (email-style modules)
    ports/<name>.port.ts             # outbound interfaces the app depends on
    dto/<name>.input.ts              # APPLICATION input types (not the HTTP DTO)
  infrastructure/
    persistence/repositories/prisma-<name>.repository.ts  # class Prisma<Name>Repository
    queue/ providers/ templates/ pdf/                     # adapters
  presentation/
    controllers/<name>.controller.ts
    dto/<name>.dto.ts                # HTTP request DTOs (class-validator)
    guards/ decorators/ listeners/
  <module>.module.ts
```

> **Allowed:** `presentation → application → domain`; `infrastructure → application/domain/core`.
> **Forbidden:** `domain → anything framework/Prisma/core`; `application → presentation`; cross-module import of another module's `presentation`.

### 2.3 Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case, role-suffixed | `cattle.service.ts`, `create-cattle.dto.ts`, `farm-context.guard.ts`, `user-registered.event.ts` |
| Classes | PascalCase matching the file role | `CattleService`, `CreateCattleDto`, `FarmContextGuard` |
| Repository interface | `domain/repositories/<name>.repository.ts` + token symbol | `interface EmailRepository`, `export const EMAIL_REPOSITORY = Symbol('EMAIL_REPOSITORY')` |
| Prisma impl | `infrastructure/persistence/repositories/prisma-<name>.repository.ts` | `class PrismaEmailRepository implements EmailRepository` |
| Use-case | `application/use-cases/<action>.use-case.ts`, `execute()` method | `QueueEmailUseCase.execute(input)` |
| Event | name = `domain.area.action` string constant + payload interface | `auth.user.registered`, `auth.password.reset_requested` |
| Permission key | `resource.action` | `cattle.create`, `milk.read` |
| Queue / job | `infrastructure/queue/<name>.queue.constants.ts` | `EMAIL_QUEUE = 'email-queue'`, `EMAIL_JOB = 'send-email'` |
| Imports | absolute from `src/...` for cross-area, relative within a module | `import { LoggerService } from 'src/core/logger/logger/logger.service'` |

### 2.4 Controllers — keep them thin

Controllers validate input (via DTO), pull identity off the request, and delegate. **No business logic, no Prisma.** Pass **primitives** (e.g. `userId`) into services — don't hand the whole `Request` to a service.

```ts
@Controller('cattle')                                  // → /api/v1/cattle (global prefix)
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard) // standard chain (§6)
export class CattleController {
  constructor(private readonly cattleService: CattleService) {}

  @Post()
  @RequirePermission('cattle.create')
  create(@Body() dto: CreateCattleDto, @Req() req: AuthenticatedHttpRequest) {
    return this.cattleService.create(this.userId(req), dto);
  }

  private userId(req: AuthenticatedHttpRequest): string {
    const userId = req.auth?.user.sub;          // populated by SessionGuard
    if (!userId) throw new UnauthorizedException('Unauthorized');
    return userId;
  }
}
```
The active farm is on `req.farm` (set by `FarmContextGuard`) and the token (`req.auth.user.farmId`). **Read tenancy from the token/guard — never from a client-supplied body field** (see §13.4 for the legacy exception in current feature modules).

> **Prefer the param decorators** (§16.2) over hand-rolled `userId(req)` helpers:
> ```ts
> @Post()
> @RequirePermission('cattle.create')
> create(@CurrentFarmId() farmId: string, @CurrentUserId() userId: string, @Body() dto: CreateCattleDto) {
>   return this.cattleService.create(farmId, userId, dto);
> }
> ```

### 2.5 Services & use-cases

- One context-scoped logger per class, created **once** in the constructor:
  ```ts
  private readonly log: LoggerService;
  constructor(private readonly prisma: PrismaService, logger: LoggerService) {
    this.log = logger.setContext(CattleService.name);
  }
  ```
- Inject config via the namespace token, typed with `ConfigType`:
  ```ts
  constructor(@Inject(authConfig.KEY) private readonly cfg: ConfigType<typeof authConfig>) {}
  ```
- **Services** orchestrate (feature modules). **Use-cases** model a single action (`execute()`), used where the email module's granularity helps. Both accept **application/domain types**, never presentation DTO classes.
- Talk to the DB through `PrismaService` directly in feature services (the cattle/health pattern), **or** through a repository interface + token when you want the port boundary (the email pattern). Pick one per module and be consistent.

### 2.6 DTOs & validation

HTTP request DTOs live in `presentation/dto/`, use `class-validator` + `class-transformer`, and are enforced by the global `ValidationPipe` (`whitelist + forbidNonWhitelisted + transform`) — unknown fields are rejected.

```ts
export class CreateCattleDto {
  @Transform(trimString) @IsString() @IsNotEmpty() tagNumber!: string;
  @IsEnum(CattleGender) gender!: CattleGender;        // reuse Prisma enums for closed sets
  @IsOptional() @IsDateString() dateOfBirth?: string;
}
```
- Reuse the shared transform helpers from `src/common/dto` (§16.5): `trimString`, `toBoolean`, `toNumber`, plus `DateRangeQueryDto` / `IdParamDto`. (The cattle module has a pre-existing local `common.dto.ts` copy — new modules should import from `src/common/dto`.)
- For list endpoints, **extend `CursorPaginationQueryDto`** from `src/common/pagination` (§16.1) — cursor pagination is the project default.
- Use Prisma-generated enums in DTOs for closed value sets.
- Keep **application input types** (`application/dto/*.input.ts`) separate from HTTP DTOs when the service needs a shape that isn't 1:1 with the request.

### 2.7 Pagination & the response envelope

Cursor (keyset) pagination is the default — use the toolkit in `src/common/pagination` (§16.1). A list service returns a `CursorPage<T>` = `{ items, meta }`, and the global `ResponseEnvelopeInterceptor` (§9) hoists it automatically:

```jsonc
// service returns { items:[...], meta:{...} }  → client receives:
{
  "success": true,
  "data": [ /* ...items */ ],
  "meta": { "count": 20, "limit": 20, "hasNextPage": true, "hasPreviousPage": false,
            "startCursor": "eyJpZCI6Li4ufQ", "endCursor": "eyJpZCI6Li4ufQ" }
}
```
The client fetches the next page with `?cursor=<meta.endCursor>`. Plain objects become `{ success: true, data: <obj> }`. **Don't hand-wrap responses** in controllers — let the interceptor do it. Don't return a field named `success` unless you intend the interceptor to treat it as already-enveloped.

### 2.8 Errors

Throw, don't return error shapes — `GlobalExceptionFilter` converts everything to the error envelope. Prefer, in order:
1. Domain/business failures → a `BaseException` subclass with an `ExceptionCode` (extend `common/exceptions`):
   ```ts
   export class CattleTagTakenException extends BaseException {
     constructor(tag: string) {
       super({ code: ExceptionCode.CONFLICT, message: `Tag ${tag} already exists`, statusCode: HttpStatus.CONFLICT });
     }
   }
   ```
2. Standard cases → Nest built-ins (`NotFoundException`, `BadRequestException`, `ConflictException`, …) — the filter maps their status to the right `code`.
3. Add new codes to `ExceptionCode` when a client needs to branch on them. Map Prisma `P2002` (unique) to `ConflictException` (see `CattleService.isUniqueError`).

### 2.9 Multi-tenancy (non-negotiable)

- **Every** business model carries `farmId` and relates to `Farm`. **Every** query filters by the active farm.
- Resolve the active farm from the token via `FarmContextGuard` (→ `request.farm`); validate membership through `TenantAccessService.resolveFarmContext(userId, farmId)`.
- Cross-entity references (breed, shed, parents) must be re-checked to belong to the **same farm** before use (see `CattleService.validateReferences`).
- Guard chain order for farm-scoped routes: `JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard` (+ `SubscriptionFeatureGuard` when gating a paid feature). Annotate with `@RequirePermission('<resource.action>')`.

### 2.10 Decoupling: domain events & background jobs

- **Side-effects** (email, notifications) are decoupled via the in-process `DomainEventBusService`. The producer emits a named event; a `presentation/listeners/*.listener.ts` in another module subscribes. Keep event **names and payloads stable** — they're contracts.
- **Async / retryable / scheduled work** goes through BullMQ. Mirror the email pattern: a use-case `queue.add(JOB, payload, { attempts, backoff, jobId, removeOnComplete })`; a `@Processor(QUEUE)` `WorkerHost` does the work and updates a status row. Never block a request on slow I/O — queue it.
- **Scheduled** work uses `@nestjs/schedule` (`ScheduleModule.forRoot()` is wired) with `@Cron`/`@Interval`.

### 2.11 Logging & audit

- Structured logs only: `this.log.info('Cattle created', { cattleId, farmId })`. No string concatenation of data. Never log secrets/raw tokens.
- Keep logging out of `domain/`.
- Record sensitive/admin actions via `AuditService.record({ actorUserId, action, entityType, entityId, farmId, metadata })`.

### 2.12 Prisma schema conventions

- Split schema files live under `prisma/schemas/<domain>/*.prisma` (one concern per file). `prisma/schema.prisma` is just the generator/datasource stub.
- IDs are `cuid()` strings. Soft-delete with `deletedAt` (+ `isActive`/`status` where the domain needs it). Add `@@index` on FKs and common filters; relate every model back to `Farm`.
- After editing schema: `pnpm prisma:generate`, then create a migration. New enum values / tables need a migration run against a live DB.

### 2.13 Module wiring & tests

- In `<module>.module.ts`: register providers, **bind interfaces to implementations by token** (`{ provide: EMAIL_REPOSITORY, useExisting: PrismaEmailRepository }`), import what you consume (`LoggerModule`, `AuthModule`, `TenantAccessModule`, `PrismaModule`…), and `exports:` only the services other modules need.
- Tests are **colocated** as `*.spec.ts` next to the unit (`cattle.service` → `cattle.service.spec.ts`). Existing references: `auth.service.spec.ts`, `permission.service.spec.ts`, `tenant-access.service.spec.ts`. Unit specs call methods directly (guards/interceptors don't run); use e2e (`test/`) for the full pipeline.

---

## 3. Module Inventory

### Platform modules (the reusable spine — already built)
| Module | Responsibility |
|--------|----------------|
| `auth` | Register, login, refresh rotation, logout/-all, sessions, email verify, forgot/reset/change password, CSRF. Guards: `JwtAuthGuard`, `SessionGuard`, `CsrfGuard`. |
| `tenant-access` | Farm membership resolution (`FarmMembershipGuard`, `@FarmContext`, `TenantAccessService`). Multi-tenant isolation. |
| `permission` | RBAC. `PermissionGuard` + `@RequirePermission`/`@Authorize`, `PermissionService` (Redis-cached resolution). |
| `subscription` | Feature gating independent of RBAC. `SubscriptionFeatureGuard` + `@RequireFeature`. |
| `audit` | `AuditService` — writes immutable `AuditLog` rows + structured audit log lines. |
| `email` | Queue-based email (BullMQ), provider factory (Resend/SMTP), HTML templates, PDF attachments, event listeners. |
| `user` | Basic user CRUD surface. |
| `health` (`src/modules/health`) | **Animal health domain** (Sick Bay, cases, plans) — NOT the infra health checks. |

### Feature modules (domain work — partially scaffolded)
| Module | State |
|--------|-------|
| `cattle` | Controllers/services/DTOs for cattle, breeds, sheds. Migration `core_cattle` applied. |
| `reproduction` | Heat/breeding/calving/pregnancy/abortion DTOs + service. Migration `reproduction_domain` applied. |
| `health` (animal) | Health cases, plans, treatment DTOs + controllers. Migrations `health_module` + `health_farm_id_rename` applied. |

> These three are the early proof-of-concept of the PRD modules. **They do not yet use the full tenant/permission guard chain** — see §13 (Gaps).

---

## 4. Bootstrap & Global Pipeline (`main.ts`)

On startup:
1. `NestFactory.create(AppModule, { bufferLogs: true })`.
2. Pino `LoggerService` set as app logger; `SentryService.initialize(...)`.
3. `helmet()` security headers.
4. `cookieParser()` (refresh + CSRF cookies).
5. CORS: `origin: true, credentials: true` (reflects request origin, allows cookies).
6. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — unknown body props are rejected; DTOs are class-transformed.
7. Listens on `appConfig.port`.

**Global middleware** (wired in `AppModule.configure`, runs for all routes, in order):
- `RequestContextMiddleware` — generates/propagates `x-request-id` + `x-trace-id` (echoed back in response headers).
- `LoggerMiddleware` — reads those IDs, establishes async logging context.

**Global providers:**
- `APP_INTERCEPTOR → ResponseEnvelopeInterceptor` (success envelope, see §9).
- `APP_FILTER → GlobalExceptionFilter` (error envelope, see §9).

**Global API prefix:** `main.ts` calls `app.setGlobalPrefix(apiPrefix)` (`API_PREFIX`, default `api/v1`), so business routes are served under `/api/v1/...` (e.g. `/api/v1/auth/login`, `/api/v1/cattle`). The refresh/CSRF cookie paths (`/api/v1/auth`) now line up. Infra probes are **excluded** from the prefix and stay at root: `/health`, `/ready`, `/live`, `/metrics`.

---

## 5. Authentication

Full walkthroughs live in [`AUTH_USAGE.md`](AUTH_USAGE.md). Summary:

- **Tokens:** short-lived JWT **access** token + long-lived rotating **refresh** token.
  - Access token claims are minimal: `sub`, `sessionId`, `farmId`, `permissionsVersion`. **No permissions or subscription state in the JWT.**
  - Refresh tokens are stored **hashed only**, in **families** with parent/child chaining for reuse detection.
- **Password hashing:** Argon2id (`PasswordService`), cost params from env (`ARGON2_*`).
- **Sessions:** one `Session` row per device. Listed/revoked individually or all-at-once. Reused refresh family → session marked `COMPROMISED`, family revoked, `SUSPICIOUS_ACTIVITY` audited.
- **Lockout:** `failedLoginAttempts` + `lockedUntil` on `User`; configurable via `AUTH_LOCKOUT_*` (default 5 attempts / 15-min window / 15-min lock).
- **CSRF:** `csrf-csrf` double-submit. Call `GET /auth/csrf` to seed the cookie + token; send `x-csrf-token` header on cookie-authenticated state-changing routes (refresh/logout/change-password).
- **permissionsVersion:** a counter on `User`. Bumping it invalidates all outstanding access tokens (used on password change/reset, permission changes). `SessionGuard` rejects stale tokens.

### Auth route surface (`/auth`)
| Route | Guards |
|-------|--------|
| `POST /register` | Throttler(5/min) |
| `POST /login` | Throttler(login) |
| `POST /verify-email` | Throttler |
| `POST /forgot-password` | Throttler |
| `POST /reset-password` | Throttler |
| `POST /change-password` | Throttler + Csrf + Jwt + Session |
| `GET /csrf` | Throttler |
| `POST /refresh` | Throttler(refresh) + Csrf |
| `POST /logout`, `POST /logout-all` | Throttler + Csrf + Jwt + Session |
| `GET /sessions`, `DELETE /sessions/:id` | Jwt + Session |
| `GET /me` | Throttler + Jwt + Session |

### Login emits a `farmId`
`POST /login` takes `{ email, password, farmId }` and bakes `farmId` into the access token. This is the template's tenancy primitive: the active farm is part of the session, not (only) a path param. **This matters for the Rakhal API contract** — see §13.

---

## 6. Authorization (RBAC) & Multi-Tenancy

Two independent layers, applied as a guard chain. Detail in [`PermissionArcitecture.md`](PermissionArcitecture.md).

### Standard protected-route guard order (token-based tenancy — preferred)
```
JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard  (+ SubscriptionFeatureGuard where needed)
```

1. **`JwtAuthGuard`** — verifies the access token (passport-jwt access strategy).
2. **`SessionGuard`** — loads the DB session, checks status/expiry/user state, validates `permissionsVersion` against the Redis cache, attaches `request.auth` (user + session context).
3. **`FarmContextGuard`** (tenant-access) — derives the active farm from the **token** (`request.auth.user.farmId`), verifies membership via `TenantAccessService` against `FarmMember`, attaches `request.farm`. This is the org-from-session model the API spec requires; routes stay flat (`/cattle`, `/milk`). **Use this for new feature modules.**
   - **`FarmMembershipGuard`** is the alternate variant that reads `farmId` from a **route param** (key configurable via `@FarmContext`, default `farmId`) — use only for routes genuinely nested under `farms/:farmId`. **Frontend-supplied farmId is never trusted on its own.**
4. **`PermissionGuard`** — reads `@RequirePermission(...)`/`@Authorize(...)` metadata and asserts the user's resolved permissions (needs `request.farm`).

### RBAC model
`User → FarmMember → Role → RolePermission → Permission`. Permission keys are `resource.action` (e.g. `cattle.create`, `milk.read`, `finance.view`).

**Matching:** exact (`cattle.create`), resource wildcard (`cattle.*`), global wildcard (`*`). Multiple args to `@Authorize(...)` are AND-ed.

**Caching:** `PermissionService` caches the resolved permission list in Redis under `auth:permissions:<userId>:<farmId>:<permissionsVersion>` (TTL ~300s). Redis is best-effort; on failure it falls back to DB.

### Subscription gating
`SubscriptionFeatureGuard` + `@RequireFeature('<feature.key>')` checks the farm's active plan features (`FarmSubscription → SubscriptionPlan → SubscriptionFeature → Feature`). Cached in Redis under `auth:subscription-features:<farmId>` (~300s). **Independent from RBAC** — a route may require both a permission and a feature.

---

## 7. Configuration & Environment

- **Validation:** `core/config/env/env.schema.ts` (zod) parses & coerces `process.env` once at load. Missing/invalid required vars fail fast. `JWT_*_SECRET` require ≥32 chars.
- **Namespaced config:** `registerAs(...)` factories (`appConfig`, `authConfig`, `databaseConfig`, `redisConfig`, `emailConfig`, `sentryConfig`, `loggingConfig`) injected via `ConfigType<typeof xConfig>` and `xConfig.KEY`.
- **Global ConfigModule:** `isGlobal`, `cache`, `expandVariables`, loads from `.env`.

### Environment variable groups (see `README.md` for a full sample `.env`)
- **App:** `NODE_ENV`, `PORT`, `APP_NAME`, `APP_VERSION`, `API_PREFIX`.
- **DB:** `DATABASE_URL`.
- **JWT:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- **Redis:** `REDIS_HOST/PORT/USERNAME/PASSWORD/DATABASE/TLS_ENABLED/CONNECT_TIMEOUT_MS`.
- **Argon2:** `ARGON2_MEMORY_COST/TIME_COST/PARALLELISM`.
- **Refresh cookie:** `AUTH_REFRESH_COOKIE_*`.
- **CSRF:** `AUTH_CSRF_*` (set a real `AUTH_CSRF_SECRET` in non-dev).
- **Rate limit:** `RATE_LIMIT_*`, `AUTH_LOGIN_RATE_LIMIT_*`, `AUTH_REFRESH_RATE_LIMIT_*`.
- **Lockout:** `AUTH_LOCKOUT_*`.
- **Logging:** `LOG_LEVEL`, `LOG_FORMAT`, `ENABLE_REQUEST_LOGGING`, `ENABLE_HTTP_LOGGING`, `ENABLE_DB_LOGGING`.
- **Email:** `EMAIL_PROVIDER` (`resend`|`smtp`), `EMAIL_FROM`, `EMAIL_VERIFICATION_BASE_URL`, `EMAIL_PASSWORD_RESET_BASE_URL`, `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`, `RESEND_API_KEY`, plus `SMTP_*`.
- **Sentry:** `SENTRY_DSN/ENABLED/ENVIRONMENT/RELEASE/TRACES_SAMPLE_RATE`.
- **Present in `.env` but not in the zod schema yet:** `AWS_*`, `BCRYPT_SALT_ROUNDS`, `DB_POOL_SIZE`, `DB_LOGGING`, `ENABLE_EMAIL_VERIFICATION`, `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `SESSION_SECRET`, `SMTP_FROM`. Treat these as placeholders — add to `env.schema.ts` before relying on them.

---

## 8. Database (Prisma + PostgreSQL)

- **Driver adapter:** `PrismaService` extends `PrismaClient` using `PrismaPg` (connection string from `databaseConfig.url`); connects on module init, disconnects on destroy.
- **Split schema:** `prisma/schema.prisma` is a stub; real models live under `prisma/schemas/<domain>/*.prisma` (auth, farm, permission, subscription, audit, email, cattle, reproduction, health, shared). `prisma.config.ts` points Prisma at the `./prisma` directory.
- **Migrations applied:** `init` → `core_cattle` → `reproduction_domain` → `health_module` → `health_farm_id_rename`.
- **IDs:** `cuid()` strings throughout. Soft-delete via `deletedAt` on `User`/`Farm`/`Cattle` etc.

### Core data model (platform)
- **Auth:** `User`, `Session`, `RefreshToken` (families), `AuthToken` (email-verify / password-reset, hashed + single-use), `OAuthAccount`, `UserMFA`. Enums: `AuthProvider`, `SessionStatus`, `TokenType`.
- **Tenancy:** `Farm` (owner, slug, status), `FarmMember` (unique `[farmId,userId]`, links Role). Enum: `FarmStatus`.
- **RBAC:** `Role` (system or farm-scoped, unique `[farmId,name]`), `Permission` (`key`, `group`), `RolePermission`. Enum: `PermissionGroup` (COW, MILK, FINANCE, EMPLOYEE, SUBSCRIPTION, ANALYTICS, SETTINGS).
- **Subscription:** `SubscriptionPlan`, `Feature`, `SubscriptionFeature`, `FarmSubscription`. Enum: `SubscriptionStatus`.
- **Audit:** `AuditLog` (actor, farm, action, entityType/Id, metadata JSON, ip/ua). Enum: `AuditAction`.
- **Email:** `EmailLog` (status, provider, retries, correlationId). Enums: `EmailTemplate`, `EmailStatus`.
- **Domain:** `Cattle`, `Breed`, `Shed`, plus health (`HealthCase`, `HealthPlan`, `HealthTask`, `TreatmentLog`, `HealthUpdate`, `MortalityRecord`, `SafetyWithdrawal`, `DiseaseCatalog`) — all related back to `Farm`.

> **Terminology bridge:** the PRD/API say **"organization"**; the template models it as **`Farm`** (+ `FarmMember`). Treat `Farm` ≡ organization/tenant when implementing API §1–§21.

---

## 9. Error Handling

Detail in [`ERROR_FLOW_GUIDE.md`](ERROR_FLOW_GUIDE.md).

- **Exception types** (`common/exceptions/`): `BaseException`, `AppError`, `BusinessException`, with `ExceptionCode` enum (`INTERNAL_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `USER_ALREADY_EXISTS`, `USER_NOT_FOUND`, `INVALID_CREDENTIALS`).
- **`GlobalExceptionFilter`** (registered as `APP_FILTER`) normalizes everything to:
  ```json
  { "success": false, "message": "...", "code": "VALIDATION_ERROR", "requestId": "...", "timestamp": "..." }
  ```
  - Maps `BaseException`/`AppError`/`HttpException` → status + code; unknown errors → `INTERNAL_ERROR`.
  - `≥500` → captured to Sentry + `logger.error`; `<500` → `logger.warn`.
  - In production, 5xx messages are masked and stack traces are omitted.

**Success envelope:** `ResponseEnvelopeInterceptor` (global `APP_INTERCEPTOR`, `src/common/interceptors/`) wraps every successful controller return as `{ success: true, data, meta? }`. It hoists service pagination shapes (`{ items, meta }` → `{ success, data: items, meta }`), and passes through (no wrapping) for: `null`/`undefined` payloads, values that already carry a boolean `success` field (e.g. the health controller), and binary/stream responses (PDFs, `/metrics`). Errors are enveloped separately by `GlobalExceptionFilter`.

> Net effect: responses now match the Rakhaal API contract's `{ success, data, meta }` / `{ success:false, error... }` envelopes. Clients read tokens/payloads from `data.*` (e.g. `data.accessToken`).

---

## 10. Redis

- **Client:** `RedisModule` (global) provides `REDIS_CLIENT` (node-redis `createClient`), with error logging + graceful `quit()` on shutdown.
- **Used for:** permission resolution cache, subscription feature cache, `permissionsVersion` cache, and health checks (`ping`). PostgreSQL stays the source of truth.
- **BullMQ** uses its **own** Redis connection config (host/port/user/pass/db/tls) built in `EmailModule` — note it's configured ioredis-style separately from `REDIS_CLIENT`.
- **Local Redis:** `pnpm redis:up` (docker-compose, `redis:7-alpine`, appendonly, port 6379).

---

## 11. Email & Job Queues (BullMQ)

The email pipeline is the **reference implementation** for queue-backed background work — copy this pattern for any future async job (reports, notifications, reminders).

**Flow:**
1. A use-case calls `EmailService.queue({ to, subject, template, templateData, tenantId, farmId, userId, correlationId?, sendAt?, includePdf? })`.
2. An `EmailLog` row is created (`QUEUED`) and a job is pushed to the `email-queue` (BullMQ).
3. `EmailProcessor` (`@Processor('email-queue')`, extends `WorkerHost`) renders the HTML template (`EmailTemplateService` + files under `infrastructure/templates/files/`), optionally builds a PDF (`PdfGeneratorService`), and sends via `EmailProviderFactory.getProvider()` (Resend or SMTP per `EMAIL_PROVIDER`).
4. Status transitions: `QUEUED → PROCESSING → SENT|FAILED`. **Up to 5 attempts**, errors re-thrown to trigger BullMQ retry.

**Event-driven triggers (decoupled):** auth emits domain events; email module listens:
- `auth.user.registered` → `UserRegisteredListener` → verification email.
- `auth.password.reset_requested` → `PasswordResetRequestedListener` → reset email.

**Do:** always go through `EmailService.queue(...)`. **Don't:** call `ResendEmailProvider`/`SmtpEmailProvider` directly. New template → add enum in `email/domain/enums` + HTML file + render via `EmailTemplateService`.

**Templates present:** `welcome_email`, `email_verification`, `password_reset`, `vaccination_reminder`, `subscription_expiry`, `payment_receipt`, `farm_report`.

---

## 12. Domain Events, Logging & Observability

- **Domain event bus** (`common/events/DomainEventBusService`): an in-process Node `EventEmitter` (`.emit/.on/.off`). Synchronous, single-instance — **not** a distributed bus. Good for decoupling within one process; if we scale horizontally, cross-instance events need a real broker.
- **Logging:** Pino via `LoggerService`. Use `logger.setContext(ClassName.name)` once in the constructor; then `info/warn/error/audit` with structured metadata (`{ userId, farmId, correlationId }`). Keep logging out of `domain`.
- **Request context:** `x-request-id` / `x-trace-id` generated per request and attached to logs + response headers.
- **Metrics:** Prometheus via `MetricsModule` + `MetricsInterceptor`; exposed at `GET /metrics`.
- **Sentry:** initialized in bootstrap; 5xx exceptions captured with request context.
- **Health/readiness:** `GET /health`, `/ready`, `/live` (check Postgres `SELECT 1` + Redis `ping`), `GET /metrics`.
- **Full observability stack:** `observability/` ships docker-compose for Prometheus + Grafana + Loki + Promtail + Alertmanager, dashboards, alert rules, SLOs, and runbooks. See [`OBSERVABILITY_GUIDE.md`](OBSERVABILITY_GUIDE.md) and `observability/LOCAL_RUNBOOK.md`.

---

## 13. Gaps & Decisions — Status

Foundation mismatches with the Rakhaal API contract ([`Rakhaal_API.md`](../../../docs/Rakhaal_API.md)). The low-risk, high-leverage ones are now **fixed**; the rest are scoped follow-ups tied to tracker tickets.

### ✅ Fixed (2026-06-23)

1. **Global API prefix — DONE.** `main.ts` now calls `app.setGlobalPrefix(apiPrefix)` (default `api/v1`), excluding `health`/`ready`/`live`/`metrics`. Business routes are under `/api/v1/...`; auth cookie paths (`/api/v1/auth`) now align.

2. **Success-response envelope — DONE.** `ResponseEnvelopeInterceptor` (global `APP_INTERCEPTOR`, `src/common/interceptors/`) wraps responses as `{ success, data, meta? }`, hoists `{ items, meta }` pagination, and passes through already-enveloped/binary/null payloads. See §9. **Client impact:** payloads now live under `data.*`.

3. **Token-based tenancy primitive — DONE (infra).** Added `FarmContextGuard` (`src/modules/tenant-access/presentation/guards/farm-context.guard.ts`, exported from `TenantAccessModule`). It derives the active farm from the access token (`request.auth.user.farmId`), validates membership via `TenantAccessService`, and attaches `request.farm` — the org-from-token model the API spec requires, with **no `:farmId` path segment**. Standard farm-scoped chain going forward:
   ```ts
   @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
   @RequirePermission('cattle.create')
   ```
   `FarmMembershipGuard` (path-param variant) is retained for any route that genuinely nests under `farms/:farmId`.

6. **Scheduling — DONE.** `ScheduleModule.forRoot()` is wired in `AppModule`. Add `@Cron`/`@Interval` jobs for withholding auto-clear (midnight), overdue AR/AP (daily), recurring tasks (05:00), reminder fan-out — build the jobs module per **RAKHAL-109**.

7. **Env-schema drift — RESOLVED (no change needed).** The extra `.env` keys (`AWS_*`, `STRIPE_SECRET_KEY`, `PAYMENT_PROVIDER`, `DB_POOL_SIZE`, `ENABLE_EMAIL_VERIFICATION`, `SMTP_*`, …) are **unused placeholders**; zod strips unknown keys, so they cause no validation failure. The SMTP provider is a stub (`SmtpEmailProvider` throws). Add a key to `env.schema.ts` **at the moment** you wire the feature that consumes it — don't validate vaporware.

### ⏳ Remaining (scoped follow-ups — need a decision or are net-new features)

4. **Adopt the guard chain in existing feature modules.** `CattleController`/`reproduction`/`health` still take `farmId` from the request body/query and validate it via `TenantAccessService.resolveFarmContext` (secure, but not org-from-token). Migrating them to `FarmContextGuard` + `@RequirePermission` means dropping `farmId` from their DTOs and updating their specs — a **per-module refactor** best done against each module's ticket, not a blind sweep. New modules should use the standard chain from day one.

5. **Permission catalogue + role seeds.** `PermissionGroup` only covers COW, MILK, FINANCE, EMPLOYEE, SUBSCRIPTION, ANALYTICS, SETTINGS. The PRD needs reproduction, healthcare, inventory, calves, tasks, reports, settings, etc. Requires a **Prisma enum migration** (needs a live DB) + a `Permission` seed + Owner/Manager/Worker role presets matching PRD §26. Tracked under **RAKHAL-019**. (Not done here because it needs a running database to migrate/seed safely.)

8. **OTP / phone-first auth.** Template auth is **email + password**; PRD §5 is **phone + OTP + worker PIN**. A substantial auth extension (SMS provider, OTP store, PIN path, phone identity) that reuses the existing session/refresh/lockout machinery. Plan as an auth-extension epic (**RAKHAL-011/014/015**).

9. **Activity Log ≠ Audit Log.** `AuditLog` covers security/admin events. The PRD's **Activity Log** (§19) is a user-facing, immutable, hash-chained, AQR-emitting feed — a separate module (**RAKHAL-033**). Don't overload `AuditLog`.

---

## 14. How to Add a New Rakhal Module (cookbook)

> The conventions behind each step are in **§2 (Folder Structure, Layering & Coding Conventions)** — read it first.

1. **Schema first:** add `prisma/schemas/<module>/*.prisma`, relate models to `Farm`, run `pnpm prisma:generate` + create a migration.
2. **Scaffold layers:** `domain/` (types, enums, repo interfaces + DI tokens) → `application/` (services/use-cases, ports) → `infrastructure/` (Prisma repos) → `presentation/` (controller, DTOs).
3. **DTOs:** request DTOs in `presentation/dto/*.dto.ts` using class-validator (the global `ValidationPipe` whitelists + transforms).
4. **Guards:** apply the standardized chain (after deciding §13.3): `JwtAuthGuard, SessionGuard, <tenant guard>, PermissionGuard`; annotate with `@RequirePermission('<resource.action>')`.
5. **Wire module:** register providers, bind interfaces to Prisma impls via tokens, import `LoggerModule` (+ `AuthModule`/`TenantAccessModule` as needed), export services other modules consume.
6. **Cross-cutting:** emit domain events for decoupled side-effects; queue async work via the BullMQ pattern (§11); write `AuditService.record(...)` for sensitive actions; log with `LoggerService.setContext(...)`.
7. **Tests:** add `*.spec.ts` next to services/controllers (Jest). Existing examples: `auth.service.spec.ts`, `permission.service.spec.ts`, `subscription-access.service.spec.ts`, `tenant-access.service.spec.ts`.
8. **Update the tracker:** move the matching `RAKHAL-xxx` ticket in [`PROJECT_PROGRESS.md`](../../../docs/PROJECT_PROGRESS.md) and follow the [Development Rules](../../../docs/PROJECT_PROGRESS.md#development-rules).

---

## 15. Quick Reference — Where Things Live

| Need | File / Dir |
|------|-----------|
| Bootstrap / global middleware | `src/main.ts`, `src/app.module.ts` |
| Env schema + namespaced config | `src/core/config/env/` |
| Prisma service / models | `src/core/database/prisma/`, `prisma/schemas/` |
| Redis client | `src/core/redis/` |
| Logger | `src/core/logger/logger/` |
| Metrics / Sentry | `src/core/observability/` |
| Exceptions + global filter | `src/common/exceptions/`, `src/common/filters/` |
| Success-envelope interceptor | `src/common/interceptors/response-envelope.interceptor.ts` |
| Cursor pagination toolkit | `src/common/pagination/` (§16.1) |
| Param decorators (`@CurrentUserId`, `@CurrentFarmId`) | `src/common/decorators/` (§16.2) |
| Cache service (Redis) | `src/core/cache/` (§16.3) |
| Crypto / token hashing | `src/common/crypto/` (§16.4) |
| Shared DTO helpers / DTOs | `src/common/dto/` (§16.5) |
| Domain event bus | `src/common/events/` |
| Infra health/metrics endpoints | `src/common/presentation/controllers/health.controller.ts` |
| Auth (guards/strategies/services) | `src/modules/auth/` |
| Tenant access (farm guards) | `src/modules/tenant-access/` — `FarmContextGuard` (token), `FarmMembershipGuard` (path param) |
| RBAC (permission guard/decorators) | `src/modules/permission/` |
| Subscription gating | `src/modules/subscription/` |
| Audit | `src/modules/audit/` |
| Email + queue + templates | `src/modules/email/` |
| Existing domain examples | `src/modules/cattle/`, `src/modules/reproduction/`, `src/modules/health/` |
| Observability stack (compose, dashboards, runbooks) | `observability/` |
| Existing deep-dive docs | `docs/ARCHITECTURE.md`, `docs/AUTH_USAGE.md`, `docs/PermissionArcitecture.md`, `docs/ERROR_FLOW_GUIDE.md`, `docs/OBSERVABILITY_GUIDE.md` |

---

## 16. Reusable Building Blocks (cross-cutting, no business logic)

Shared, domain-agnostic utilities every feature reuses. Each file carries JSDoc with copy-paste examples — these are the source of truth; the summaries below are the index.

### 16.1 Cursor pagination — `src/common/pagination/`
The project's **default list pagination is cursor (keyset) based** — stable under concurrent writes, no `OFFSET` scans. Pieces:
- `CursorPaginationQueryDto` — extend it in your list query DTO (`limit` 1–100, opaque `cursor`, `sortOrder`).
- `getCursorArgs(query)` — returns `{ take, skip?, cursor? }` to spread into Prisma `findMany` (fetches `limit + 1` to detect the next page).
- `toCursorPage(rows, query)` — trims the look-ahead row and returns `CursorPage<T>` = `{ items, meta }` (the envelope interceptor hoists `meta`).
- `encodeCursor` / `decodeCursor` — opaque base64url codec; malformed cursors → `BadRequestException`.

```ts
import { CursorPaginationQueryDto, getCursorArgs, toCursorPage, CursorPage } from 'src/common/pagination';

async list(farmId: string, query: ListCattleQueryDto): Promise<CursorPage<Cattle>> {
  const rows = await this.prisma.cattle.findMany({
    where: { farmId },
    orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }], // end with id (cursor anchor)
    ...getCursorArgs(query),
  });
  return toCursorPage(rows, query);
}
```
> Rule: always end `orderBy` with `{ id: sortOrder }` — the cursor anchors on the unique `id`.

### 16.2 Param decorators — `src/common/decorators/`
Kill controller boilerplate; read guard-populated context.
- `@CurrentUser()` → `AuthTokenPayload` · `@CurrentUser('sub')` → a field · `@CurrentUserId()` → user id.
- `@CurrentFarm()` → `VerifiedFarmContext` · `@CurrentFarm('roleId')` → a field · `@CurrentFarmId()` → active farm id.

They throw `401`/`403` if the matching guard (SessionGuard / FarmContextGuard) didn't run.

```ts
@Get()
list(@CurrentFarmId() farmId: string, @Query() query: ListCattleQueryDto) {
  return this.service.list(farmId, query);
}
```

### 16.3 Cache service — `src/core/cache/`
Global, best-effort Redis facade (`CacheModule` is `@Global` — just inject `CacheService`). JSON (de)serialization, swallows Redis failures (logged, never thrown).
- `get<T>(key)` · `set(key, value, ttlSeconds?)` · `delete(key|keys)` · `deleteByPrefix(prefix)` · `getOrSet(key, ttl, factory)`.
- Namespace keys `domain:entity:id` so `deleteByPrefix` can invalidate a group.

```ts
const cattle = await this.cache.getOrSet(`cattle:${farmId}:${id}`, 300,
  () => this.prisma.cattle.findUniqueOrThrow({ where: { id } }));
await this.cache.deleteByPrefix(`cattle:${farmId}:`); // on write
```
> Existing auth/permission caches still hand-roll Redis directly; they can migrate to `CacheService` opportunistically.

### 16.4 Crypto / token hashing — `src/common/crypto/`
For opaque (non-password) secrets — refresh/verify/reset tokens, API keys, webhook signatures, idempotency keys. **Not** for passwords (those use Argon2id via `PasswordService`).
- `generateOpaqueToken(bytes=32)` — random URL-safe token (give to client once).
- `sha256Hex(value)` — deterministic digest to store/look up by hash.
- `safeEqualHex(a, b)` — constant-time compare (timing-attack safe).

```ts
const raw = generateOpaqueToken();
await repo.save({ tokenHash: sha256Hex(raw) }); // store hash only; return `raw` to caller
```

### 16.5 Shared DTO helpers — `src/common/dto/`
Canonical home for input building blocks (prefer over per-module copies):
- Transformers: `trimString`, `toBoolean`, `toNumber` (use with `@Transform`).
- `DateRangeQueryDto` — optional ISO-8601 `from`/`to` for list/report filters.
- `IdParamDto` — validated `:id` path param.

### 16.6 Candidates for later (not built yet)
Add when a feature first needs them, following the same conventions: an **idempotency-key** guard/store (finance mutations), an **outbox** for cross-process domain events (only if we scale past one instance), and a **file/object-storage** adapter (uploads — RAKHAL-009). The PRD's **Activity Log** (§13.9) is a feature module, not a generic utility.

---

*This document describes the template as it exists on 2026-06-23. When you change bootstrap, guards, config, the reusable building blocks (§16), or the tenancy/envelope decisions in §13, update this file in the same PR.*
