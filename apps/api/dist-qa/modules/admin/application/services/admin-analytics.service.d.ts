import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';
export declare const EXPORT_ROW_LIMIT = 10000;
export type ExportKind = 'farms' | 'users' | 'subscriptions';
export declare class AdminAnalyticsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AdminAuditService);
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
    private activeFarms;
    export(actorId: string, kind: ExportKind): Promise<{
        filename: string;
        csv: string;
        rows: number;
    }>;
    private collect;
}
