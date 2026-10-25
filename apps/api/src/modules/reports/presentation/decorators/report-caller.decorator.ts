import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import type { ReportCaller } from '../../application/api/reports-api.types';

/**
 * Builds the {@link ReportCaller} from what the guards verified (token user + resolved farm
 * membership). Nothing here comes from the request body or query.
 */
export const Caller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ReportCaller => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const user = req.auth?.user;
    if (!user) throw new UnauthorizedException('Unauthorized');
    const farm = req.farm;
    if (!farm) throw new ForbiddenException('Farm access denied');
    return {
      userId: user.sub,
      farmId: farm.farmId,
      permissionsVersion: user.permissionsVersion,
      roleName: farm.roleName,
      isSystemRole: farm.isSystemRole,
    };
  },
);
