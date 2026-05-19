import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { createHash } from 'crypto';
import { authConfig } from 'src/core/config/env';
import { getCsrfCookieOptions } from 'src/core/security/auth-cookie-options';
import type { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';

@Injectable()
export class CsrfService {
  private readonly utilities: ReturnType<typeof doubleCsrf>;

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {
    this.utilities = doubleCsrf({
      getSecret: () => this.config.csrf.secret ?? this.config.refreshSecret,
      getSessionIdentifier: (request) => this.getSessionIdentifier(request),
      cookieName: this.config.csrf.cookieName,
      cookieOptions: getCsrfCookieOptions(this.config),
      getCsrfTokenFromRequest: (request) =>
        request.headers[this.config.csrf.headerName] as string | undefined,
      errorConfig: {
        statusCode: 403,
        message: 'invalid csrf token',
        code: 'EBADCSRFTOKEN',
      },
    });
  }

  generateToken(request: AuthenticatedHttpRequest, response: Response): string {
    if (!request.cookies) {
      request.cookies = {};
    }

    return this.utilities.generateCsrfToken(request, response);
  }

  validateRequest(request: AuthenticatedHttpRequest): boolean {
    return this.utilities.validateRequest(request);
  }

  private getSessionIdentifier(request: AuthenticatedHttpRequest): string {
    if (request.auth?.session.id) {
      return request.auth.session.id;
    }

    const cookies = request.cookies as
      | Record<string, string | undefined>
      | undefined;
    const refreshToken = cookies?.[this.config.refreshCookie.name];

    if (refreshToken) {
      return createHash('sha256').update(refreshToken).digest('hex');
    }

    return [
      request.ip ?? 'unknown-ip',
      request.headers['user-agent'] ?? 'unknown-user-agent',
    ].join('|');
  }
}
