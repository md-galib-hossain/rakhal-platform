import type { Response } from 'express';
import { AdminAnalyticsService, type ExportKind } from '../../application/services/admin-analytics.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
export declare class AdminAnalyticsController {
    private readonly analytics;
    constructor(analytics: AdminAnalyticsService);
    usage(): Promise<{
        generatedAt: string;
        subscriptions: {
            byPlan: {
                plan: string;
                counts: Record<string, number>;
            }[];
        };
        mrr: {
            listPriceBdt: number;
        };
        revenue: {
            windowDays: number;
            paidInvoices: number;
            totalBdt: number;
        };
        activeFarms: {
            last7Days: number;
            last30Days: number;
        };
        expiring: {
            farmId: string;
            farm: string;
            plan: string;
            status: string;
            expiresAt: Date;
        }[];
    }>;
    export(admin: CurrentAdminContext, kind: ExportKind, res: Response): Promise<void>;
}
