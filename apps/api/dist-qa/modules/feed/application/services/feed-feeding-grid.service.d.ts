import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { FeedDistributionService } from './feed-distribution.service';
import { FeedStockService } from './feed-stock.service';
import { FeedLotResolver } from './feed-lot-resolver.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { FeedPlanService } from './feed-plan.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedLookaheadService } from './feed-lookahead.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { SaveFeedDraftDto } from '../../presentation/dto/save-feed-draft.dto';
import { ConfirmFeedDraftDto } from '../../presentation/dto/confirm-feed-draft.dto';
import { VoidFeedCattleItemDto } from '../../presentation/dto/void-feed-cattle-item.dto';
export declare class FeedFeedingGridService {
    private readonly prisma;
    private readonly feedDistribution;
    private readonly feedStock;
    private readonly feedItems;
    private readonly lotResolver;
    private readonly programs;
    private readonly planService;
    private readonly requirements;
    private readonly lookahead;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, feedDistribution: FeedDistributionService, feedStock: FeedStockService, feedItems: FeedItemService, lotResolver: FeedLotResolver, programs: FeedPlanResolverService, planService: FeedPlanService, requirements: FeedRequirementsService, lookahead: FeedLookaheadService, clock: FarmClockService);
    calendar(farmId: string, month: string): Promise<{
        month: string;
        days: {
            date: string;
            status: "complete" | "partial" | "missing" | "future" | "before_farm";
        }[];
    }>;
    getGrid(farmId: string, date: string): Promise<{
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
            via: import("./feed-plan-resolver.service").ProgramVia;
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
                manual?: import("./feed-requirements.service").ManualInfo | null | undefined;
                dm_kg: number;
                cp_kg: number;
                me_mj: number;
                flags: string[];
                source: "MANUAL" | "DYNAMIC";
            } | null;
        }[];
    }>;
    saveDraft(farmId: string, userId: string, dto: SaveFeedDraftDto): Promise<{
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
    confirm(farmId: string, userId: string, dto: ConfirmFeedDraftDto): Promise<{
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
    private validateSource;
    private resolveEntrySource;
    private sourceKey;
    private resolveGroupPlan;
    cattleHistory(farmId: string, cattleId: string, date?: string): Promise<{
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
    private assertCattleBelongToFarm;
    private computeDefaults;
    private computeConfirmedToday;
    private computeConfirmedSupply;
    private mapResolvedSource;
    private resolveDefaultSources;
    private computeLastUsedSources;
    private groupByCattle;
    private mapDraft;
    private dayStart;
    private dateOnly;
}
