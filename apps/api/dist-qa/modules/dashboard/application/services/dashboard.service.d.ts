import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { MilkService } from 'src/modules/milk/application/services/milk.service';
import { HealthService } from 'src/modules/health/application/services/health.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { FeedDistributionService } from 'src/modules/feed/application/services/feed-distribution.service';
import { CacheService } from 'src/core/cache/cache.service';
import { DashboardPeriod } from '../../presentation/dto/dashboard-query.dto';
export interface DashboardPriorityCattleRef {
    id: string;
    name: string | null;
    tag: string;
}
export interface DashboardPriorityItem {
    priority: 'critical' | 'urgent' | 'important' | 'operational' | 'routine';
    icon: string;
    message: string;
    actionLabel: string;
    link: string;
    count?: number;
    cattleId?: string;
    expectedDate?: Date;
    cattle?: DashboardPriorityCattleRef[];
    truncated?: boolean;
}
export declare class DashboardService {
    private readonly prisma;
    private readonly balance;
    private readonly milk;
    private readonly health;
    private readonly farmSettings;
    private readonly feedDistribution;
    private readonly cache;
    private readonly log;
    constructor(prisma: PrismaService, balance: BalanceService, milk: MilkService, health: HealthService, farmSettings: FarmSettingsService, feedDistribution: FeedDistributionService, cache: CacheService, logger: LoggerService);
    overviewBatch(farmId: string): Promise<{
        priorities: {
            priorities: DashboardPriorityItem[];
        };
        kpis: {
            costPerLitre: {
                value: number | null;
                currency: string;
            };
            todaysYield: {
                value: number;
                unit: string;
                changePct: number | null;
                changeDirection: string | null;
                changePeriod: string;
            };
            herdHealth: {
                value: number;
                unit: string;
                sickCount: number;
                threshold: number;
            };
            cashRunway: {
                value: number | null;
                unit: string;
                status: string;
            };
        };
        herdStatus: {
            totalActive: number;
            productionBreakdown: {
                milking: number;
                dry: number;
                fresh: number;
            };
            categoryBreakdown: Record<"calf" | "bull" | "cow" | "steer" | "heifer", number>;
            reproductiveBreakdown: {
                open: number;
                inseminated: number;
                pregnant: number;
                dryPeriod: number;
            };
            healthBreakdown: {
                healthy: number;
                sick: number;
                inTreatment: number;
                withholding: number;
            };
            calves: {
                total: number;
                newborn_0_7: number;
                young_7_60: number;
                pre_weaning_60_90: number;
                post_weaning_90plus: number;
            };
        };
        livestockState: {
            period: "today";
            states: {
                state: string;
                count: number;
                color: string;
            }[];
        };
        productionSummary: {
            period: "today";
            totalYieldL: number;
            sellableL: number;
            withholdingL: number;
            calfAllocationL: number;
            comparison: {
                yesterday: number;
                sameDayLastWeek: number;
                sameDayLastYear: number;
            };
            sessions: Record<string, string>;
        };
        calvingForecast: {
            forecast: {
                cattleId: string;
                name: string | null;
                tag: string;
                shed: string | null;
                expectedCalvingDate: Date | null;
                daysRemaining: number | null;
                conceptionDate: Date | null;
            }[];
        };
        feedStockAlerts: {
            alerts: {
                itemId: string;
                itemType: "medicine" | "feed_item";
                name: string;
                currentStock: number;
                unit: string;
                threshold: number;
                daysRemainingEstimate: number | null;
                status: string;
            }[];
        };
        upcomingTasks: {
            totalToday: number;
            completedToday: number;
            overdue: number;
            byCategory: Record<string, {
                count: number;
                overdue: number;
            }>;
            tasks: {
                id: string;
                name: string;
                category: import("@prisma/client").$Enums.TaskCategory;
                priority: import("@prisma/client").$Enums.TaskPriority;
                dueAt: Date;
                status: import("@prisma/client").$Enums.TaskStatus;
                assignedTo: string | null;
            }[];
        };
        financialSnapshot: {
            period: string;
            income: {
                current: number;
                previous: number;
                changePct: number | null;
            };
            expenses: {
                current: number;
                previous: number;
                changePct: number | null;
            };
            profit: {
                current: number;
                previous: number;
                changePct: number | null;
            };
            survivalRunway: {
                days: number | null;
                availableLiquidity: number;
                status: string;
            };
        };
        feedCostSummary: {
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
        };
    }>;
    feedCostSummary(farmId: string): Promise<{
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
    kpis(farmId: string): Promise<{
        costPerLitre: {
            value: number | null;
            currency: string;
        };
        todaysYield: {
            value: number;
            unit: string;
            changePct: number | null;
            changeDirection: string | null;
            changePeriod: string;
        };
        herdHealth: {
            value: number;
            unit: string;
            sickCount: number;
            threshold: number;
        };
        cashRunway: {
            value: number | null;
            unit: string;
            status: string;
        };
    }>;
    productionSummary(farmId: string, period: DashboardPeriod): Promise<{
        period: "today";
        totalYieldL: number;
        sellableL: number;
        withholdingL: number;
        calfAllocationL: number;
        comparison: {
            yesterday: number;
            sameDayLastWeek: number;
            sameDayLastYear: number;
        };
        sessions: Record<string, string>;
    } | {
        period: "month" | "week";
        totalYieldL: number;
        sellableL: number;
        withholdingL: number;
        calfAllocationL: number;
        comparison: null;
        sessions: null;
    }>;
    calvingForecast(farmId: string): Promise<{
        forecast: {
            cattleId: string;
            name: string | null;
            tag: string;
            shed: string | null;
            expectedCalvingDate: Date | null;
            daysRemaining: number | null;
            conceptionDate: Date | null;
        }[];
    }>;
    herdStatus(farmId: string): Promise<{
        totalActive: number;
        productionBreakdown: {
            milking: number;
            dry: number;
            fresh: number;
        };
        categoryBreakdown: Record<"calf" | "bull" | "cow" | "steer" | "heifer", number>;
        reproductiveBreakdown: {
            open: number;
            inseminated: number;
            pregnant: number;
            dryPeriod: number;
        };
        healthBreakdown: {
            healthy: number;
            sick: number;
            inTreatment: number;
            withholding: number;
        };
        calves: {
            total: number;
            newborn_0_7: number;
            young_7_60: number;
            pre_weaning_60_90: number;
            post_weaning_90plus: number;
        };
    }>;
    livestockState(farmId: string, period: DashboardPeriod): Promise<{
        period: DashboardPeriod;
        states: {
            state: string;
            count: number;
            color: string;
        }[];
    }>;
    financialSnapshot(farmId: string): Promise<{
        period: string;
        income: {
            current: number;
            previous: number;
            changePct: number | null;
        };
        expenses: {
            current: number;
            previous: number;
            changePct: number | null;
        };
        profit: {
            current: number;
            previous: number;
            changePct: number | null;
        };
        survivalRunway: {
            days: number | null;
            availableLiquidity: number;
            status: string;
        };
    }>;
    financialPerformance(farmId: string): Promise<{
        months: {
            month: string;
            label: string;
            income: number;
            expense: number;
            profit: number;
        }[];
    }>;
    productionVsFeedcost(farmId: string): Promise<{
        days: {
            day: number;
            productionL: number;
            feedcost: number;
        }[];
    }>;
    conceptionRate(farmId: string): Promise<{
        months: {
            month: string;
            label: string;
            inseminations: number;
            confirmedPregnancies: number;
            ratePct: number;
        }[];
    }>;
    feedStockAlerts(farmId: string): Promise<{
        alerts: {
            itemId: string;
            itemType: "medicine" | "feed_item";
            name: string;
            currentStock: number;
            unit: string;
            threshold: number;
            daysRemainingEstimate: number | null;
            status: string;
        }[];
    }>;
    upcomingTasks(farmId: string): Promise<{
        totalToday: number;
        completedToday: number;
        overdue: number;
        byCategory: Record<string, {
            count: number;
            overdue: number;
        }>;
        tasks: {
            id: string;
            name: string;
            category: import("@prisma/client").$Enums.TaskCategory;
            priority: import("@prisma/client").$Enums.TaskPriority;
            dueAt: Date;
            status: import("@prisma/client").$Enums.TaskStatus;
            assignedTo: string | null;
        }[];
    }>;
    priorities(farmId: string): Promise<{
        priorities: DashboardPriorityItem[];
    }>;
    private pendingMilkCattle;
    private txnSum;
    private financeSnapshot;
    private calfStageCounts;
    private periodRange;
    private changePct;
    private round;
    private monthKey;
    private lastNMonths;
}
