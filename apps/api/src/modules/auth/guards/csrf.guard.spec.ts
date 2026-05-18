import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  it('rejects invalid csrf tokens', () => {
    const guard = new CsrfGuard({
      validateRequest: jest.fn().mockReturnValue(false),
    } as never);

    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });
});
