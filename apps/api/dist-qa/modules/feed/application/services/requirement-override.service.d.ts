import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SetRequirementOverrideDto } from '../../presentation/dto/set-requirement-override.dto';
import { RequirementOverrideHistoryQueryDto } from '../../presentation/dto/requirement-override-history-query.dto';
import { FeedRequirementsService } from './feed-requirements.service';
export interface OverrideWarning {
    code: string;
    field: string;
    message: string;
}
export declare class RequirementOverrideService {
    private readonly prisma;
    private readonly requirements;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, requirements: FeedRequirementsService, activityLog: ActivityLogService);
    get(farmId: string, cattleId: string): Promise<{
        active: {
            id: string;
            cattle_id: string;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number | null;
            ndf_max_kg: number | null;
            adf_kg: number | null;
            fat_kg: number | null;
            tdn_kg: number | null;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            note: string | null;
            dynamic_snapshot: Prisma.JsonValue;
            effective_from: Date;
            effective_to: Date | null;
            end_reason: import("@prisma/client").$Enums.RequirementOverrideEndReason | null;
            set_by: string;
            set_by_name: string | null;
            ended_by: string | null;
            ended_by_name: string | null;
        } | null;
        resolved: {
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
            manual: import("./feed-requirements.service").ManualInfo | null;
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
        calculated: {
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
        last: {
            id: string;
            cattle_id: string;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number | null;
            ndf_max_kg: number | null;
            adf_kg: number | null;
            fat_kg: number | null;
            tdn_kg: number | null;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            note: string | null;
            dynamic_snapshot: Prisma.JsonValue;
            effective_from: Date;
            effective_to: Date | null;
            end_reason: import("@prisma/client").$Enums.RequirementOverrideEndReason | null;
            set_by: string;
            set_by_name: string | null;
            ended_by: string | null;
            ended_by_name: string | null;
        } | null;
    }>;
    history(farmId: string, cattleId: string, query: RequirementOverrideHistoryQueryDto): Promise<{
        items: {
            id: string;
            cattle_id: string;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number | null;
            ndf_max_kg: number | null;
            adf_kg: number | null;
            fat_kg: number | null;
            tdn_kg: number | null;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            note: string | null;
            dynamic_snapshot: Prisma.JsonValue;
            effective_from: Date;
            effective_to: Date | null;
            end_reason: import("@prisma/client").$Enums.RequirementOverrideEndReason | null;
            set_by: string;
            set_by_name: string | null;
            ended_by: string | null;
            ended_by_name: string | null;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    set(farmId: string, userId: string, cattleId: string, dto: SetRequirementOverrideDto): Promise<{
        active: {
            id: string;
            cattle_id: string;
            dm_kg: number;
            cp_kg: number;
            me_mj: number;
            ndf_kg: number | null;
            ndf_max_kg: number | null;
            adf_kg: number | null;
            fat_kg: number | null;
            tdn_kg: number | null;
            calcium_kg: number | null;
            phosphorus_kg: number | null;
            rdp_pct: number | null;
            rup_pct: number | null;
            note: string | null;
            dynamic_snapshot: Prisma.JsonValue;
            effective_from: Date;
            effective_to: Date | null;
            end_reason: import("@prisma/client").$Enums.RequirementOverrideEndReason | null;
            set_by: string;
            set_by_name: string | null;
            ended_by: string | null;
            ended_by_name: string | null;
        };
        resolved: {
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
            manual: import("./feed-requirements.service").ManualInfo | null;
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
        warnings: import("../../domain/manual-requirement").ManualValidationIssue[];
    }>;
    turnOff(farmId: string, userId: string, cattleId: string): Promise<{
        active: null;
        resolved: {
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
            manual: import("./feed-requirements.service").ManualInfo | null;
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
    }>;
    private requireCow;
    private requireResolved;
    private userNames;
    private rowShape;
    private audit;
}
