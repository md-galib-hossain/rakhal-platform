import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AgingBucketDef } from '../domain/aging';
export interface AgingBucketResult extends AgingBucketDef {
    amount: string;
    invoiceCount: number;
}
export interface AgingReport {
    asOf: string;
    buckets: AgingBucketResult[];
    totalOutstanding: string;
    totalCount: number;
}
export declare class AgingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getReceivablesAging(farmId: string, asOf: Date): Promise<AgingReport>;
    getPayablesAging(farmId: string, asOf: Date): Promise<AgingReport>;
    private queryAging;
    private toReport;
}
