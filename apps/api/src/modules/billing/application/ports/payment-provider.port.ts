import { PaymentGateway } from '@prisma/client';

export interface CreatePaymentInput {
  invoiceId: string;
  farmId: string;
  amount: number;
  currency: string;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  redirectUrl?: string | null;
}

export interface PaymentExecutionResult {
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  providerTrxId?: string | null;
  amount?: number | null;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  refundTrxId: string;
  status: string;
}

/**
 * Gateway-agnostic payment port (PRD §32.2). **bKash** is the first adapter
 * (RAKHAL-221); swapping/adding a gateway (SSLCommerz, Nagad) must touch only one
 * adapter + config, never the billing service. All calls are backend-to-backend.
 */
export interface PaymentProvider {
  readonly gateway: PaymentGateway;

  /** True when the adapter has the credentials/config it needs to charge. */
  isConfigured(): boolean;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Idempotent on `idempotencyKey` — a re-execute must not double-charge. */
  executePayment(
    providerPaymentId: string,
    idempotencyKey: string,
  ): Promise<PaymentExecutionResult>;

  /** Source-of-truth reconciliation query (used by the sweep, RAKHAL-239). */
  queryPayment(providerPaymentId: string): Promise<PaymentExecutionResult>;

  refund(input: RefundInput): Promise<RefundResult>;
}

/** DI token for the active payment provider (config-selected). */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
