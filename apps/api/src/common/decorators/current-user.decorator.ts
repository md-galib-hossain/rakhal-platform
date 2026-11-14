import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import type { AuthTokenPayload } from 'src/modules/auth/domain/auth-token-payload.type';

/**
 * Inject the authenticated token payload (or one of its fields) into a handler,
 * removing the repetitive `request.auth.user.sub` boilerplate.
 *
 * Requires `JwtAuthGuard` + `SessionGuard` to have run (they populate
 * `request.auth`). Throws 401 if the context is missing.
 *
 * @example
 * @Get('me')
 * me(@CurrentUser() user: AuthTokenPayload) { ... }
 *
 * @Post()
 * create(@CurrentUser('sub') userId: string, @Body() dto: CreateDto) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    const user = request.auth?.user;
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return field ? user[field] : user;
  },
);

/**
 * Shorthand for `@CurrentUser('sub')` — injects the authenticated user id.
 *
 * @example
 * findAll(@CurrentUserId() userId: string) { ... }
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return userId;
  },
);
