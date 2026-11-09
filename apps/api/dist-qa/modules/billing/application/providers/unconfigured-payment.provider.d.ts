import { CreatePaymentResult, PaymentExecutionResult, PaymentProvider, RefundResult } from '../ports/payment-provider.port';
export declare class UnconfiguredPaymentProvider implements PaymentProvider {
    readonly gateway: "NONE";
    isConfigured(): boolean;
    createPayment(): Promise<CreatePaymentResult>;
    executePayment(): Promise<PaymentExecutionResult>;
    queryPayment(): Promise<PaymentExecutionResult>;
    refund(): Promise<RefundResult>;
}
