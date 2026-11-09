import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class CattleDetailService {
    private readonly prisma;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    overview(farmId: string, cattleId: string): Promise<{
        aqr_score: number | null;
        aqr_change_pct: number | null;
        avg_daily_yield_7d: number;
        yield_change_pct: number | null;
        last_weight_kg: number;
        weight_change_pct: number | null;
        bcs_records: {
            date: Date;
            score: number;
        }[];
        weight_history: {
            date: Date;
            weight_kg: number;
        }[];
        lactation_curve: import("../../domain/lactation-curve").LactationCurvePoint[];
        lifetime_yield: {
            year: number;
            total_l: number;
        }[];
        recent_milk_records: {
            date: Date;
            morning_l: number;
            noon_l: number;
            evening_l: number;
            night_l: number;
            total_l: number;
        }[];
    }>;
    pedigree(farmId: string, cattleId: string): Promise<{
        self: {
            dam: {
                id: string;
                name: string | null;
                tag: string;
                gender: string;
                farm_name: string | null;
                dam: unknown | null;
                sire: unknown | null;
            } | null;
            sire: {
                id: string;
                name: string | null;
                tag: string;
                gender: string;
                farm_name: string | null;
                dam: unknown | null;
                sire: unknown | null;
            } | {
                id: null;
                name: null;
                tag: null;
                gender: string;
                farm_name: null;
                is_external: boolean;
                dam: null;
                sire: null;
            } | null;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
        };
        dam: {
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
            dam: unknown | null;
            sire: unknown | null;
        } | null;
        sire: {
            is_external: boolean;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
            dam: unknown | null;
            sire: unknown | null;
        } | {
            is_external: boolean;
            id: null;
            name: null;
            tag: null;
            gender: string;
            farm_name: null;
            dam: null;
            sire: null;
        };
        siblings: {
            relation: string;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
        }[];
        offspring: {
            id: string;
            name: string | null;
            tag: string;
            gender: import("@prisma/client").$Enums.CattleGender;
            birth_date: Date | null;
            farm_name: string;
        }[];
    }>;
    cattleFinance(farmId: string, cattleId: string, period?: string): Promise<{
        period: string;
        total_income: number;
        total_cost: number;
        net_profit: number;
        expense_breakdown: Record<import("./cattle-finance-aggregation").CattleExpenseBucket, number>;
        income_breakdown: {
            milk_sales: number;
            calf_sales: number;
        };
        monthly_chart: {
            month: string;
            income: number;
            cost: number;
        }[];
    }>;
    private curveYields;
    private dailyTotals;
    private recentMilkRecords;
    private sessionField;
    private lifetimeByYear;
    private monthlyChart;
    private sumOnOrAfter;
    private sumBetween;
    private monthRange;
    private monthsAgo;
    private monthLabel;
    private daysAgo;
    private pedigreeSelect;
    private pedigreeNode;
    private getAncestors;
    private roundAll;
    private round;
    private getCattleOrThrow;
}
