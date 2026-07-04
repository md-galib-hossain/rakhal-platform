import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedAdminRequest,
  CurrentAdminContext,
} from '../../domain/authenticated-admin-request.type';

/** Injects the platform admin attached by `PlatformAdminGuard`. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAdminContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedAdminRequest>();
    if (!request.admin) {
      throw new Error('CurrentAdmin used without PlatformAdminGuard');
    }
    return request.admin;
  },
);
