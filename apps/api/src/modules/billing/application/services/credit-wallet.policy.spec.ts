import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreditWalletService } from './credit-wallet.service';
import { DEFAULT_CREDIT_POLICY } from '../../domain/credit-policy';

/**
 * Rakhal Credit policy guards (PRD §37, CRD-03/CRD-05). Proves the closed-loop
 * behavior is real, not just documented: cash-out is gated OFF and only a
 * policy-whitelisted surface can spend credit. These paths throw before any DB
 * access, so a stub prisma is enough.
 */
describe('CreditWalletService — closed-loop policy', () => {
  const svc = new CreditWalletService({} as never);

  it('launch policy keeps credit closed-loop (cash-out off, subscription-only)', () => {
    expect(DEFAULT_CREDIT_POLICY.cashOutEnabled).toBe(false);
    expect(DEFAULT_CREDIT_POLICY.spendableSurfaces).toEqual(['subscription']);
  });

  it('assertCashOutEnabled throws while cash-out is disabled (CRD-05)', () => {
    expect(() => svc.assertCashOutEnabled()).toThrow(ForbiddenException);
  });

  it('applyToCharge rejects a surface not in the policy (CRD-03)', async () => {
    // `marketplace` isn't enabled yet — must not silently accept credit.
    await expect(
      svc.applyToCharge(
        {} as never,
        'farm-1',
        new Prisma.Decimal(100),
        'marketplace',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
