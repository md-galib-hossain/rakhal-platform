import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '@prisma/client';
import {
  CreatePaymentResult,
  PaymentExecutionResult,
  PaymentProvider,
  RefundResult,
} from '../ports/payment-provider.port';

const NOT_CONFIGURED = 'No payment provider is configured';

/**
 * Default payment provider when none is wired (RAKHAL-220). `isConfigured()` is
 * false, so checkout creates the invoice + a PENDING payment but doesn't initiate
 * a gateway charge. The real adapter (bKash, RAKHAL-221) replaces this at the
 * `PAYMENT_PROVIDER` token; the gateway methods reject if called anyway.
 */
@Injectable()
export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.NONE;

  isConfigured(): boolean {
    return false;
  }

  createPayment(): Promise<CreatePaymentResult> {
    return Promise.reject(new Error(NOT_CONFIGURED));
  }

  executePayment(): Promise<PaymentExecutionResult> {
    return Promise.reject(new Error(NOT_CONFIGURED));
  }

  queryPayment(): Promise<PaymentExecutionResult> {
    return Promise.reject(new Error(NOT_CONFIGURED));
  }

  refund(): Promise<RefundResult> {
    return Promise.reject(new Error(NOT_CONFIGURED));
  }
}
