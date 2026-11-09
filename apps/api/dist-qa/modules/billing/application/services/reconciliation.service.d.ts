import { ReconciliationStatus, ReconciliationType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { type PaymentProvider } from '../ports/payment-provider.port';
export declare class ReconciliationService {
    private readonly prisma;
    private readonly provider;
    private readonly log;
    constructor(prisma: PrismaService, provider: PaymentProvider, logger: LoggerService);
    runReconciliation(now?: Date, lookbackDays?: number): Promise<{
        checked: number;
        flagged: number;
        skipped?: string;
    }>;
    private raise;
    list(filters: {
        status?: ReconciliationStatus;
        type?: ReconciliationType;
    }): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.ReconciliationType;
        status: import("@prisma/client").$Enums.ReconciliationStatus;
        payment_id: string | null;
        invoice_id: string | null;
        farm_id: string | null;
        provider_payment_id: string | null;
        expected_amount: number | null;
        actual_amount: number | null;
        detail: string | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        resolution_note: string | null;
        created_at: string;
    }[]>;
    resolve(id: string, adminId: string, status: ReconciliationStatus, note?: string): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.ReconciliationType;
        status: import("@prisma/client").$Enums.ReconciliationStatus;
        payment_id: string | null;
        invoice_id: string | null;
        farm_id: string | null;
        provider_payment_id: string | null;
        expected_amount: number | null;
        actual_amount: number | null;
        detail: string | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        resolution_note: string | null;
        created_at: string;
    }>;
    private present;
}
