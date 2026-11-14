import type { ReportPeriod } from '../../domain/contracts/period';
import type { ReportScope } from '../../domain/contracts/scope';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { MetricId } from '../../domain/contracts/metric-definition';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import type { ReportType } from '../../domain/contracts/enums';

/**
 * Ports shared by the API (RPT-08) and the pipeline (RPT-09). RPT-09 implements them, RPT-08 only
 * depends on the interfaces, so the two can be built in parallel and tested against fakes.
 */

export const REPORT_COMPUTE = Symbol('REPORT_COMPUTE');
export const REPORT_QUEUE = Symbol('REPORT_QUEUE');
export const REPORT_RENDERER = Symbol('REPORT_RENDERER');

export interface ReportComputeInput {
  farmId: string;
  /**
   * Whether the requester holds `finance.read`. Decided by the API from the caller's CURRENT
   * permissions; the compute service never infers it. False => no finance query is executed.
   */
  includeFinance: boolean;
  type: ReportType;
  /** Already resolved (preset/custom) by the API with the farm timezone. */
  period: ReportPeriod;
  scope: ReportScope;
  /** Validated subset of the template's allowed metrics (finance ids already stripped). */
  selectedMetricIds: readonly MetricId[];
  template: ReportTemplateDefinition;
  /** Instant the snapshot starts; the only "now" any metric may use. */
  generatedAt: Date;
}

/**
 * Builds a complete snapshot payload inside ONE RepeatableRead transaction: resolves scope and cow
 * presence from farm-owned rows, computes the previous period, runs the metric modules, assembles
 * sections in template order, then runs `assertNoFinance` (payload and registry) before returning.
 * Used both by preview (nothing persisted) and by generation (the pipeline persists the result).
 */
export interface ReportComputeService {
  compute(input: ReportComputeInput): Promise<ReportSnapshotPayload>;
}

export interface ReportQueue {
  /** Idempotent per report id: enqueueing the same id twice must not create two jobs. */
  enqueue(reportId: string): Promise<void>;
}

/** Renders the stored snapshot to a PDF. Implemented by RPT-11; until then a null renderer. */
export interface ReportRenderer {
  /** Null => no artifact available yet (the report is still COMPLETED, PDF download answers 404/409). */
  render(
    payload: ReportSnapshotPayload,
  ): Promise<{ body: Buffer; contentType: string } | null>;
}
