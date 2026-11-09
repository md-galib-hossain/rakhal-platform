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
export interface PaymentProvider {
    readonly gateway: PaymentGateway;
    isConfigured(): boolean;
    createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
    executePayment(providerPaymentId: string, idempotencyKey: string): Promise<PaymentExecutionResult>;
    queryPayment(providerPaymentId: string): Promise<PaymentExecutionResult>;
    refund(input: RefundInput): Promise<RefundResult>;
}
export declare const PAYMENT_PROVIDER: unique symbol;
