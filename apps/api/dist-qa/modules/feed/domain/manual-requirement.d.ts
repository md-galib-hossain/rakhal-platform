import { type AnimalType, type Requirements } from './requirements';
import type { RequirementSettings } from './requirement-settings';
export interface ManualRequirementValues {
    dmKg: number;
    cpKg: number;
    meMj: number;
    ndfKg?: number | null;
    ndfMaxKg?: number | null;
    adfKg?: number | null;
    fatKg?: number | null;
    tdnKg?: number | null;
    calciumKg?: number | null;
    phosphorusKg?: number | null;
    rdpPct?: number | null;
    rupPct?: number | null;
}
export declare function requirementsFromManual(manual: ManualRequirementValues, settings: RequirementSettings): Requirements;
export interface ManualValidationIssue {
    field: string;
    code: string;
    message: string;
}
export interface ManualValidation {
    errors: ManualValidationIssue[];
    warnings: ManualValidationIssue[];
}
export declare function validateManualValues(v: ManualRequirementValues, weightKg?: number | null): ManualValidation;
export interface ManualDynamicSnapshot {
    dm_kg: number;
    cp_kg: number;
    me_mj: number;
    animal_type: AnimalType;
    inputs?: Record<string, unknown>;
}
export interface ManualStaleness {
    stale: boolean;
    drift: {
        dm_pct: number;
        cp_pct: number;
        me_pct: number;
    };
    animal_type_changed: boolean;
}
export declare function isManualStale(snapshot: ManualDynamicSnapshot, dynamicNow: {
    dmKg: number;
    cpKg: number;
    meMj: number;
}, animalTypeNow: AnimalType, driftPctLimit: number): ManualStaleness;
