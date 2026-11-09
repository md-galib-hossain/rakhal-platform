import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import type { ReportDomain } from '../../domain/contracts/enums';
import type { MetricId } from '../../domain/contracts/metric-definition';
import { type ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { DomainMetricModule } from '../metrics/metric-context';
import type { ReportComputeInput, ReportComputeService as ReportComputePort } from '../ports/report-ports';
export declare const REPORT_METRIC_MODULES: unique symbol;
type ModuleMap = Readonly<Partial<Record<ReportDomain, DomainMetricModule>>>;
export declare const EXCEPTION_SOURCE_METRICS: Readonly<Record<string, MetricId[]>>;
export declare const COW_KEYED_ROW_METRIC_IDS: readonly MetricId[];
export declare const COW_LABEL_LOOKUP_BATCH = 1000;
export declare function logoObjectKey(logo: string | null | undefined, farmId: string): string | null;
export declare class ReportComputeService implements ReportComputePort {
    private readonly prisma;
    private readonly farmSettings;
    private readonly log;
    private readonly modules;
    private readonly registry;
    constructor(prisma: PrismaService, farmSettings: FarmSettingsService, logger: LoggerService, modules?: ModuleMap);
    compute(input: ReportComputeInput): Promise<ReportSnapshotPayload>;
    private resolveThresholds;
    private build;
    private labelCowRows;
    private isFinanceDef;
}
export {};
