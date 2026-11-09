import type { Request } from 'express';
import { ReconciliationService } from 'src/modules/billing/application/services/reconciliation.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import { ListReconciliationQueryDto, ResolveReconciliationDto } from '../dto/reconciliation.dto';
export declare class AdminReconciliationController {
    private readonly reconciliation;
    private readonly audit;
    constructor(reconciliation: ReconciliationService, audit: AdminAuditService);
    list(query: ListReconciliationQueryDto): Promise<{
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
    run(admin: CurrentAdminContext, req: Request): Promise<{
        checked: number;
        flagged: number;
        skipped?: string;
    }>;
    resolve(admin: CurrentAdminContext, id: string, dto: ResolveReconciliationDto, req: Request): Promise<{
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
}
