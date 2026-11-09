import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreatePaymentInput, CreatePaymentResult, PaymentExecutionResult, PaymentProvider, RefundInput, RefundResult } from '../ports/payment-provider.port';
import { BkashTokenService } from '../services/bkash-token.service';
export declare class BkashPaymentProvider implements PaymentProvider {
    private readonly tokens;
    readonly gateway: "BKASH";
    private readonly log;
    constructor(tokens: BkashTokenService, logger: LoggerService);
    isConfigured(): boolean;
    createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
    executePayment(providerPaymentId: string): Promise<PaymentExecutionResult>;
    queryPayment(providerPaymentId: string): Promise<PaymentExecutionResult>;
    refund(input: RefundInput): Promise<RefundResult>;
    private mapStatus;
    private post;
}
