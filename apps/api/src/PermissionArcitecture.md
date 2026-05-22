# Permission Architecture (Rakhal)

## Purpose
This document explains the current authorization layer, how to use it in endpoints, and how to extend it safely.

## Scope
- Authentication and authorization are separate.
- Authentication establishes identity and session (`JwtAuthGuard`, `SessionGuard`).
- Authorization validates actions (`PermissionGuard` + permission metadata).

## Current Flow
1. User logs in and receives access token with:
- `sub`
- `sessionId`
- `farmId`
- `permissionsVersion`
2. Protected route executes:
- `JwtAuthGuard` (token validity)
- `SessionGuard` (session + user state + stale permission version detection)
- `FarmMembershipGuard` (farm context resolution from route param)
- `PermissionGuard` (permission assertion)
3. `PermissionService` resolves role permissions via `FarmMember -> Role -> RolePermission -> Permission`.
4. Resolved permissions are cached in Redis:
- Key: `auth:permissions:<userId>:<farmId>:<permissionsVersion>`
- TTL: short-lived (300 seconds)

## Data Model (RBAC)
- `User` has membership in farms via `FarmMember`.
- `FarmMember` references one `Role`.
- `Role` has many `Permission` through `RolePermission`.
- `Permission.key` naming convention: `resource.action`.

Examples:
- `cattle.create`
- `cattle.read`
- `milk.read`
- `finance.view`

## Permission Matching Rules
Current matcher supports:
1. Exact permission:
- required `cattle.create`
- granted `cattle.create`
2. Resource wildcard:
- required `cattle.update`
- granted `cattle.*`
3. Global wildcard:
- any required permission
- granted `*`

## How to Protect an Endpoint
Use guard chain in this order:
1. `JwtAuthGuard`
2. `SessionGuard`
3. `FarmMembershipGuard`
4. `PermissionGuard`

Use one of these decorators:
- `RequirePermission(...)`
- `Authorize(...)` (alias to `RequirePermission`)

### Example
```ts
import { Controller, Post, Param, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmMembershipGuard } from 'src/modules/tenant-access/presentation/guards/farm-membership.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { Authorize } from 'src/modules/permission/presentation/decorators/authorize.decorator';

@Controller('farms/:farmId/cattle')
export class CattleController {
  @Post()
  @UseGuards(JwtAuthGuard, SessionGuard, FarmMembershipGuard, PermissionGuard)
  @Authorize('cattle.create')
  create(@Param('farmId') farmId: string, @Body() body: unknown) {
    return { success: true, farmId, body };
  }
}
```

### Multi-permission example
All permissions listed are required (logical AND):
```ts
@Authorize('finance.view', 'analytics.read')
```

## Common Use Cases
1. Farm owner with broad farm permissions
- Role permissions can include `cattle.*`, `milk.*`, `finance.view`.
2. Worker with narrow permissions
- Role permissions can include `cattle.read`, `milk.read`.
3. System/super admin
- Role permission can include `*` for unrestricted access.

## Redis Cache Behavior
- Cache is best-effort. If Redis fails, permission resolution falls back to DB.
- Cache invalidation currently happens through permission service invalidation paths and auth security flows tied to `permissionsVersion`.

## Future Extensions (Planned, Non-breaking)
1. ABAC policy layer
- Add policy evaluators after RBAC pass (ownership, record-level checks).
2. Farm isolation policies
- Reuse `request.farm` context populated by `FarmMembershipGuard`.
3. Additional wildcard semantics
- Existing support already includes `resource.*` and `*`.

## Best Practices
1. Keep permission keys in `resource.action` format.
2. Prefer narrow permissions over `*`.
3. Always include farm membership guard before permission guard in farm-scoped routes.
4. Do not bypass `PermissionService` or Redis abstraction directly.
5. Keep new authorization behavior additive and compatible with `permissionsVersion`.

## Files to Know
- `src/modules/permission/application/services/permission.service.ts`
- `src/modules/permission/presentation/guards/permission.guard.ts`
- `src/modules/permission/presentation/decorators/require-permission.decorator.ts`
- `src/modules/permission/presentation/decorators/authorize.decorator.ts`
- `src/modules/auth/presentation/guards/session.guard.ts`
- `src/modules/tenant-access/presentation/guards/farm-membership.guard.ts`
