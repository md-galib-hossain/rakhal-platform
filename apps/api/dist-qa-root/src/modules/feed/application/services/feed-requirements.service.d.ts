import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { MilkService } from 'src/modules/milk/application/services/milk.service';
import { AnimalType, Requirements } from '../../domain/requirements';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';
import { RequirementSettingsService } from './requirement-settings.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
export interface OverrideRow {
    id: string;
    dmKg: number;
    cpKg: number;
    meMj: number;
    ndfKg: number | null;
    ndfMaxKg: number | null;
    adfKg: number | null;
    fatKg: number | null;
    tdnKg: number | null;
    calciumKg: number | null;
    phosphorusKg: number | null;
    rdpPct: number | null;
    rupPct: number | null;
    note: string | null;
    dynamicSnapshot: unknown;
    effectiveFrom: Date;
    setBy: string;
}
export interface ManualInfo {
    override_id: string;
    set_at: Date;
    set_by: string;
    note: string | null;
    stale: boolean;
    drift: {
        dm_pct: number;
        cp_pct: number;
        me_pct: number;
    };
    animal_type_changed: boolean;
}
export interface ResolvedRequirement {
    source: 'DYNAMIC' | 'MANUAL';
    requirements: Requirements;
    dynamicRequirements: Requirements | null;
    flags: string[];
    manual: ManualInfo | null;
}
export interface ResolvedCow extends ResolvedRequirement {
    cattleId: string;
    inputs: Record<string, unknown>;
}
export declare class FeedRequirementsService {
    private readonly prisma;
    private readonly milk;
    private readonly requirementSettings;
    private readonly programs;
    constructor(prisma: PrismaService, milk: MilkService, requirementSettings: RequirementSettingsService, programs: FeedPlanResolverService);
    calc(farmId: string, query: FeedRequirementsQueryDto): Promise<{
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
        manual: ManualInfo | null;
        source: "MANUAL" | "DYNAMIC";
        inputs: {
            weight_kg: number;
            milk_target_l: number;
            milk_fat_pct: number;
            gestation_days: number | undefined;
            bcs: number | undefined;
            dim: number | undefined;
            animal_type: AnimalType;
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
            animal_type: AnimalType;
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
            animal_type: AnimalType;
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
    }>;
    forManual(farmId: string, query: FeedRequirementsQueryDto): Promise<{
        cattle_id: string | null;
        inputs: {
            weight_kg: number;
            milk_target_l: number;
            milk_fat_pct: number;
            milk_protein_pct: number | undefined;
            gestation_days: number | undefined;
            bcs: number | undefined;
            dim: number | undefined;
            animal_type: AnimalType;
        };
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
        bands: import("../../domain/program-fit").FitBands;
    }>;
    private calcManual;
    private inferAnimalType;
    private deriveDim;
    private calcForCattle;
    private overridesFor;
    private resolveCow;
    private manualShape;
    private cowShape;
    private herdRequirementBlock;
    getTodaysRequirement(farmId: string): Promise<{
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
    resolveForConcentrations(farmId: string, rows: {
        id: string;
        kind: string;
        targetType: string | null;
        cattleId: string | null;
        targetWeightKg: number | null;
        targetMilkL: number | null;
    }[]): Promise<Map<string, Requirements | null>>;
    forCattle(farmId: string, cattleIds: string[], date?: string): Promise<{
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
            manual: ManualInfo | null;
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
    resolveOne(farmId: string, cattleId: string): Promise<{
        shaped: {
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
            manual: ManualInfo | null;
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
        };
        snapshot: {
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            animal_type: AnimalType;
            inputs: Record<string, unknown>;
        };
    } | null>;
    private resolveMany;
    private gestationDaysFor;
    private currentGestationDays;
    private reqShape;
}
