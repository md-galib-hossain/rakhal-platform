import { RequirementSettings } from './requirement-settings';
export type AnimalType = 'COW' | 'HEIFER' | 'DRY';
export interface RequirementsInput {
    weightKg: number;
    milkTargetL: number;
    milkFatPct?: number;
    milkProteinPct?: number;
    gestationDays?: number;
    bcs?: number;
    dim?: number;
    animalType?: AnimalType;
}
export interface RequirementsBreakdown {
    dm: {
        lactation: number;
        pregnancy: number;
        heiferGrowth: number;
        bcsAdjustment: number;
    };
    me: {
        maintenance: number;
        milk: number;
        pregnancy: number;
        heiferGrowth: number;
    };
    cp: {
        maintenance: number;
        milk: number;
        pregnancy: number;
        heiferGrowth: number;
    };
}
export interface Requirements {
    dmKg: number;
    cpKg: number;
    meMj: number;
    ndfKg: number;
    fatKg: number;
    neMcal: number;
    energyDensityMjPerKgDm: number;
    cpPctOfDm: number;
    tdnKg: number;
    calciumKg: number | null;
    phosphorusKg: number | null;
    adfKg: number;
    rdpPct: number;
    rupPct: number;
    ndfMaxKg: number;
    caPRatioTarget: number;
    breakdown: RequirementsBreakdown | null;
}
export declare const MJ_PER_MCAL = 4.184;
export declare function computeRequirements(input: RequirementsInput, settings?: RequirementSettings): Requirements;
