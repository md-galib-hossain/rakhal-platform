import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BillingService } from './application/services/billing.service';
import { CouponService } from './application/services/coupon.service';
import { BkashTokenService } from './application/services/bkash-token.service';
import { UnconfiguredPaymentProvider } from './application/providers/unconfigured-payment.provider';
import { BkashPaymentProvider } from './application/providers/bkash-payment.provider';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider.port';
import { BillingController } from './presentation/controllers/billing.controller';
import { BkashCallbackController } from './presentation/controllers/bkash-callback.controller';

/**
 * Billing module (RAKHAL-220, PRD §32). Invoices + payments + checkout, with a
 * gateway-agnostic `PaymentProvider` bound at the `PAYMENT_PROVIDER` token via a
 * factory: **bKash** when its credentials are configured (RAKHAL-221), else the
 * no-op provider. Imports SubscriptionModule to activate a subscription on a paid
 * invoice and AuditModule for the money-path audit trail. The bKash callback is a
 * separate unguarded controller (browser redirect, no auth token). `CouponService`
 * (RAKHAL-222) is exported so the future platform-admin module (RAKHAL-224/225)
 * can wire an issue/list/disable controller straight into it.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    AuditModule,
    SubscriptionModule,
  ],
  controllers: [BillingController, BkashCallbackController],
  providers: [
    BillingService,
    CouponService,
    BkashTokenService,
    BkashPaymentProvider,
    UnconfiguredPaymentProvider,
    // Config-selected: use bKash when its credentials are present, else the
    // no-op provider (so billing boots + tests run without a gateway).
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        bkash: BkashPaymentProvider,
        none: UnconfiguredPaymentProvider,
      ) => (bkash.isConfigured() ? bkash : none),
      inject: [BkashPaymentProvider, UnconfiguredPaymentProvider],
    },
  ],
  exports: [BillingService, CouponService],
})
export class BillingModule {}
