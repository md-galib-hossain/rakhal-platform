import { Module } from '@nestjs/common';
import { env } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { EmailModule } from '../email/email.module';
import { BillingService } from './application/services/billing.service';
import { CouponService } from './application/services/coupon.service';
import { ReferralService } from './application/services/referral.service';
import { CreditWalletService } from './application/services/credit-wallet.service';
import { ReceiptService } from './application/services/receipt.service';
import { BkashTokenService } from './application/services/bkash-token.service';
import { UnconfiguredPaymentProvider } from './application/providers/unconfigured-payment.provider';
import { BkashPaymentProvider } from './application/providers/bkash-payment.provider';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider.port';
import { BillingController } from './presentation/controllers/billing.controller';
import { BkashCallbackController } from './presentation/controllers/bkash-callback.controller';
import { ReferralController } from './presentation/controllers/referral.controller';

/**
 * Billing module (RAKHAL-220, PRD §32). Invoices + payments + checkout, with a
 * gateway-agnostic `PaymentProvider` bound at the `PAYMENT_PROVIDER` token via a
 * factory: **bKash** when its credentials are configured (RAKHAL-221), else the
 * no-op provider. Imports SubscriptionModule to activate a subscription on a paid
 * invoice and AuditModule for the money-path audit trail. The bKash callback is a
 * separate unguarded controller (browser redirect, no auth token). `CouponService`
 * (RAKHAL-222) / `ReferralService` (RAKHAL-223) are exported so the future
 * platform-admin module (RAKHAL-224/225) can wire issue/list/disable and
 * program-config controllers straight into them. `ReferralService` is also
 * exported for `FarmModule` (attribution at farm creation, REF-01).
 * `CreditWalletService` (PRD §37) is the exported closed-loop Rakhal Credit
 * primitive — future paid surfaces (Doctors §38.1, Marketplace §38.2, Cattle
 * Trading §38.3) import it to spend credit with a one-line `debit(...)`.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    AuditModule,
    SubscriptionModule,
    ComplianceModule,
    EmailModule,
  ],
  controllers: [BillingController, BkashCallbackController, ReferralController],
  providers: [
    BillingService,
    CouponService,
    ReferralService,
    CreditWalletService,
    ReceiptService,
    BkashTokenService,
    BkashPaymentProvider,
    UnconfiguredPaymentProvider,
    // Explicit gateway toggle (`PAYMENT_PROVIDER`). Tests always run gateway-less
    // (deterministic — never hit the real bKash network; the finalize logic is
    // covered by a stub-provider e2e). Otherwise `bkash` selects the adapter and
    // is **fail-closed**: selecting it without complete BKASH_* creds refuses to
    // boot rather than silently falling back.
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        bkash: BkashPaymentProvider,
        none: UnconfiguredPaymentProvider,
      ) => {
        if (env.NODE_ENV === 'test') return none;
        if (env.PAYMENT_PROVIDER === 'bkash') {
          if (!bkash.isConfigured()) {
            throw new Error(
              'PAYMENT_PROVIDER=bkash but BKASH_* credentials are incomplete',
            );
          }
          return bkash;
        }
        return none;
      },
      inject: [BkashPaymentProvider, UnconfiguredPaymentProvider],
    },
  ],
  exports: [
    BillingService,
    CouponService,
    ReferralService,
    CreditWalletService,
  ],
})
export class BillingModule {}
