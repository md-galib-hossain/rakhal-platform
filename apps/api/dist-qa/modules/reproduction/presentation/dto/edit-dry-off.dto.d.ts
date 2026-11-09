import { DryOffReason } from '@prisma/client';
export declare class EditDryOffDto {
    cattleId?: string;
    dryOffDate?: string;
    notes?: string;
    reason?: DryOffReason;
}
