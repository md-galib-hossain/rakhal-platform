import { DashboardService } from '../../application/services/dashboard.service';
import { DashboardPeriodQueryDto } from '../dto/dashboard-query.dto';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    overviewBatch(farmId: string): Promise<{
        priorities: {
            priorities: import("../../application/services/dashboard.service").DashboardPriorityItem[];
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
    priorities(farmId: string): Promise<{
        priorities: import("../../application/services/dashboard.service").DashboardPriorityItem[];
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
    productionSummary(farmId: string, query: DashboardPeriodQueryDto): Promise<{
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
    livestockState(farmId: string, query: DashboardPeriodQueryDto): Promise<{
        period: import("../dto/dashboard-query.dto").DashboardPeriod;
        states: {
            state: string;
            count: number;
            color: string;
        }[];
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
}
