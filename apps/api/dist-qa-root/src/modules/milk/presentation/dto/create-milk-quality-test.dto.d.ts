import { MilkQualityTestSource } from '@prisma/client';
export declare class CreateMilkQualityTestDto {
    cattleId: string;
    lactationId: string;
    sampleDate: string;
    fatPct: number;
    proteinPct: number;
    lactosePct?: number;
    somaticCellCount?: number;
    milkUreaNitrogen?: number;
    source: MilkQualityTestSource;
    notes?: string;
}
