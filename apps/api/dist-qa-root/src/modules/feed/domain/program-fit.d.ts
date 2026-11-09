export type FitSeverity = 'ok' | 'warn' | 'bad';
export interface FitBands {
    dmBelowPct: number;
    dmAbovePct: number;
    cpBelowPct: number;
    cpAbovePct: number;
    meBelowPct: number;
    meAbovePct: number;
}
export interface NutrientAmounts {
    dmKg: number;
    cpKg: number;
    meMj: number;
}
export interface NutrientFit {
    deltaPct: number | null;
    severity: FitSeverity;
}
export interface ProgramFit {
    dm: NutrientFit;
    cp: NutrientFit;
    me: NutrientFit;
    severity: FitSeverity;
    estimated: boolean;
}
export declare function classifyDelta(supply: number, requirement: number, belowPct: number, abovePct: number): NutrientFit;
export declare function computeProgramFit(supply: NutrientAmounts, requirement: NutrientAmounts, bands: FitBands, estimated: boolean): ProgramFit;
export declare function remainingRequirement(requirement: NutrientAmounts, fed: NutrientAmounts): NutrientAmounts;
export declare function computeRemainingFit(supply: NutrientAmounts, requirement: NutrientAmounts, fed: NutrientAmounts, bands: FitBands, estimated: boolean): ProgramFit;
export declare function toApiFit(f: ProgramFit): {
    severity: FitSeverity;
    estimated: boolean;
    dm: {
        delta_pct: number | null;
        severity: FitSeverity;
    };
    cp: {
        delta_pct: number | null;
        severity: FitSeverity;
    };
    me: {
        delta_pct: number | null;
        severity: FitSeverity;
    };
};
export declare function bandsFromSettings(s: {
    alertDryMatterBelowPct: number;
    alertDryMatterAbovePct: number;
    alertProteinBelowPct: number;
    alertProteinAbovePct: number;
    alertEnergyBelowPct: number;
    alertEnergyAbovePct: number;
}): FitBands;
