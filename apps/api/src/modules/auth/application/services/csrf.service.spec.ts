import { CsrfService } from './csrf.service';
import type { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';

describe('CsrfService.isCookielessClient', () => {
  const config = {
    refreshSecret: 'test-refresh-secret',
    refreshCookie: { name: 'rakhal_refresh' },
    csrf: {
      secret: 'test-csrf-secret',
      cookieName: 'rakhal_csrf',
      headerName: 'x-csrf-token',
      cookieSecure: false,
      cookieSameSite: 'lax',
      cookiePath: '/',
    },
  };
  const service = new CsrfService(config as never);
  const req = (partial: Record<string, unknown>) =>
    ({
      headers: {},
      cookies: {},
      body: {},
      ...partial,
    }) as never as AuthenticatedHttpRequest;

  it('is true for a bearer-only request with no refresh cookie', () => {
    expect(
      service.isCookielessClient(
        req({ headers: { authorization: 'Bearer abc.def' } }),
      ),
    ).toBe(true);
  });

  it('is true for a body refresh token with no refresh cookie', () => {
    expect(
      service.isCookielessClient(req({ body: { refreshToken: 'tok' } })),
    ).toBe(true);
  });

  it('is false when the refresh cookie is present, even with a bearer or body token', () => {
    expect(
      service.isCookielessClient(
        req({
          cookies: { rakhal_refresh: 'cookie' },
          headers: { authorization: 'Bearer abc' },
          body: { refreshToken: 'tok' },
        }),
      ),
    ).toBe(false);
  });

  it('is false with no credential at all, or an empty/non-string body token', () => {
    expect(service.isCookielessClient(req({}))).toBe(false);
    expect(
      service.isCookielessClient(req({ body: { refreshToken: '' } })),
    ).toBe(false);
    expect(service.isCookielessClient(req({ body: { refreshToken: 5 } }))).toBe(
      false,
    );
    expect(
      service.isCookielessClient(
        req({ headers: { authorization: 'Basic abc' } }),
      ),
    ).toBe(false);
  });
});
