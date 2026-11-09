import { SaleLineType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SalesSummaryGranularity } from '../presentation/dto/sales-summary-query.dto';
interface PeriodMetric {
    current: number;
    previous: number;
    changePct: number | null;
}
export interface SalesSummary {
    period: {
        from: string;
        to: string;
    };
    previousPeriod: {
        from: string;
        to: string;
    };
    kpis: {
        totalSales: PeriodMetric;
        totalInvoices: PeriodMetric;
        paidAmount: PeriodMetric;
        outstanding: PeriodMetric;
    };
    trend: {
        bucket: string;
        amount: string;
    }[];
    byProduct: {
        lineType: SaleLineType;
        amount: string;
        sharePct: number;
    }[];
    topBuyers: {
        customerId: string;
        name: string;
        amount: string;
        invoiceCount: number;
    }[];
}
export declare class SalesSummaryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(farmId: string, from: Date, to: Date, granularity: SalesSummaryGranularity): Promise<SalesSummary>;
    private queryKpis;
    private queryTrend;
    private queryByProduct;
    private queryTopBuyers;
}
export {};
