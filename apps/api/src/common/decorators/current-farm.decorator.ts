import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import type { VerifiedFarmContext } from 'src/modules/tenant-access/domain/verified-farm-context.type';

/**
 * Inject the verified active-farm context (or one of its fields) into a handler.
 *
 * Requires `FarmContextGuard` (token-based) or `FarmMembershipGuard` (path-param)
 * to have run — they validate membership and populate `request.farm`. Throws 403
 * if farm context is missing (guard not applied or access denied).
 *
 * @example
 * @Get()
 * list(@CurrentFarm() farm: VerifiedFarmContext) { ... }     // full context
 */
export const CurrentFarm = createParamDecorator(
  (field: keyof VerifiedFarmContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    const farm = request.farm;
    if (!farm) {
      throw new ForbiddenException('Farm access denied');
    }

    return field ? farm[field] : farm;
  },
);

/**
 * Shorthand for `@CurrentFarm('farmId')` — injects the active farm id (tenant).
 *
 * @example
 * list(@CurrentFarmId() farmId: string, @Query() q: ListQueryDto) { ... }
 */
export const CurrentFarmId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    const farmId = request.farm?.farmId;
    if (!farmId) {
      throw new ForbiddenException('Farm access denied');
    }

    return farmId;
  },
);
