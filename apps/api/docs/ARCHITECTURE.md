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

## Logging in Any Module (From Scratch)
Use this when adding logging to a new or existing module.

1. Import `LoggerModule` in your module.
- In `<module>.module.ts`:
  - `import { LoggerModule } from 'src/core/logger/logger/logger.module';`
  - Add `LoggerModule` to `imports`.

2. Inject `LoggerService` into your service/use-case/guard/controller.
- `import { LoggerService } from 'src/core/logger/logger/logger.service';`
- Add `logger: LoggerService` in constructor.

3. Create a context-specific logger once in constructor.
- Keep a private field:
  - `private readonly log: LoggerService;`
- In constructor:
  - `this.log = logger.setContext(YourClassName.name);`

4. Use structured logs, not plain text only.
- Good pattern:
  - `this.log.info('Action completed', { userId, farmId, correlationId });`
  - `this.log.warn('Validation failed', { reason, userId });`
  - `this.log.error('Operation failed', error, { jobId, tenantId });`
  - `this.log.audit('domain.action', { userId, tenantId, timestamp: new Date().toISOString() });`

5. Keep logging out of `domain`.
- Only use logger in `application`, `infrastructure`, or `presentation`.

## Sending Email from Any Module
Use the email module pipeline instead of calling providers directly.

### Recommended Path (Queue-based)
1. Ensure `EmailModule` is available in app/module composition.
- `EmailModule` already provides:
  - `EmailService`
  - `QueueEmailUseCase`

2. Inject `EmailService` in your application service/use-case.
- `import { EmailService } from 'src/modules/email/application/services/email.service';`

3. Call `emailService.queue(...)` with required payload.
- Example fields:
  - `to`
  - `subject`
  - `template`
  - `templateData`
  - `tenantId`
  - `farmId`
  - `userId`
  - optional: `correlationId`, `sendAt`, `includePdf`

4. Do not call provider implementations directly.
- Avoid direct usage of:
  - `ResendEmailProvider`
  - `SmtpEmailProvider`
- Provider selection and retries are handled by the email module internals.

5. If introducing a new email template:
- Add template enum in `email/domain/enums`.
- Add HTML template file under `email/infrastructure/templates/files`.
- Keep rendering through `EmailTemplateService` (no inline HTML in feature modules).
