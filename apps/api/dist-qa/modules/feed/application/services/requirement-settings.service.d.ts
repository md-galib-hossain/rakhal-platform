import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CacheService } from 'src/core/cache';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { RequirementSettings, RequirementSettingsChanges } from '../../domain/requirement-settings';
export type RequirementSettingSource = 'farm' | 'preset' | 'default';
export declare class RequirementSettingsService {
    private readonly prisma;
    private readonly cache;
    private readonly audit;
    private readonly log;
    constructor(prisma: PrismaService, cache: CacheService, audit: AuditService, logger: LoggerService);
    resolve(farmId: string): Promise<RequirementSettings>;
    describe(farmId: string): Promise<{
        effective: RequirementSettings;
        defaults: RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<RequirementSettings>;
        sources: Record<string, RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    saveFarmChanges(farmId: string, userId: string, changes: RequirementSettingsChanges, notes?: string): Promise<{
        effective: RequirementSettings;
        defaults: RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<RequirementSettings>;
        sources: Record<string, RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    resetFarmChanges(farmId: string, userId: string): Promise<{
        effective: RequirementSettings;
        defaults: RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<RequirementSettings>;
        sources: Record<string, RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    invalidateFarm(farmId: string): Promise<void>;
    invalidateAll(): Promise<void>;
    listPresets(): Promise<{
        presets: {
            id: string;
            name: string;
            description: string | null;
            version: number;
            settings: unknown;
            effective: RequirementSettings;
            is_active: boolean;
            effective_from: Date;
            created_by_admin_id: string | null;
            created_at: Date;
        }[];
        built_in_defaults: RequirementSettings;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    createPreset(adminId: string, input: {
        name: string;
        description?: string;
        settings: RequirementSettingsChanges;
        effectiveFrom?: Date;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    updatePreset(adminId: string, presetId: string, input: {
        name?: string;
        description?: string;
        settings?: RequirementSettingsChanges;
    }): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    activatePreset(adminId: string, presetId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    farmSettingsForAdmin(farmId: string): Promise<{
        effective: RequirementSettings;
        defaults: RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<RequirementSettings>;
        sources: Record<string, RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    private assertValid;
    private getPresetOrThrow;
    private mapPreset;
    private cacheKey;
    private activePreset;
    private load;
    private cleanChanges;
    private buildSources;
}
