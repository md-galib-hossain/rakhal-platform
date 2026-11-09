import { PrismaService } from 'src/core/database/prisma/prisma.service';
interface PeriodMetric {
    current: number;
    previous: number;
    changePct: number | null;
}
export interface PurchasingSummary {
    period: {
        from: string;
        to: string;
    };
    previousPeriod: {
        from: string;
        to: string;
    };
    kpis: {
        totalPurchases: PeriodMetric;
        paidAmount: PeriodMetric;
        payable: PeriodMetric;
        purchaseOrders: PeriodMetric;
    };
}
export declare class PurchasingSummaryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(farmId: string, from: Date, to: Date): Promise<PurchasingSummary>;
    private queryKpis;
}
export {};
