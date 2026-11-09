import type { Request } from 'express';
import { RequirementSettingsService } from 'src/modules/feed/application/services/requirement-settings.service';
import { CreateRequirementPresetDto, UpdateRequirementPresetDto } from '../dto/requirement-preset.dto';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';
export declare class AdminRequirementPresetController {
    private readonly settings;
    private readonly audit;
    constructor(settings: RequirementSettingsService, audit: AdminAuditService);
    list(): Promise<{
        presets: {
            id: string;
            name: string;
            description: string | null;
            version: number;
            settings: unknown;
            effective: import("../../../feed/domain/requirement-settings").RequirementSettings;
            is_active: boolean;
            effective_from: Date;
            created_by_admin_id: string | null;
            created_at: Date;
        }[];
        built_in_defaults: import("../../../feed/domain/requirement-settings").RequirementSettings;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../../feed/domain/requirement-settings").RequirementSettingField>;
    }>;
    create(admin: CurrentAdminContext, dto: CreateRequirementPresetDto, req: Request): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: import("../../../feed/domain/requirement-settings").RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    update(admin: CurrentAdminContext, id: string, dto: UpdateRequirementPresetDto, req: Request): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: import("../../../feed/domain/requirement-settings").RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    activate(admin: CurrentAdminContext, id: string, req: Request): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        settings: unknown;
        effective: import("../../../feed/domain/requirement-settings").RequirementSettings;
        is_active: boolean;
        effective_from: Date;
        created_by_admin_id: string | null;
        created_at: Date;
    }>;
    farmSettings(farmId: string): Promise<{
        effective: import("../../../feed/domain/requirement-settings").RequirementSettings;
        defaults: import("../../../feed/domain/requirement-settings").RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<import("../../../feed/domain/requirement-settings").RequirementSettings>;
        sources: Record<string, import("src/modules/feed/application/services/requirement-settings.service").RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../../feed/domain/requirement-settings").RequirementSettingField>;
    }>;
}
