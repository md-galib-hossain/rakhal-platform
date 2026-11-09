import { ReconciliationStatus, ReconciliationType } from '@prisma/client';
export declare class ListReconciliationQueryDto {
    status?: ReconciliationStatus;
    type?: ReconciliationType;
}
export declare class ResolveReconciliationDto {
    status: ReconciliationStatus;
    note?: string;
}
