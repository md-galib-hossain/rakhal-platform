import { FeedConcentrationService } from '../../application/services/feed-concentration.service';
import { FeedIngredientService } from '../../application/services/feed-ingredient.service';
import { FeedRequirementsService } from '../../application/services/feed-requirements.service';
import { RequirementSettingsService } from '../../application/services/requirement-settings.service';
import { FeedDistributionService } from '../../application/services/feed-distribution.service';
import { FeedStockService } from '../../application/services/feed-stock.service';
import { FeedRationResolverService } from '../../application/services/feed-ration-resolver.service';
import { BulkDeleteStockDto } from '../dto/bulk-delete-stock.dto';
import { BulkDeleteConcentrationDto, CreateConcentrationDto, FinalizeConcentrationDto, ListConcentrationsQueryDto, NormalizeConcentrationDto, UpdateConcentrationDto } from '../dto/concentration.dto';
import { ListIngredientsQueryDto } from '../dto/list-ingredients-query.dto';
import { ListFeedStockQueryDto } from '../dto/list-feed-stock-query.dto';
import { FeedRequirementsQueryDto } from '../dto/feed-requirements-query.dto';
import { UpdateRequirementSettingsDto } from '../dto/update-requirement-settings.dto';
import { SetFeedOverrideDto } from '../dto/set-feed-override.dto';
import { CreateCustomIngredientDto } from '../dto/create-custom-ingredient.dto';
import { UpdateCustomIngredientDto } from '../dto/update-custom-ingredient.dto';
import { LogDistributionDto } from '../dto/log-distribution.dto';
import { PatchRefusalDto } from '../dto/patch-refusal.dto';
import { UpdateStockNutritionDto } from '../dto/update-stock-nutrition.dto';
import { FeedGridCalendarQueryDto } from '../dto/feed-grid-calendar-query.dto';
import { FeedEfficiencyQueryDto, ListDistributionQueryDto } from '../dto/list-distribution-query.dto';
import { FeedGridQueryDto } from '../dto/feed-grid-query.dto';
import { SaveFeedDraftDto } from '../dto/save-feed-draft.dto';
import { ConfirmFeedDraftDto } from '../dto/confirm-feed-draft.dto';
import { FeedCattleHistoryQueryDto } from '../dto/feed-cattle-history-query.dto';
import { VoidFeedCattleItemDto } from '../dto/void-feed-cattle-item.dto';
import { FeedFeedingGridService } from '../../application/services/feed-feeding-grid.service';
import { FeedPlanService } from '../../application/services/feed-plan.service';
export declare class FeedController {
    private readonly ingredients;
    private readonly requirements;
    private readonly requirementSettings;
    private readonly concentrations;
    private readonly distributions;
    private readonly stock;
    private readonly rationResolver;
    private readonly feedingGrid;
    private readonly plans;
    constructor(ingredients: FeedIngredientService, requirements: FeedRequirementsService, requirementSettings: RequirementSettingsService, concentrations: FeedConcentrationService, distributions: FeedDistributionService, stock: FeedStockService, rationResolver: FeedRationResolverService, feedingGrid: FeedFeedingGridService, plans: FeedPlanService);
    listIngredients(farmId: string, query: ListIngredientsQueryDto): Promise<{
        id: string;
        name_en: string;
        name_bn: string | null;
        feed_class: import("@prisma/client").$Enums.FeedClass;
        feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
        nutrient_group: import("@prisma/client").$Enums.FeedNutrientGroup | null;
        is_custom: boolean;
        nutrition_source: string | null;
        nutrition_source_type: import("../../domain/ingredient-resolver").NutritionSource;
        source_ref: string | null;
        rakhal_price_per_kg: number;
        price_updated_at: Date | null;
        effective_price_per_kg: number;
        price_source: import("../../domain/ingredient-resolver").PriceSource;
        has_nutrition_override: boolean;
        is_available_bd: boolean;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number;
            ndf_pct: number;
            rdp_pct: number;
            rup_pct: number;
            starch_pct: number;
            adf_pct: number;
            calcium_pct: number;
            phosphorus_pct: number;
            tdn_pct: number;
        };
        override_notes: string | null;
    }[]>;
    listIngredientsPaged(farmId: string, query: ListIngredientsQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        id: string;
        name_en: string;
        name_bn: string | null;
        feed_class: import("@prisma/client").$Enums.FeedClass;
        feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
        nutrient_group: import("@prisma/client").$Enums.FeedNutrientGroup | null;
        is_custom: boolean;
        nutrition_source: string | null;
        nutrition_source_type: import("../../domain/ingredient-resolver").NutritionSource;
        source_ref: string | null;
        rakhal_price_per_kg: number;
        price_updated_at: Date | null;
        effective_price_per_kg: number;
        price_source: import("../../domain/ingredient-resolver").PriceSource;
        has_nutrition_override: boolean;
        is_available_bd: boolean;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number;
            ndf_pct: number;
            rdp_pct: number;
            rup_pct: number;
            starch_pct: number;
            adf_pct: number;
            calcium_pct: number;
            phosphorus_pct: number;
            tdn_pct: number;
        };
        override_notes: string | null;
    }>>;
    createCustomIngredient(farmId: string, userId: string, dto: CreateCustomIngredientDto): Promise<{
        id: string;
        name_en: string;
        name_bn: string | null;
        feed_class: import("@prisma/client").$Enums.FeedClass;
        feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
        nutrient_group: import("@prisma/client").$Enums.FeedNutrientGroup | null;
        is_custom: boolean;
        nutrition_source: string | null;
        nutrition_source_type: import("../../domain/ingredient-resolver").NutritionSource;
        source_ref: string | null;
        rakhal_price_per_kg: number;
        price_updated_at: Date | null;
        effective_price_per_kg: number;
        price_source: import("../../domain/ingredient-resolver").PriceSource;
        has_nutrition_override: boolean;
        is_available_bd: boolean;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number;
            ndf_pct: number;
            rdp_pct: number;
            rup_pct: number;
            starch_pct: number;
            adf_pct: number;
            calcium_pct: number;
            phosphorus_pct: number;
            tdn_pct: number;
        };
        override_notes: string | null;
    }>;
    updateCustomIngredient(farmId: string, id: string, dto: UpdateCustomIngredientDto): Promise<{
        id: string;
        name_en: string;
        name_bn: string | null;
        feed_class: import("@prisma/client").$Enums.FeedClass;
        feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
        nutrient_group: import("@prisma/client").$Enums.FeedNutrientGroup | null;
        is_custom: boolean;
        nutrition_source: string | null;
        nutrition_source_type: import("../../domain/ingredient-resolver").NutritionSource;
        source_ref: string | null;
        rakhal_price_per_kg: number;
        price_updated_at: Date | null;
        effective_price_per_kg: number;
        price_source: import("../../domain/ingredient-resolver").PriceSource;
        has_nutrition_override: boolean;
        is_available_bd: boolean;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number;
            ndf_pct: number;
            rdp_pct: number;
            rup_pct: number;
            starch_pct: number;
            adf_pct: number;
            calcium_pct: number;
            phosphorus_pct: number;
            tdn_pct: number;
        };
        override_notes: string | null;
    }>;
    deactivateCustomIngredient(farmId: string, id: string): Promise<{
        id: string;
        name_en: string;
        name_bn: string | null;
        feed_class: import("@prisma/client").$Enums.FeedClass;
        feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
        nutrient_group: import("@prisma/client").$Enums.FeedNutrientGroup | null;
        is_custom: boolean;
        nutrition_source: string | null;
        nutrition_source_type: import("../../domain/ingredient-resolver").NutritionSource;
        source_ref: string | null;
        rakhal_price_per_kg: number;
        price_updated_at: Date | null;
        effective_price_per_kg: number;
        price_source: import("../../domain/ingredient-resolver").PriceSource;
        has_nutrition_override: boolean;
        is_available_bd: boolean;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number;
            ndf_pct: number;
            rdp_pct: number;
            rup_pct: number;
            starch_pct: number;
            adf_pct: number;
            calcium_pct: number;
            phosphorus_pct: number;
            tdn_pct: number;
        };
        override_notes: string | null;
    }>;
    setOverride(farmId: string, userId: string, id: string, dto: SetFeedOverrideDto): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        createdBy: string;
        customDmPct: number | null;
        customCpPct: number | null;
        customMeMjPerKgDm: number | null;
        customFatPct: number | null;
        customNdfPct: number | null;
        customAdfPct: number | null;
        customRdpPct: number | null;
        customRupPct: number | null;
        customStarchPct: number | null;
        customCalciumPct: number | null;
        customPhosphorusPct: number | null;
        customTdnPct: number | null;
        customPricePerKg: number | null;
        nutritionSource: import("@prisma/client").$Enums.NutritionSource | null;
        sourceRef: string | null;
        ingredientId: string;
    }>;
    resetOverride(farmId: string, id: string): Promise<{
        ingredient_id: string;
        price_source: string;
    }>;
    getRequirements(farmId: string, query: FeedRequirementsQueryDto): Promise<{
        dynamic_requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            ne_mcal: number;
            energy_density_mj_per_kg_dm: number;
            cp_pct_of_dm: number;
            tdn_kg: number;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            adf_kg: number;
            rdp_pct: number;
            rup_pct: number;
            ndf_max_kg: number;
            ca_p_ratio_target: number;
            breakdown: {
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
            } | null;
        };
        manual: import("../../application/services/feed-requirements.service").ManualInfo | null;
        source: "MANUAL" | "DYNAMIC";
        inputs: {
            weight_kg: number;
            milk_target_l: number;
            milk_fat_pct: number;
            gestation_days: number | undefined;
            bcs: number | undefined;
            dim: number | undefined;
            animal_type: import("../../domain/requirements").AnimalType;
        };
        data_source: {
            weight: string;
            milk_yield: string;
            dim: string;
        };
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            ne_mcal: number;
            energy_density_mj_per_kg_dm: number;
            cp_pct_of_dm: number;
            tdn_kg: number;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            adf_kg: number;
            rdp_pct: number;
            rup_pct: number;
            ndf_max_kg: number;
            ca_p_ratio_target: number;
            breakdown: {
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
            } | null;
        };
    } | {
        dynamic_requirements?: undefined;
        manual?: undefined;
        source: "MANUAL" | "DYNAMIC";
        inputs: {
            weight_kg: number;
            milk_target_l: number;
            milk_fat_pct: number;
            gestation_days: number | undefined;
            bcs: number | undefined;
            dim: number | undefined;
            animal_type: import("../../domain/requirements").AnimalType;
        };
        data_source: {
            weight: string;
            milk_yield: string;
            dim: string;
        };
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            ne_mcal: number;
            energy_density_mj_per_kg_dm: number;
            cp_pct_of_dm: number;
            tdn_kg: number;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            adf_kg: number;
            rdp_pct: number;
            rup_pct: number;
            ndf_max_kg: number;
            ca_p_ratio_target: number;
            breakdown: {
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
            } | null;
        };
    } | {
        inputs: {
            weight_kg: number;
            milk_target_l: number;
            milk_fat_pct: number;
            milk_protein_pct: number | undefined;
            gestation_days: number | undefined;
            bcs: number | undefined;
            dim: number | undefined;
            animal_type: import("../../domain/requirements").AnimalType;
        };
        data_source: {
            weight: string;
            milk_yield: string;
        };
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            ne_mcal: number;
            energy_density_mj_per_kg_dm: number;
            cp_pct_of_dm: number;
            tdn_kg: number;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            adf_kg: number;
            rdp_pct: number;
            rup_pct: number;
            ndf_max_kg: number;
            ca_p_ratio_target: number;
            breakdown: {
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
            } | null;
        };
    }> | Promise<{
        date: string;
        cows: ({
            dynamic_requirements: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                ne_mcal: number;
                energy_density_mj_per_kg_dm: number;
                cp_pct_of_dm: number;
                tdn_kg: number;
                calcium_kg: number | null;
                phosphorus_kg: number | null;
                adf_kg: number;
                rdp_pct: number;
                rup_pct: number;
                ndf_max_kg: number;
                ca_p_ratio_target: number;
                breakdown: {
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
                } | null;
            };
            manual: import("../../application/services/feed-requirements.service").ManualInfo | null;
            cattle_id: string;
            source: "MANUAL" | "DYNAMIC";
            inputs: Record<string, unknown>;
            flags: string[];
            requirements: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                ne_mcal: number;
                energy_density_mj_per_kg_dm: number;
                cp_pct_of_dm: number;
                tdn_kg: number;
                calcium_kg: number | null;
                phosphorus_kg: number | null;
                adf_kg: number;
                rdp_pct: number;
                rup_pct: number;
                ndf_max_kg: number;
                ca_p_ratio_target: number;
                breakdown: {
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
                } | null;
            };
        } | {
            dynamic_requirements?: undefined;
            manual?: undefined;
            cattle_id: string;
            source: "MANUAL" | "DYNAMIC";
            inputs: Record<string, unknown>;
            flags: string[];
            requirements: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                ne_mcal: number;
                energy_density_mj_per_kg_dm: number;
                cp_pct_of_dm: number;
                tdn_kg: number;
                calcium_kg: number | null;
                phosphorus_kg: number | null;
                adf_kg: number;
                rdp_pct: number;
                rup_pct: number;
                ndf_max_kg: number;
                ca_p_ratio_target: number;
                breakdown: {
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
                } | null;
            };
        })[];
        missing_cattle_ids: string[];
        bands: import("../../domain/program-fit").FitBands;
    }>;
    todaysRequirement(farmId: string): Promise<{
        by_ingredient: {
            ingredient_id: string;
            name: string;
            total_kg: number;
        }[];
        by_ration: {
            plan_id: string;
            concentration_id: string | null;
            name: string;
            headcount: number;
            total_kg: number;
        }[];
        grand_total_kg: number;
        requirement: {
            headcount: number;
            manual_headcount: number;
            ca_p_headcount: number;
            inputs: {
                weight_kg: number;
                milk_target_l: number;
                bcs: number | null;
                cattle_with_weight: number;
                cattle_with_milk_data: number;
            };
            data_source: {
                weight: string;
                milk_yield: string;
            };
            per_cow: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                ne_mcal: number;
                energy_density_mj_per_kg_dm: number;
                cp_pct_of_dm: number;
                tdn_kg: number;
                calcium_kg: number | null;
                phosphorus_kg: number | null;
                adf_kg: number;
                rdp_pct: number;
                rup_pct: number;
                ndf_max_kg: number;
                ca_p_ratio_target: number;
                breakdown: {
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
                } | null;
            };
            herd_total: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                ne_mcal: number;
                energy_density_mj_per_kg_dm: number;
                cp_pct_of_dm: number;
                tdn_kg: number;
                calcium_kg: number | null;
                phosphorus_kg: number | null;
                adf_kg: number;
                rdp_pct: number;
                rup_pct: number;
                ndf_max_kg: number;
                ca_p_ratio_target: number;
                breakdown: {
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
                } | null;
            };
        } | null;
        has_active_ration: boolean;
    }>;
    getRequirementSettings(farmId: string): Promise<{
        effective: import("../../domain/requirement-settings").RequirementSettings;
        defaults: import("../../domain/requirement-settings").RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<import("../../domain/requirement-settings").RequirementSettings>;
        sources: Record<string, import("../../application/services/requirement-settings.service").RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    updateRequirementSettings(farmId: string, userId: string, dto: UpdateRequirementSettingsDto): Promise<{
        effective: import("../../domain/requirement-settings").RequirementSettings;
        defaults: import("../../domain/requirement-settings").RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<import("../../domain/requirement-settings").RequirementSettings>;
        sources: Record<string, import("../../application/services/requirement-settings.service").RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    resetRequirementSettings(farmId: string, userId: string): Promise<{
        effective: import("../../domain/requirement-settings").RequirementSettings;
        defaults: import("../../domain/requirement-settings").RequirementSettings;
        preset: {
            id: string;
            name: string;
            version: number;
            effective_from: Date;
        } | null;
        farm_changes: Partial<import("../../domain/requirement-settings").RequirementSettings>;
        sources: Record<string, import("../../application/services/requirement-settings.service").RequirementSettingSource>;
        fields: Record<"maintenanceEnergyPerMetabolicKg" | "energyPerLitreMilk" | "energyPerMilkFatPercent" | "netEnergyEfficiency" | "maintenanceProteinPerMetabolicKg" | "proteinPerLitreMilk" | "degradableProteinShare" | "undegradableProteinShare" | "intakeFromMilkFactor" | "intakeFromBodyWeightFactor" | "intakeCurveSteepness" | "intakeCurveOffset" | "defaultDaysInMilk" | "defaultWeightKg" | "alertDryMatterBelowPct" | "alertDryMatterAbovePct" | "alertProteinBelowPct" | "alertProteinAbovePct" | "alertEnergyBelowPct" | "alertEnergyAbovePct" | "manualOverrideDriftPct" | "lookaheadDays" | "pregnancyLengthDays" | "pregnancyPeakEnergy" | "pregnancyPeakProtein" | "heiferIntakePercentOfBodyWeight" | "heiferGrowthEnergy" | "heiferGrowthProtein" | "targetBodyCondition" | "energyAdjustPerBodyConditionStep" | "intakeAdjustPerBodyConditionPoint" | "tdnShareOfIntake" | "adfShareOfIntake" | "ndfMinShareOfIntake" | "ndfMaxShareOfIntake" | "fatShareOfIntake" | "calciumPerBodyWeightKg" | "calciumPerLitreMilk" | "phosphorusPerBodyWeightKg" | "phosphorusPerLitreMilk" | "calciumToPhosphorusTarget", import("../../domain/requirement-settings").RequirementSettingField>;
    }>;
    listConcentrations(farmId: string, query: ListConcentrationsQueryDto): Promise<({
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    } | {
        ingredients: {
            ingredient_id: string | null;
            name: string | null;
            amount_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            rdp_kg: number;
            rup_kg: number;
            starch_kg: number;
            adf_kg: number;
            calcium_kg: number;
            phosphorus_kg: number;
            tdn_kg: number;
            cost_tk: number;
            feed_item_id: string | null;
            feed_item_batch_id: string | null;
            feed_stock_id: string | null;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    })[]>;
    createConcentration(farmId: string, userId: string, dto: CreateConcentrationDto): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    } | {
        ingredients: {
            ingredient_id: string | null;
            name: string | null;
            amount_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            rdp_kg: number;
            rup_kg: number;
            starch_kg: number;
            adf_kg: number;
            calcium_kg: number;
            phosphorus_kg: number;
            tdn_kg: number;
            cost_tk: number;
            feed_item_id: string | null;
            feed_item_batch_id: string | null;
            feed_stock_id: string | null;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    }>;
    normalize(farmId: string, dto: NormalizeConcentrationDto): Promise<{
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        };
        items: {
            ingredient_id: string | null;
            feed_item_id: string | null;
            amount_kg: number;
        }[];
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number;
    }>;
    bulkDeleteConcentrations(farmId: string, dto: BulkDeleteConcentrationDto): Promise<{
        deleted: number;
    }>;
    getConcentration(farmId: string, id: string): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    } | {
        ingredients: {
            ingredient_id: string | null;
            name: string | null;
            amount_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            rdp_kg: number;
            rup_kg: number;
            starch_kg: number;
            adf_kg: number;
            calcium_kg: number;
            phosphorus_kg: number;
            tdn_kg: number;
            cost_tk: number;
            feed_item_id: string | null;
            feed_item_batch_id: string | null;
            feed_stock_id: string | null;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    }>;
    updateConcentration(farmId: string, id: string, dto: UpdateConcentrationDto): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    } | {
        ingredients: {
            ingredient_id: string | null;
            name: string | null;
            amount_kg: number;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            rdp_kg: number;
            rup_kg: number;
            starch_kg: number;
            adf_kg: number;
            calcium_kg: number;
            phosphorus_kg: number;
            tdn_kg: number;
            cost_tk: number;
            feed_item_id: string | null;
            feed_item_batch_id: string | null;
            feed_stock_id: string | null;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        name: string;
        target_type: import("@prisma/client").$Enums.FeedTargetType;
        cattle_id: string | null;
        duration_days: number | null;
        target_weight_kg: number | null;
        target_milk_l: number | null;
        totals: import("../../domain/formula-math").FormulaTotals;
        balance_score: number | null;
        requirements: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
        } | null;
        is_finalized: boolean;
        created_at: Date;
    }>;
    removeConcentration(farmId: string, id: string): Promise<{
        id: string;
        archived: boolean;
    }>;
    saveVersion(farmId: string, userId: string, id: string, name?: string): Promise<{
        id: string;
        version_number: number;
        name: string | null;
        total_cost_per_day: number;
        created_at: Date;
    }>;
    listVersions(farmId: string, id: string): Promise<{
        id: string;
        version_number: number;
        name: string | null;
        items: import("@prisma/client/runtime/client").JsonValue;
        total_cost_per_day: number;
        created_at: Date;
    }[]>;
    finalizeConcentration(farmId: string, userId: string, id: string, dto: FinalizeConcentrationDto): Promise<{
        concentration_id: string;
        stock: {
            id: string;
            kind: import("@prisma/client").$Enums.FeedConcentrationKind;
            source_concentration_id: string;
            source_concentration_version: number;
            produced_at: Date;
            produced_qty_kg: number;
            current_stock_kg: number;
            produced_cost_tk: number;
            created_at: Date;
            nutrition: {
                dm_pct: number;
                cp_pct: number;
                me_mj_per_kg_dm: number;
                fat_pct: number | null;
                ndf_pct: number | null;
                rdp_pct: number | null;
                rup_pct: number | null;
                starch_pct: number | null;
                adf_pct: number | null;
                calcium_pct: number | null;
                phosphorus_pct: number | null;
                tdn_pct: number | null;
            };
            nutrition_source: import("@prisma/client").$Enums.NutritionSource;
            source_ref: string | null;
            nutrition_profile_id: string;
        } | null;
        ingredient: {
            id: string;
            name_en: string;
            is_custom: boolean;
            is_latest_version: boolean;
            source_concentration_id: string | null;
            source_concentration_version: number | null;
            effective_price_per_kg: number;
            nutrition: {
                dm_pct: number;
                cp_pct: number;
                me_mj_per_kg_dm: number;
                fat_pct: number | null;
                ndf_pct: number | null;
                rdp_pct: number | null;
                rup_pct: number | null;
                starch_pct: number | null;
                adf_pct: number | null;
                calcium_pct: number | null;
                phosphorus_pct: number | null;
                tdn_pct: number | null;
            };
        } | null;
        finance: null;
    }>;
    concentrationInventoryCheck(farmId: string, id: string): Promise<{
        can_finalize: boolean;
        lines: {
            ingredient_id: string | null;
            name: string;
            amount_kg: number;
            status: "IN_INVENTORY" | "MISSING";
            feed_item_id: string | null;
            feed_stock_id: string | null;
            available_kg: number | null;
        }[];
        missing: {
            ingredient_id: string | null;
            name: string;
            amount_kg: number;
            feed_class: import("@prisma/client").$Enums.FeedClass | null;
            feed_sub_type: import("@prisma/client").$Enums.FeedSubType | null;
            is_prepared_feed: boolean;
        }[];
        shortfalls: {
            name: string;
            needed_kg: number;
            available_kg: number;
        }[];
    }>;
    resolvedRation(farmId: string, cattleId: string): Promise<{
        match_level: null;
        concentration: null;
    } | {
        match_level: import("../../application/services/feed-ration-resolver.service").RationMatchLevel;
        concentration: {
            id: string;
            kind: import("@prisma/client").$Enums.FeedConcentrationKind;
            name: string;
            target_type: import("@prisma/client").$Enums.FeedTargetType;
            cattle_id: string | null;
            duration_days: number | null;
            target_weight_kg: number | null;
            target_milk_l: number | null;
            totals: import("../../domain/formula-math").FormulaTotals;
            balance_score: number | null;
            requirements: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
            } | null;
            is_finalized: boolean;
            created_at: Date;
        } | {
            ingredients: {
                ingredient_id: string | null;
                name: string | null;
                amount_kg: number;
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
                rdp_kg: number;
                rup_kg: number;
                starch_kg: number;
                adf_kg: number;
                calcium_kg: number;
                phosphorus_kg: number;
                tdn_kg: number;
                cost_tk: number;
                feed_item_id: string | null;
                feed_item_batch_id: string | null;
                feed_stock_id: string | null;
            }[];
            id: string;
            kind: import("@prisma/client").$Enums.FeedConcentrationKind;
            name: string;
            target_type: import("@prisma/client").$Enums.FeedTargetType;
            cattle_id: string | null;
            duration_days: number | null;
            target_weight_kg: number | null;
            target_milk_l: number | null;
            totals: import("../../domain/formula-math").FormulaTotals;
            balance_score: number | null;
            requirements: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                ndf_kg: number;
                fat_kg: number;
            } | null;
            is_finalized: boolean;
            created_at: Date;
        };
    }>;
    programForCattle(farmId: string, cattleId: string): Promise<{
        program: null;
    } | {
        program: {
            assignment_id: string;
            plan_id: string;
            plan_name: string;
            kind: import("@prisma/client").$Enums.FeedPlanKind;
            via: import("../../application/services/feed-plan-resolver.service").ProgramVia;
            group_id: string | null;
            conflict: boolean;
            lines: {
                line_id: string;
                line_type: import("@prisma/client").$Enums.FeedPlanLineType;
                name: string;
                kg_per_day: number;
                source: {
                    source_type: "FEED_ITEM" | "FEED_STOCK";
                    feed_item_id: string | null;
                    feed_stock_id: string | null;
                } | null;
                density: {
                    dm_pct: number;
                    cp_pct: number;
                    me_mj_per_kg_dm: number;
                } | null;
                stock_ok: boolean;
            }[];
        };
    }>;
    dmiComparison(farmId: string, cattleId: string, date?: string): Promise<{
        expected_dmi_kg: number;
        actual_dmi_kg: number | null;
        delta_pct: number | null;
        match_level: string | null;
        program: {
            plan_id: string;
            plan_name: string;
            via: import("../../application/services/feed-plan-resolver.service").ProgramVia;
            conflict: boolean;
        } | null;
    }>;
    listDistributions(farmId: string, query: ListDistributionQueryDto): Promise<{
        items: {
            id: string;
            concentration_id: string | null;
            cattle_id: string | null;
            distributed_at: Date;
            total_actual_kg: number;
            total_actual_cost: number;
            created_at: Date;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    logDistribution(farmId: string, userId: string, dto: LogDistributionDto): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    getFeedingGrid(farmId: string, query: FeedGridQueryDto): Promise<{
        date: string;
        sections: {
            fit_summary: {
                ok: number;
                warn: number;
                bad: number;
                estimated: number;
            };
            id: string;
            plan_id: string;
            plan_name: string;
            kind: import("@prisma/client").$Enums.FeedPlanKind;
            via: import("../../application/services/feed-plan-resolver.service").ProgramVia;
            group_id: string | null;
            conflict: boolean;
            cattle_ids: string[];
            lines: {
                line_id: string;
                line_type: import("@prisma/client").$Enums.FeedPlanLineType;
                name: string;
                kg_per_day: number;
                prefill_kg: number;
                source: {
                    source_type: "FEED_ITEM" | "FEED_STOCK";
                    feed_item_id: string | null;
                    feed_stock_id: string | null;
                } | null;
                density: {
                    dm_pct: number;
                    cp_pct: number;
                    me_mj_per_kg_dm: number;
                } | null;
                stock_ok: boolean;
            }[];
        }[];
        cows: {
            planned_supply: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                complete: boolean;
            } | null;
            fit: {
                severity: import("../../domain/program-fit").FitSeverity;
                estimated: boolean;
                dm: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
                cp: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
                me: {
                    delta_pct: number | null;
                    severity: import("../../domain/program-fit").FitSeverity;
                };
            } | null;
            cattle_id: string;
            name: string | null;
            tag_number: string;
            drafts: {
                id: string;
                source_type: import("@prisma/client").$Enums.FeedGridSourceType;
                feed_item_id: string | null;
                feed_stock_id: string | null;
                offered_kg: number;
                refusal_kg: number | null;
                plan_line_id: string | null;
                updated_at: Date;
            }[];
            default_offered_kg: number | null;
            default_source: {
                source_type: import("@prisma/client").$Enums.FeedGridSourceType;
                feed_item_id: string | null;
                feed_stock_id: string | null;
            } | null;
            confirmed_offered_kg: number | null;
            confirmed_supply: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                complete: boolean;
            } | null;
            remaining_requirement: {
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
            } | null;
            program_section_id: string | null;
            program_conflict: boolean;
            lookahead: import("../../domain/lookahead").LookaheadEvent[];
            planned_kg_by_line: {
                [k: string]: number;
            };
            requirement: {
                dynamic_requirements?: {
                    dm_kg: number;
                    cp_kg: number;
                    me_mj: number;
                    ndf_kg: number;
                    fat_kg: number;
                    ne_mcal: number;
                    energy_density_mj_per_kg_dm: number;
                    cp_pct_of_dm: number;
                    tdn_kg: number;
                    calcium_kg: number | null;
                    phosphorus_kg: number | null;
                    adf_kg: number;
                    rdp_pct: number;
                    rup_pct: number;
                    ndf_max_kg: number;
                    ca_p_ratio_target: number;
                    breakdown: {
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
                    } | null;
                } | undefined;
                manual?: import("../../application/services/feed-requirements.service").ManualInfo | null | undefined;
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                flags: string[];
                source: "MANUAL" | "DYNAMIC";
            } | null;
        }[];
    }>;
    getFeedingGridCalendar(farmId: string, query: FeedGridCalendarQueryDto): Promise<{
        month: string;
        days: {
            date: string;
            status: "complete" | "partial" | "missing" | "future" | "before_farm";
        }[];
    }>;
    saveFeedDraft(farmId: string, userId: string, dto: SaveFeedDraftDto): Promise<{
        saved: number;
        drafts: {
            id: string;
            source_type: import("@prisma/client").$Enums.FeedGridSourceType;
            feed_item_id: string | null;
            feed_stock_id: string | null;
            offered_kg: number;
            refusal_kg: number | null;
            plan_line_id: string | null;
            updated_at: Date;
        }[];
    }>;
    confirmFeedDraft(farmId: string, userId: string, dto: ConfirmFeedDraftDto): Promise<{
        id: string;
        date: string;
        total_actual_kg: number;
        total_actual_cost: number;
        sources: {
            source_type: import("@prisma/client").$Enums.FeedGridSourceType;
            feed_item_id: string | null;
            feed_stock_id: string | null;
            total_kg: number;
        }[];
        cows: (Record<string, unknown> & {
            offered_kg: number;
            refusal_kg: number;
            cost_tk: number;
        })[];
    }>;
    getCattleHistory(farmId: string, cattleId: string, query: FeedCattleHistoryQueryDto): Promise<{
        cattle_id: string;
        date: string;
        requirement: {
            source: "MANUAL" | "DYNAMIC";
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number;
            fat_kg: number;
            ne_mcal: number;
            energy_density_mj_per_kg_dm: number;
            cp_pct_of_dm: number;
            tdn_kg: number;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            adf_kg: number;
            rdp_pct: number;
            rup_pct: number;
            ndf_max_kg: number;
            ca_p_ratio_target: number;
            breakdown: {
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
            } | null;
        } | null;
        measured: {
            dm_kg: boolean;
            cp_kg: boolean;
            me_mj: boolean;
            fat_kg: boolean;
            ndf_kg: boolean;
            adf_kg: boolean;
            starch_kg: boolean;
            tdn_kg: boolean;
            calcium_kg: boolean;
            phosphorus_kg: boolean;
            rdp_kg: boolean;
            rup_kg: boolean;
        };
        entries: {
            id: string;
            distribution_id: string;
            offered_kg: number;
            refusal_kg: number;
            cost_tk: number | null;
            feed_name: string | null;
            source_type: import("@prisma/client").$Enums.FeedGridSourceType | null;
            fed_at: Date;
            voided_at: Date | null;
            voided_by: string | null;
            void_reason: string | null;
        }[];
        totals: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            fat_kg: number;
            ndf_kg: number;
            adf_kg: number;
            starch_kg: number;
            tdn_kg: number;
            calcium_kg: number;
            phosphorus_kg: number;
            rdp_kg: number;
            rup_kg: number;
        };
    }>;
    voidCattleItem(farmId: string, userId: string, distributionId: string, cattleItemId: string, dto: VoidFeedCattleItemDto): Promise<{
        id: string;
        cattle_id: string;
        offered_kg: number;
        voided_at: Date | null;
        voided_by: string | null;
        void_reason: string | null;
    }>;
    costSummary(farmId: string, days?: string): Promise<{
        days: number;
        total_cost: number;
        cost_per_cow_per_day: number | null;
        cost_per_litre: number | null;
        headcount: number;
        total_litres: number;
        trend: {
            date: string;
            total_cost: number;
        }[];
    }>;
    efficiency(farmId: string, query: FeedEfficiencyQueryDto): Promise<{
        distributions: number;
        planned_kg: number;
        actual_kg: number;
        refusal_kg: number;
        consumed_kg: number;
        planned_cost: number;
        actual_cost: number;
        adherence_pct: number | null;
        refusal_pct: number | null;
        litres_produced: number;
        feed_cost_per_litre: number | null;
        cattle_id: string;
        cattle_name: string;
        period: string;
    }>;
    getDistribution(farmId: string, id: string): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    patchRefusal(farmId: string, id: string, dto: PatchRefusalDto): Promise<{
        id: string;
        concentration_id: string | null;
        cattle_id: string | null;
        distributed_at: Date;
        total_planned_kg: number;
        total_actual_kg: number;
        total_refusal_kg: number;
        total_planned_cost: number;
        total_actual_cost: number;
        notes: string | null;
        forage_decrements: number | null;
        items: {
            ingredient_id: string;
            name: string;
            planned_kg: number;
            actual_kg: number;
            refusal_kg: number;
            price_per_kg: number;
            line_cost: number;
        }[];
        created_at: Date;
    }>;
    listStock(farmId: string, query: ListFeedStockQueryDto): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }[]>;
    bulkDeleteStock(farmId: string, dto: BulkDeleteStockDto): Promise<{
        deleted: number;
    }>;
    getStock(farmId: string, id: string): Promise<{
        movements: {
            id: string;
            change_kg: number;
            reason: import("@prisma/client").$Enums.FeedStockMovementReason;
            distribution_id: string | null;
            created_at: Date;
        }[];
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    archiveStock(farmId: string, id: string): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
    updateStockNutrition(farmId: string, userId: string, id: string, dto: UpdateStockNutritionDto): Promise<{
        id: string;
        kind: import("@prisma/client").$Enums.FeedConcentrationKind;
        source_concentration_id: string;
        source_concentration_version: number;
        produced_at: Date;
        produced_qty_kg: number;
        current_stock_kg: number;
        produced_cost_tk: number;
        created_at: Date;
        nutrition: {
            dm_pct: number;
            cp_pct: number;
            me_mj_per_kg_dm: number;
            fat_pct: number | null;
            ndf_pct: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            starch_pct: number | null;
            adf_pct: number | null;
            calcium_pct: number | null;
            phosphorus_pct: number | null;
            tdn_pct: number | null;
        };
        nutrition_source: import("@prisma/client").$Enums.NutritionSource;
        source_ref: string | null;
        nutrition_profile_id: string;
    }>;
}
