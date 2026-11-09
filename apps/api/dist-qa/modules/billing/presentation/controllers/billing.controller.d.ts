import type { Response } from 'express';
import { BillingService } from '../../application/services/billing.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { ListInvoiceQueryDto } from '../dto/list-invoice-query.dto';
import { RefundInvoiceDto } from '../dto/refund-invoice.dto';
import { UpdateBillingProfileDto } from '../dto/update-billing-profile.dto';
import { PreviewCheckoutDto } from '../dto/preview-checkout.dto';
import { ScheduleDowngradeDto } from '../dto/schedule-downgrade.dto';
export declare class BillingController {
    private readonly billing;
    constructor(billing: BillingService);
    checkout(farmId: string, userId: string, dto: CheckoutDto, idempotencyKey?: string): Promise<{
        invoice: import("../../application/services/billing.service").PublicInvoice;
        checkout: null;
        idempotent: boolean;
    } | {
        invoice: import("../../application/services/billing.service").PublicInvoice;
        checkout: {
            provider: import("@prisma/client").$Enums.PaymentGateway;
            provider_payment_id: string;
            redirect_url: string | null;
            provider_configured?: undefined;
            initiation_failed?: undefined;
        };
        idempotent: boolean;
    } | {
        invoice: import("../../application/services/billing.service").PublicInvoice;
        checkout: {
            provider_configured: boolean;
            initiation_failed: boolean;
            provider?: undefined;
            provider_payment_id?: undefined;
            redirect_url?: undefined;
        };
        idempotent: boolean;
    } | {
        invoice: import("../../application/services/billing.service").PublicInvoice;
        checkout: {
            provider_configured: boolean;
            provider?: undefined;
            provider_payment_id?: undefined;
            redirect_url?: undefined;
            initiation_failed?: undefined;
        };
        idempotent: boolean;
    }>;
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
    scheduleDowngrade(farmId: string, userId: string, dto: ScheduleDowngradeDto): Promise<import("../../application/services/billing.service").PublicSubscriptionSchedule>;
    cancelScheduledDowngrade(farmId: string, userId: string): Promise<void>;
    list(farmId: string, query: ListInvoiceQueryDto): Promise<import("../../../../common/pagination").CursorPage<import("../../application/services/billing.service").PublicInvoice>>;
    getOne(farmId: string, id: string): Promise<import("../../application/services/billing.service").PublicInvoice>;
    receipt(farmId: string, id: string, res: Response): Promise<void>;
    refund(farmId: string, userId: string, id: string, dto: RefundInvoiceDto): Promise<import("../../application/services/billing.service").PublicInvoice>;
}
