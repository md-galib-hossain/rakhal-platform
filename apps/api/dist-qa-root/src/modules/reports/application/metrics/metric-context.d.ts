import type { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ReportScopeKind } from '../../domain/contracts/enums';
import type { ReportPeriod } from '../../domain/contracts/period';
import type { ReportThresholds } from '../../domain/contracts/template';
import type { DataQuality } from '../../domain/contracts/data-quality';
import type { ReportException, SnapshotSection } from '../../domain/contracts/snapshot';
import type { MetricDefinition } from '../../domain/contracts/metric-definition';
export type ReportDb = PrismaService | Prisma.TransactionClient;
export interface MetricContext {
    db: ReportDb;
    farmId: string;
    timezone: string;
    period: ReportPeriod;
    previousPeriod: ReportPeriod | null;
    scopeKind: ReportScopeKind;
    cattleIds: readonly string[];
    previousCattleIds: readonly string[];
    cattlePresence?: ReadonlyMap<string, {
        startDate: string;
        endDate: string;
    }>;
    generatedAt: Date;
    thresholds: ReportThresholds;
    includeFinance: boolean;
}
export interface DomainMetricOutput {
    section: SnapshotSection | null;
    exceptions: ReportException[];
    dataQuality: DataQuality;
}
export interface DomainMetricModule {
    readonly definitions: readonly MetricDefinition[];
    compute(ctx: MetricContext): Promise<DomainMetricOutput>;
}
