import { BillingPeriod, InvoiceStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { type PaymentProvider } from '../ports/payment-provider.port';
import { CheckoutDto } from '../../presentation/dto/checkout.dto';
import { ScheduleDowngradeDto } from '../../presentation/dto/schedule-downgrade.dto';
import { UpdateBillingProfileDto } from '../../presentation/dto/update-billing-profile.dto';
import { PreviewCheckoutDto } from '../../presentation/dto/preview-checkout.dto';
import { ListInvoiceQueryDto } from '../../presentation/dto/list-invoice-query.dto';
import { CouponService } from './coupon.service';
import { ReferralService } from './referral.service';
import { CreditWalletService } from './credit-wallet.service';
import { ReceiptService, type RenderedReceipt } from './receipt.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
export interface PublicSubscriptionSchedule {
    pending_plan_id: string;
    pending_plan_name: string;
    pending_billing_period: BillingPeriod;
    effective_at: string;
}
export interface PublicInvoice {
    id: string;
    invoice_number: string | null;
    plan_id: string;
    billing_period: BillingPeriod;
    currency: string;
    subtotal: number;
    discount_total: number;
    referral_credit_applied: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    status: InvoiceStatus;
    paid_at: string | null;
    created_at: string;
}
export declare class BillingService {
    private readonly prisma;
    private readonly audit;
    private readonly lifecycle;
    private readonly coupons;
    private readonly referrals;
    private readonly creditWallet;
    private readonly receipts;
    private readonly legal;
    private readonly txEmail;
    private readonly provider;
    private readonly log;
    constructor(prisma: PrismaService, audit: AuditService, lifecycle: SubscriptionLifecycleService, coupons: CouponService, referrals: ReferralService, creditWallet: CreditWalletService, receipts: ReceiptService, legal: LegalConsentService, txEmail: TransactionalEmailService, provider: PaymentProvider, logger: LoggerService);
    checkout(farmId: string, userId: string, dto: CheckoutDto, idempotencyKey?: string): Promise<{
        invoice: PublicInvoice;
        checkout: null;
        idempotent: boolean;
    } | {
        invoice: PublicInvoice;
        checkout: {
            provider: import("@prisma/client").$Enums.PaymentGateway;
            provider_payment_id: string;
            redirect_url: string | null;
            provider_configured?: undefined;
            initiation_failed?: undefined;
        };
        idempotent: boolean;
    } | {
        invoice: PublicInvoice;
        checkout: {
            provider_configured: boolean;
            initiation_failed: boolean;
            provider?: undefined;
            provider_payment_id?: undefined;
            redirect_url?: undefined;
        };
        idempotent: boolean;
    } | {
        invoice: PublicInvoice;
        checkout: {
            provider_configured: boolean;
            provider?: undefined;
            provider_payment_id?: undefined;
            redirect_url?: undefined;
            initiation_failed?: undefined;
        };
        idempotent: boolean;
    }>;
    listInvoices(farmId: string, query: ListInvoiceQueryDto): Promise<CursorPage<PublicInvoice>>;
    getInvoice(farmId: string, id: string): Promise<PublicInvoice>;
    finalizePayment(providerPaymentId: string): Promise<{
        status: 'PAID' | 'FAILED' | 'ALREADY_PAID' | 'UNKNOWN';
    }>;
    refundInvoice(farmId: string, invoiceId: string, actorUserId: string, reason?: string): Promise<PublicInvoice>;
    private failPayment;
    private buildInvoiceData;
    getReceipt(farmId: string, invoiceId: string): Promise<RenderedReceipt>;
    previewCheckout(farmId: string, userId: string, dto: PreviewCheckoutDto): Promise<{
        plan_id: string;
        billing_period: import("@prisma/client").$Enums.BillingPeriod;
        currency: string;
        subtotal: number;
        discount_total: number;
        estimated_credit_applied: number;
        tax_rate: number;
        tax_amount: number;
        total: number;
    }>;
    updateProfile(farmId: string, dto: UpdateBillingProfileDto): Promise<{
        farm_id: string;
        farm_name: string;
        phone: string | null;
        address: string | null;
    }>;
    scheduleDowngrade(farmId: string, userId: string, dto: ScheduleDowngradeDto): Promise<PublicSubscriptionSchedule>;
    cancelScheduledDowngrade(farmId: string, userId: string): Promise<void>;
    private farmOwnerId;
    private present;
}
