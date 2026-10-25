import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SubscriptionAccessService } from '../../../subscription/application/services/subscription-access.service';
import { FEATURES } from '../../../subscription/domain/subscription-features';
import type { MetricId } from '../../domain/contracts/metric-definition';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import { ReportLifecycleService } from '../pipeline/report-lifecycle.service';
import { REPORT_QUEUE, type ReportQueue } from '../ports/report-ports';
import {
  decideScheduledRuns,
  SCHEDULED_TYPES,
  withinFinalizationWindow,
  type DueScheduledRun,
  type ScheduledType,
} from './decide-scheduled-runs';
import { SCHEDULE_FARM_BATCH } from './scheduling.constants';

/** A FAILED scheduled report is re-queued automatically at most this many times, then stays FAILED. */
export const SCHEDULED_MAX_AUTO_RETRIES = 2;

export interface ScheduleSweepResult {
  farms: number;
  created: number;
  alreadyExists: number;
  deferred: number;
  skippedNotEntitled: number;
  missed: number;
  /** FAILED scheduled reports re-queued by this sweep (manualRetries below the cap). */
  retriedFailed: number;
  /** FAILED scheduled reports left FAILED because the retry cap is reached. */
  failedExhausted: number;
  /** Farms whose evaluation threw (bad timezone etc.); the sweep continues with the next farm. */
  errors: number;
}

export interface ScheduleSweepOptions {
  /** Restrict the sweep to these farms (tests, targeted re-runs). */
  farmIds?: string[];
}

interface LoadedTemplate {
  id: string;
  version: number;
  finalizationMaxWaitHours: unknown;
  metricIds: MetricId[];
}

type Templates = Partial<Record<ScheduledType, LoadedTemplate>>;

const emptyResult = (): ScheduleSweepResult => ({
  farms: 0,
  created: 0,
  alreadyExists: 0,
  deferred: 0,
  skippedNotEntitled: 0,
  missed: 0,
  retriedFailed: 0,
  failedExhausted: 0,
  errors: 0,
});

/**
 * Hourly scheduled-report sweep (RPT-10, EPIC_REPORTS section 4). Idempotent: the unique `Report.scheduledKey`
 * is the claim, so repeated or concurrent sweeps (several instances) create one row per
 * farm/type/period/template version. A period that already has a scheduled report under ANY template version
 * is treated as existing: a newer template version affects future periods only.
 * Logs and returns counts only, never farm names or report content.
 */
@Injectable()
export class ReportScheduleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
    @Inject(REPORT_QUEUE) private readonly queue: ReportQueue,
    private readonly lifecycle: ReportLifecycleService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportScheduleService.name);
  }

  async sweep(
    now: Date,
    options: ScheduleSweepOptions = {},
  ): Promise<ScheduleSweepResult> {
    const result = emptyResult();
    const templates = await this.loadTemplates(now);
    if (SCHEDULED_TYPES.every((t) => !templates[t])) {
      this.log.warn('Scheduled reports sweep: no template published', {});
      return result;
    }

    let cursor: string | undefined;
    for (;;) {
      const idFilter: Prisma.StringFilter = {};
      if (options.farmIds) idFilter.in = options.farmIds;
      if (cursor) idFilter.gt = cursor;
      const farms = await this.prisma.farm.findMany({
        where: { status: 'ACTIVE', deletedAt: null, id: idFilter },
        select: { id: true, timezone: true, createdAt: true },
        orderBy: { id: 'asc' },
        take: SCHEDULE_FARM_BATCH,
      });
      if (farms.length === 0) break;
      cursor = farms[farms.length - 1].id;

      for (const farm of farms) {
        result.farms += 1;
        try {
          await this.sweepFarm(farm, now, templates, result);
        } catch (err) {
          result.errors += 1;
          this.log.error('Scheduled reports: farm evaluation failed', err, {
            farmId: farm.id,
          });
        }
      }
      if (farms.length < SCHEDULE_FARM_BATCH) break;
    }

    this.log.info('Scheduled reports sweep complete', { ...result });
    return result;
  }

  private async sweepFarm(
    farm: { id: string; timezone: string; createdAt: Date },
    now: Date,
    templates: Templates,
    result: ScheduleSweepResult,
  ): Promise<void> {
    const entitlement = await this.access.resolveEntitlement(farm.id);
    if (!entitlement.features.includes(FEATURES.REPORTS_SCHEDULED)) {
      result.skippedNotEntitled += 1;
      return;
    }

    const { due, missedCandidates } = decideScheduledRuns({
      farmId: farm.id,
      now,
      farmTimezone: farm.timezone,
      farmCreatedAt: farm.createdAt,
      templates,
    });
    if (due.length === 0 && missedCandidates.length === 0) return;

    // Deliberately NO deletedAt filter: a soft-deleted scheduled report is a tombstone (retention keeps it
    // for SCHEDULE_TOMBSTONE_DAYS) and its period counts as existing, so a user's delete is never undone.
    const existing = await this.prisma.report.findMany({
      where: {
        farmId: farm.id,
        origin: 'SCHEDULED',
        periodStartDate: {
          in: [
            ...due.map((d) => d.period.startDate),
            ...missedCandidates.map((m) => m.periodStartDate),
          ],
        },
      },
      select: {
        id: true,
        type: true,
        periodStartDate: true,
        status: true,
        manualRetries: true,
        deletedAt: true,
      },
    });
    const have = new Set(existing.map((r) => `${r.type}:${r.periodStartDate}`));

    // Catch-up for FAILED scheduled reports: re-queue under the cap, otherwise leave FAILED and say so.
    for (const r of existing) {
      if (r.status !== 'FAILED') continue;
      if (r.deletedAt) continue; // user deleted it: never resurrect by retrying
      if (r.manualRetries >= SCHEDULED_MAX_AUTO_RETRIES) {
        result.failedExhausted += 1;
        this.log.warn('Scheduled report failed and retries are exhausted', {
          reportId: r.id,
          manualRetries: r.manualRetries,
        });
        continue;
      }
      const reset = await this.lifecycle.resetForRetry(
        r.id,
        farm.id,
        SCHEDULED_MAX_AUTO_RETRIES,
      );
      if (!reset) continue;
      result.retriedFailed += 1;
      try {
        await this.queue.enqueue(r.id);
      } catch {
        this.log.warn(
          'Scheduled report retry enqueue failed; reconcile will retry',
          {
            reportId: r.id,
          },
        );
      }
    }

    for (const m of missedCandidates) {
      if (!have.has(`${m.type}:${m.periodStartDate}`)) result.missed += 1;
    }

    for (const run of due) {
      if (have.has(`${run.type}:${run.period.startDate}`)) {
        result.alreadyExists += 1;
        continue;
      }
      const template = templates[run.type];
      if (!template) continue;

      if (
        withinFinalizationWindow(
          now,
          run.runInstant,
          template.finalizationMaxWaitHours,
        ) &&
        (await this.hasUnsubmittedMilk(
          farm.id,
          run.period.startDate,
          run.period.endDate,
        ))
      ) {
        result.deferred += 1;
        continue;
      }

      const reportId = await this.createRow(farm.id, run, template);
      if (reportId === null) {
        result.alreadyExists += 1;
        continue;
      }
      result.created += 1;
      try {
        await this.queue.enqueue(reportId);
      } catch {
        // The row exists and is QUEUED: ReportReconcileService re-enqueues stale QUEUED rows.
        this.log.warn('Scheduled report enqueue failed; reconcile will retry', {
          reportId,
        });
      }
    }
  }

  private async hasUnsubmittedMilk(
    farmId: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const count = await this.prisma.milkLogEntry.count({
      where: {
        farmId,
        submitted: false,
        logDate: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T00:00:00.000Z`),
        },
      },
    });
    return count > 0;
  }

  /** Returns the new id, or null when the unique scheduledKey already exists. */
  private async createRow(
    farmId: string,
    run: DueScheduledRun,
    template: LoadedTemplate,
  ): Promise<string | null> {
    try {
      const row = await this.prisma.report.create({
        data: {
          farmId,
          origin: 'SCHEDULED',
          type: run.type,
          templateVersionId: template.id,
          periodStart: new Date(run.period.start),
          periodEnd: new Date(run.period.end),
          periodStartDate: run.period.startDate,
          periodEndDate: run.period.endDate,
          timezone: run.period.timezone,
          scope: { kind: 'ALL_ELIGIBLE' },
          selectedMetricIds: template.metricIds,
          // EPIC_REPORTS section 10: scheduled reports include finance; visible only to finance.read holders.
          includesFinance: true,
          status: 'QUEUED',
          requestedBy: null,
          scheduledKey: run.scheduledKey,
          expiresAt: null,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return null;
      }
      throw err;
    }
  }

  private async loadTemplates(now: Date): Promise<Templates> {
    const out: Templates = {};
    for (const type of SCHEDULED_TYPES) {
      const row = await this.prisma.reportTemplateVersion.findFirst({
        where: { type, effectiveFrom: { lte: now } },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, definition: true },
      });
      if (!row) continue;
      const def = row.definition as unknown as ReportTemplateDefinition;
      const ids = [
        ...new Set((def.sections ?? []).flatMap((s) => s.metricIds ?? [])),
      ];
      out[type] = {
        id: row.id,
        version: row.version,
        finalizationMaxWaitHours: def.thresholds?.finalizationMaxWaitHours,
        metricIds: ids,
      };
    }
    return out;
  }
}
