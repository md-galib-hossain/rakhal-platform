export interface PregnancyIntakeStage {
    untilDay: number;
    percentOfBodyWeight: number;
}
export interface RequirementSettings {
    maintenanceEnergyPerMetabolicKg: number;
    energyPerLitreMilk: number;
    energyPerMilkFatPercent: number;
    netEnergyEfficiency: number;
    maintenanceProteinPerMetabolicKg: number;
    proteinPerLitreMilk: number;
    degradableProteinShare: number;
    undegradableProteinShare: number;
    intakeFromMilkFactor: number;
    intakeFromBodyWeightFactor: number;
    intakeCurveSteepness: number;
    intakeCurveOffset: number;
    defaultDaysInMilk: number;
    defaultWeightKg: number;
    alertDryMatterBelowPct: number;
    alertDryMatterAbovePct: number;
    alertProteinBelowPct: number;
    alertProteinAbovePct: number;
    alertEnergyBelowPct: number;
    alertEnergyAbovePct: number;
    manualOverrideDriftPct: number;
    lookaheadDays: number;
    pregnancyIntakeStages: PregnancyIntakeStage[];
    pregnancyLengthDays: number;
    pregnancyPeakEnergy: number;
    pregnancyPeakProtein: number;
    heiferIntakePercentOfBodyWeight: number;
    heiferGrowthEnergy: number;
    heiferGrowthProtein: number;
    targetBodyCondition: number;
    energyAdjustPerBodyConditionStep: number;
    intakeAdjustPerBodyConditionPoint: number;
    tdnShareOfIntake: number;
    adfShareOfIntake: number;
    ndfMinShareOfIntake: number;
    ndfMaxShareOfIntake: number;
    fatShareOfIntake: number;
    calciumPerBodyWeightKg: number;
    calciumPerLitreMilk: number;
    phosphorusPerBodyWeightKg: number;
    phosphorusPerLitreMilk: number;
    calciumToPhosphorusTarget: number;
}
export type RequirementSettingsChanges = Partial<RequirementSettings>;
export declare const DEFAULT_REQUIREMENT_SETTINGS: RequirementSettings;
export type RequirementSettingGroup = 'energy' | 'protein' | 'intake' | 'alerts' | 'pregnancy' | 'heifer' | 'bodyCondition' | 'mineralsAndFibre';
export interface RequirementSettingField {
    group: RequirementSettingGroup;
    label: string;
    unit: string;
    min: number;
    max: number;
}
export declare const REQUIREMENT_SETTING_FIELDS: Record<Exclude<keyof RequirementSettings, 'pregnancyIntakeStages'>, RequirementSettingField>;
export declare const REQUIREMENT_SETTING_KEYS: (keyof RequirementSettings)[];
export interface RequirementSettingIssue {
    field: string;
    message: string;
}
export declare function validateSettings(changes: unknown): RequirementSettingIssue[];
export declare function mergeSettings(base: RequirementSettings, changes: RequirementSettingsChanges | null | undefined): RequirementSettings;
export declare function parseSettings(stored: unknown, base?: RequirementSettings): RequirementSettings;
