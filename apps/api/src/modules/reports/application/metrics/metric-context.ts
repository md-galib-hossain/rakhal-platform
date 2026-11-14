import type { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ReportScopeKind } from '../../domain/contracts/enums';
import type { ReportPeriod } from '../../domain/contracts/period';
import type { ReportThresholds } from '../../domain/contracts/template';
import type { DataQuality } from '../../domain/contracts/data-quality';
import type {
  ReportException,
  SnapshotSection,
} from '../../domain/contracts/snapshot';
import type { MetricDefinition } from '../../domain/contracts/metric-definition';

/**
 * Reads go through the snapshot transaction's client so every metric in one report sees the same
 * database state (RepeatableRead, RPT-09). Never use a different client inside a metric module.
 */
export type ReportDb = PrismaService | Prisma.TransactionClient;

/**
 * Everything a metric module needs. Built once per report by the orchestration layer (RPT-09);
 * metric modules never resolve scope, period or permissions themselves.
 */
export interface MetricContext {
  db: ReportDb;
  farmId: string;
  timezone: string;
  period: ReportPeriod;
  /** Previous equivalent period, when a comparison is meaningful. */
  previousPeriod: ReportPeriod | null;
  /** Scope kind of the report. Farm-wide figures must be `not_applicable` unless ALL_ELIGIBLE. */
  scopeKind: ReportScopeKind;
  /** Cows in scope AND present during the period (RPT-03 output). Already farm-scoped. */
  cattleIds: readonly string[];
  /** Cows in scope and present during the PREVIOUS period (for comparisons). */
  previousCattleIds: readonly string[];
  /** Per-cow presence window (farm-local YYYY-MM-DD, inclusive) for expected-day math. */
  cattlePresence?: ReadonlyMap<string, { startDate: string; endDate: string }>;
  /** Instant the snapshot began; the only "now" a metric may use. */
  generatedAt: Date;
  thresholds: ReportThresholds;
  /** False => finance-gated metrics must not be computed at all. */
  includeFinance: boolean;
}

/** What each domain module returns; the generator concatenates them in template order. */
export interface DomainMetricOutput {
  /** Null when the domain contributes nothing (e.g. finance without `includeFinance`): the generator omits it. */
  section: SnapshotSection | null;
  exceptions: ReportException[];
  dataQuality: DataQuality;
}

export interface DomainMetricModule {
  readonly definitions: readonly MetricDefinition[];
  compute(ctx: MetricContext): Promise<DomainMetricOutput>;
}
