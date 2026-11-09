import { DryOffReason } from '@prisma/client';
export declare class CreateDryOffDto {
    dryOffDate?: string;
    notes?: string;
    reason?: DryOffReason;
}
