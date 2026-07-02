import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '@prisma/client';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { env } from 'src/core/config/env';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentExecutionResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from '../ports/payment-provider.port';
import { BkashTokenService } from '../services/bkash-token.service';

/** Loosely-typed bKash Tokenized-Checkout response (fields vary per endpoint). */
interface BkashResponse {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  bkashURL?: string;
  trxID?: string;
  refundTrxID?: string;
  transactionStatus?: string;
  amount?: string;
}

/**
 * bKash Tokenized Checkout adapter (RAKHAL-221, PRD §32.3) — the first
 * `PaymentProvider`. Talks the v1.2 API directly (no SDK); token from
 * `BkashTokenService`. Backend-to-backend only. `isConfigured()` gates whether
 * the billing module uses this or the no-op provider.
 */
@Injectable()
export class BkashPaymentProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.BKASH;
  private readonly log: LoggerService;

  constructor(
    private readonly tokens: BkashTokenService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BkashPaymentProvider.name);
  }

  isConfigured(): boolean {
    return Boolean(
      env.BKASH_BASE_URL &&
      env.BKASH_APP_KEY &&
      env.BKASH_APP_SECRET &&
      env.BKASH_USERNAME &&
      env.BKASH_PASSWORD,
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const body = await this.post('/tokenized/checkout/create', {
      mode: '0011',
      payerReference: input.farmId,
      callbackURL: env.BKASH_CALLBACK_URL ?? '',
      amount: input.amount.toString(),
      currency: input.currency,
      intent: 'sale',
      merchantInvoiceNumber: input.invoiceId,
    });
    if (!body.paymentID) {
      throw new Error(
        `bKash create failed: ${body.statusMessage ?? body.statusCode ?? 'unknown'}`,
      );
    }
    return {
      providerPaymentId: body.paymentID,
      redirectUrl: body.bkashURL ?? null,
    };
  }

  async executePayment(
    providerPaymentId: string,
  ): Promise<PaymentExecutionResult> {
    const body = await this.post('/tokenized/checkout/execute', {
      paymentID: providerPaymentId,
    });
    return this.mapStatus(body);
  }

  async queryPayment(
    providerPaymentId: string,
  ): Promise<PaymentExecutionResult> {
    const body = await this.post('/tokenized/checkout/payment/status', {
      paymentID: providerPaymentId,
    });
    return this.mapStatus(body);
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const body = await this.post('/tokenized/checkout/payment/refund', {
      paymentID: input.providerPaymentId,
      amount: input.amount.toString(),
      reason: input.reason ?? 'refund',
      sku: 'subscription',
    });
    return {
      refundTrxId: body.refundTrxID ?? body.trxID ?? '',
      status: body.transactionStatus ?? body.statusCode ?? 'unknown',
    };
  }

  private mapStatus(body: BkashResponse): PaymentExecutionResult {
    const ts = body.transactionStatus;
    const status: PaymentExecutionResult['status'] =
      ts === 'Completed'
        ? 'COMPLETED'
        : ts === 'Initiated'
          ? 'PENDING'
          : 'FAILED';
    return {
      status,
      providerTrxId: body.trxID ?? null,
      amount: body.amount != null ? Number(body.amount) : null,
    };
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<BkashResponse> {
    const token = await this.tokens.getToken();
    const res = await fetch(`${env.BKASH_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        authorization: token,
        'x-app-key': env.BKASH_APP_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as BkashResponse;
  }
}
