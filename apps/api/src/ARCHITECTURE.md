# Rakhal Backend Architecture

## Purpose
This document defines the project structure, dependency rules, and module creation workflow so future agents and engineers can extend the codebase without breaking behavior.

## High-Level Structure
```txt
src/
  app.module.ts
  main.ts

  common/
    events/
    exceptions/
    filters/
    middleware/

  core/
    config/
    database/
    logger/
    redis/
    security/

  modules/
    <module-name>/
      domain/
      application/
      infrastructure/
      presentation/
      <module-name>.module.ts
```

## Layer Responsibilities
- `domain`
  - Business contracts, event contracts, enums, value types.
  - No framework/runtime dependencies (no Nest, Prisma, Redis, Express).
- `application`
  - Use-cases and orchestration services.
  - Depends on `domain` contracts.
  - Should consume persistence/external services through ports/interfaces.
- `infrastructure`
  - Concrete implementations (Prisma repositories, queues, providers, template engines, external SDKs).
  - Can depend on `core`.
- `presentation`
  - Controllers, guards, listeners, decorators, request DTOs.
  - Calls application services.

## Dependency Direction Rules
- Allowed:
  - `presentation -> application`
  - `application -> domain`
  - `infrastructure -> application/domain`
- Forbidden:
  - `domain -> infrastructure/presentation/core/frameworks`
  - `application -> presentation`
  - Cross-module import from another module's `presentation`

## Existing Module Pattern
- `auth`
  - `domain/events` owns auth event contracts (example: user registration event).
  - `application/services` orchestrates auth workflows.
  - `infrastructure/persistence/repositories` contains Prisma repository implementations.
  - `presentation/controllers|guards|strategies|dto` holds HTTP auth surface.
- `email`
  - `domain/repositories/email.repository.ts` defines `EmailRepository` interface + token.
  - `infrastructure/persistence/repositories/prisma-email.repository.ts` implements repository.
  - `application/use-cases` consumes repository via DI token.
  - `presentation/listeners` subscribes to domain event contracts.
- `permission`, `subscription`, `tenant-access`, `audit`, `user`
  - Services are under `application/services`.
  - Guards/decorators/controllers are under `presentation/*`.

## Naming Conventions
- Repository interfaces:
  - `domain/repositories/<name>.repository.ts`
  - Export interface and DI token symbol (example: `EMAIL_REPOSITORY`).
- Infrastructure implementations:
  - `infrastructure/persistence/repositories/prisma-<name>.repository.ts`
  - Class name: `Prisma<Name>Repository`.
- Use-cases:
  - `application/use-cases/<action>.use-case.ts`
- Presentation DTOs:
  - `presentation/dto/*.dto.ts`
- Application input types (if needed):
  - `application/dto/*.input.ts`

## How to Add a New Module
1. Create module skeleton:
```txt
src/modules/<new-module>/
  domain/
  application/
    services/
    use-cases/
    dto/
    ports/
  infrastructure/
    persistence/repositories/
    providers/
  presentation/
    controllers/
    guards/
    decorators/
    dto/
  <new-module>.module.ts
```

2. Define domain contracts first:
- Add enums/types/events/repository interfaces in `domain`.
- Add DI token symbols for repositories/ports.

3. Implement application logic:
- Put orchestration in `application/services` or `application/use-cases`.
- Accept only domain/application types as input.

4. Implement infrastructure adapters:
- Implement repository interfaces with Prisma/external clients.
- Register adapters in module providers with token-based DI.

5. Expose presentation surface:
- Add controllers/listeners/guards in `presentation`.
- Keep request validation DTOs in `presentation/dto`.

6. Wire module providers:
- Bind interfaces to implementations using `provide/useExisting` or `provide/useClass`.
- Export only required services/use-cases.

7. Validate architecture compliance:
- No `application -> presentation` imports.
- No `domain -> core/framework` imports.
- No cross-module dependency on another module's `presentation`.

## Refactor Safety Rules
- Do not change business logic while reorganizing layers.
- Move files and update imports first, then add ports/interfaces.
- Keep event names/payloads stable during contract relocation.
- For risky changes, add compatibility re-exports temporarily and remove later.

## Recommended Review Checklist (for future agents)
- [ ] API routes and response shapes unchanged.
- [ ] Event names/payload contracts unchanged.
- [ ] DI tokens wired correctly in module providers.
- [ ] No circular dependencies introduced.
- [ ] No forbidden dependency direction violations.
