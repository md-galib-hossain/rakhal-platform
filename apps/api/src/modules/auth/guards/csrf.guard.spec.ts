import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from '../presentation/guards/csrf.guard';

describe('CsrfGuard', () => {
  it('rejects invalid csrf tokens', () => {
    const guard = new CsrfGuard({
      validateRequest: jest.fn().mockReturnValue(false),
      isCookielessClient: jest.fn().mockReturnValue(false),
    });

    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      }),
    ).toThrow(ForbiddenException);
  });

  it('skips csrf validation for cookieless (bearer/body-token) clients', () => {
    const validateRequest = jest.fn().mockReturnValue(false);
    const guard = new CsrfGuard({
      validateRequest,
      isCookielessClient: jest.fn().mockReturnValue(true),
    });

    expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      }),
    ).toBe(true);
    expect(validateRequest).not.toHaveBeenCalled();
  });
});
