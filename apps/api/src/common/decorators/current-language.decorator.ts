import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { resolveLanguage, AppLanguage } from 'src/common/i18n/language';

/**
 * Inject the effective request language (RAKHAL-107): an `Accept-Language`
 * header overrides, else the authenticated user's stored `preferredLanguage`
 * (requires `SessionGuard` to have run — falls back to the default if the
 * route is public/unauthenticated), else Bangla.
 *
 * @example
 * create(@CurrentLanguage() lang: AppLanguage, @Body() dto: CreateDto) { ... }
 */
export const CurrentLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppLanguage => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    return resolveLanguage(
      request.headers['accept-language'],
      request.auth?.account.preferredLanguage,
    );
  },
);
