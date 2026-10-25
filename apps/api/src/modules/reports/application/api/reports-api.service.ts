import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from 'src/modules/media/application/ports/object-storage.port';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { SYSTEM_ROLES } from 'src/modules/permission/domain/permission-catalogue';
import {
  DATE_PRESETS,
  REPORT_DOMAINS,
  REPORT_SCOPE_KINDS,
} from '../../domain/contracts/enums';
import type { ReportScope } from '../../domain/contracts/scope';
import type { ReportPeriod } from '../../domain/contracts/period';
import type { MetricId } from '../../domain/contracts/metric-definition';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import {
  assertNoFinance,
  type ReportSnapshotPayload,
} from '../../domain/contracts/snapshot';
import { PeriodError } from '../../domain/period/errors';
import {
  MAX_CUSTOM_RANGE_DAYS,
  resolvePreset,
} from '../../domain/period/period-resolver';
import { METRIC_REGISTRY } from '../metrics/registry';
import {
  REPORT_COMPUTE,
  REPORT_QUEUE,
  type ReportComputeService,
  type ReportQueue,
} from '../ports/report-ports';
import {
  allowedMetricIds,
  isFinanceMetric,
  sameMetricSet,
  scopeIdentity,
  validateMetricSelection,
} from './report-selection';
import {
  DUPLICATE_FRESH_MINUTES,
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_IN_FLIGHT_REPORTS,
  MAX_MANUAL_RETRIES,
  MAX_PREVIEWS_GLOBAL,
  MAX_PREVIEWS_PER_FARM,
  MAX_SELECTED_METRICS,
  ON_DEMAND_TEMPLATE_ALIAS,
  PDF_CONTENT_TYPE,
  PROCESSING_LEASE_MINUTES,
  ReportApiReason,
  STALE_IN_FLIGHT_MINUTES,
} from './reports-api.constants';
import { PreviewLimiter } from './preview-limiter';
import {
  REPORT_LIFECYCLE,
  type CreateReportResult,
  type ReportCaller,
  type ReportDetail,
  type ReportDownload,
  type ReportLifecyclePort,
  type ReportSummary,
} from './reports-api.types';

/** Request shape after DTO validation (the DTOs implement this structurally). */
export interface ReportConfigInput {
  templateId: string;
  period: {
    preset: (typeof DATE_PRESETS)[number];
    customStartDate?: string;
    customEndDate?: string;
  };
  scope: {
    kind: (typeof REPORT_SCOPE_KINDS)[number];
    cattleId?: string;
    groupId?: string;
  };
  selectedMetricIds: string[];
  compare?: boolean;
  forceNew?: boolean;
}

export interface ReportListFilters {
  limit: number;
  cursor?: string;
  sortOrder: 'asc' | 'desc';
  type?: 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';
  origin?: 'SCHEDULED' | 'ON_DEMAND';
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

const SUMMARY_SELECT = {
  id: true,
  type: true,
  origin: true,
  status: true,
  periodStartDate: true,
  periodEndDate: true,
  timezone: true,
  scope: true,
  selectedMetricIds: true,
  includesFinance: true,
  attempts: true,
  errorCategory: true,
  errorMessage: true,
  artifactKey: true,
  artifactBytes: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  expiresAt: true,
  templateVersion: { select: { version: true } },
} satisfies Prisma.ReportSelect;

type SummaryRow = Prisma.ReportGetPayload<{ select: typeof SUMMARY_SELECT }>;

const DUPLICATE_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED'] as const;
const MINUTE_MS = 60_000;

/** Prisma client or interactive-transaction client. */
type Db = Prisma.TransactionClient;

type CreateOutcome =
  | { kind: 'replay'; report: ReportSummary }
  | { kind: 'duplicate'; existing: ReportSummary }
  | { kind: 'created'; row: SummaryRow };

@Injectable()
export class ReportsApiService {
  private readonly log: LoggerService;
  private readonly previewLimiter = new PreviewLimiter(
    MAX_PREVIEWS_PER_FARM,
    MAX_PREVIEWS_GLOBAL,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly farmClock: FarmClockService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(REPORT_LIFECYCLE) private readonly lifecycle: ReportLifecyclePort,
    @Inject(REPORT_COMPUTE) private readonly compute: ReportComputeService,
    @Inject(REPORT_QUEUE) private readonly queue: ReportQueue,
  ) {
    this.log = this.logger.setContext(ReportsApiService.name);
  }

  // ── catalogue ─────────────────────────────────────────────────────────────

  async templates(caller: ReportCaller) {
    const canFinance = await this.canFinance(caller);
    const onDemand = await this.latestTemplate('ON_DEMAND');
    const [weekly, monthly] = await Promise.all([
      this.latestTemplateRow('WEEKLY'),
      this.latestTemplateRow('MONTHLY'),
    ]);

    const sections: Array<{
      id: string;
      domain: string;
      titleKey: string;
      metrics: Array<{
        id: string;
        unit: string;
        labelKey: string;
        definitionKey: string;
        requiresFinance: boolean;
      }>;
    }> = [];
    for (const section of onDemand.definition.sections ?? []) {
      const metrics = (section.metricIds ?? [])
        .map((id) => METRIC_REGISTRY[id])
        .filter((def) => !!def && (canFinance || !isFinanceMetric(def)))
        .map((def) => ({
          id: def.id,
          unit: def.unit,
          labelKey: `reports.metrics.${def.id}.label`,
          definitionKey: `reports.metrics.${def.id}.definition`,
          requiresFinance: isFinanceMetric(def),
        }));
      if (metrics.length === 0) continue; // never list an all-finance section to a non-finance caller
      sections.push({
        id: section.id,
        domain: section.domain,
        titleKey: section.titleKey,
        metrics,
      });
    }

    return {
      onDemand: {
        id: onDemand.id,
        alias: ON_DEMAND_TEMPLATE_ALIAS,
        version: onDemand.definition.version,
        domains: REPORT_DOMAINS.filter((d) =>
          sections.some((s) => s.domain === d),
        ),
        sections,
      },
      scheduled: {
        weekly: weekly ? { version: weekly.version } : null,
        monthly: monthly ? { version: monthly.version } : null,
      },
      datePresets: [...DATE_PRESETS],
      scopeKinds: [...REPORT_SCOPE_KINDS],
      limits: {
        maxMetrics: MAX_SELECTED_METRICS,
        maxCustomRangeDays: MAX_CUSTOM_RANGE_DAYS,
      },
    };
  }

  // ── preview ───────────────────────────────────────────────────────────────

  async preview(
    caller: ReportCaller,
    dto: ReportConfigInput,
  ): Promise<ReportSnapshotPayload> {
    const release = this.previewLimiter.tryAcquire(caller.farmId);
    if (!release) {
      throw new HttpException(
        {
          message: 'A preview is already running. Try again shortly.',
          details: { reason: ReportApiReason.PREVIEW_BUSY },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const canFinance = await this.canFinance(caller);
      const prepared = await this.prepare(caller, dto, canFinance);
      const payload = await this.compute.compute({
        farmId: caller.farmId,
        includeFinance: canFinance,
        type: 'ON_DEMAND',
        period: prepared.period,
        scope: prepared.scope,
        selectedMetricIds: prepared.selectedMetricIds,
        template: prepared.template.definition,
        generatedAt: new Date(),
      });
      if (!canFinance) assertNoFinance(payload);
      await this.auditSafe(caller, AuditAction.REPORT_PREVIEWED, null, {
        type: 'ON_DEMAND',
        periodStart: prepared.period.startDate,
        periodEnd: prepared.period.endDate,
      });
      return payload;
    } finally {
      release();
    }
  }

  // ── create ────────────────────────────────────────────────────────────────

  async create(
    caller: ReportCaller,
    dto: ReportConfigInput,
    idempotencyKey?: string,
  ): Promise<CreateReportResult> {
    const key = this.normaliseIdempotencyKey(idempotencyKey);
    const canFinance = await this.canFinance(caller);
    const prepared = await this.prepare(caller, dto, canFinance);
    const includesFinance =
      canFinance &&
      prepared.selectedMetricIds.some((id) => {
        const def = METRIC_REGISTRY[id];
        return !!def && isFinanceMetric(def);
      });
    const requestHash = this.requestHash(prepared, includesFinance);

    let outcome: CreateOutcome;
    try {
      // One transaction per farm (advisory lock) so the duplicate check, the in-flight cap and the
      // insert cannot interleave across concurrent requests.
      outcome = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reports:${caller.farmId}`}))`;
        if (key) {
          const replay = await this.findByIdempotencyKey(
            tx,
            caller,
            key,
            canFinance,
            requestHash,
          );
          if (replay) return { kind: 'replay', report: replay };
        }
        if (!dto.forceNew) {
          const existing = await this.findDuplicate(
            tx,
            caller.farmId,
            prepared,
            includesFinance,
          );
          if (existing) return { kind: 'duplicate', existing };
        }
        await this.assertInFlightCapacity(tx, caller.farmId);
        const created = await tx.report.create({
          data: {
            farmId: caller.farmId,
            origin: 'ON_DEMAND',
            type: 'ON_DEMAND',
            templateVersionId: prepared.template.id,
            periodStart: new Date(prepared.period.start),
            periodEnd: new Date(prepared.period.end),
            periodStartDate: prepared.period.startDate,
            periodEndDate: prepared.period.endDate,
            timezone: prepared.period.timezone,
            scope: prepared.scope,
            selectedMetricIds: prepared.selectedMetricIds,
            includesFinance,
            status: 'QUEUED',
            requestedBy: caller.userId,
            idempotencyKey: key ?? null,
            requestHash,
          },
          select: SUMMARY_SELECT,
        });
        return { kind: 'created', row: created };
      });
    } catch (err) {
      if (
        key &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Unique-key loss: the failed tx is rolled back, read the winner outside it.
        const replay = await this.findByIdempotencyKey(
          this.prisma,
          caller,
          key,
          canFinance,
          requestHash,
        );
        if (replay) return { duplicate: false, replayed: true, report: replay };
        throw this.idempotencyConflict();
      }
      throw err;
    }
    if (outcome.kind === 'replay') {
      return { duplicate: false, replayed: true, report: outcome.report };
    }
    if (outcome.kind === 'duplicate') {
      return { duplicate: true, existing: outcome.existing };
    }
    const row = outcome.row;

    try {
      await this.queue.enqueue(row.id);
    } catch (err) {
      this.log.error('Report enqueue failed', err, { reportId: row.id });
      await this.prisma.report
        .updateMany({
          where: { id: row.id, farmId: caller.farmId, status: 'QUEUED' },
          data: {
            status: 'FAILED',
            errorCategory: 'QUEUE_UNAVAILABLE',
            errorMessage: 'The report could not be queued. Please retry.',
          },
        })
        .catch(() => undefined);
      throw new ServiceUnavailableException({
        message: 'The report could not be queued. Please retry.',
        details: {
          reason: ReportApiReason.QUEUE_UNAVAILABLE,
          reportId: row.id,
        },
      });
    }

    await this.auditSafe(caller, AuditAction.REPORT_GENERATED, row.id, {
      type: 'ON_DEMAND',
      periodStart: prepared.period.startDate,
      periodEnd: prepared.period.endDate,
      includesFinance,
    });
    return { duplicate: false, replayed: false, report: this.toSummary(row) };
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  async list(caller: ReportCaller, query: ReportListFilters) {
    const canFinance = await this.canFinance(caller);
    const rows = await this.prisma.report.findMany({
      where: {
        ...this.visibleWhere(caller.farmId, canFinance),
        ...(query.type ? { type: query.type } : {}),
        ...(query.origin ? { origin: query.origin } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: SUMMARY_SELECT,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { items: page.items.map((r) => this.toSummary(r)), meta: page.meta };
  }

  async getOne(caller: ReportCaller, id: string): Promise<ReportDetail> {
    const canFinance = await this.canFinance(caller);
    const row = await this.prisma.report.findFirst({
      where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
      select: { ...SUMMARY_SELECT, snapshot: { select: { payload: true } } },
    });
    if (!row) throw this.notFound();

    let payload: ReportSnapshotPayload | null = null;
    if (row.status === 'COMPLETED' && row.snapshot) {
      payload = row.snapshot.payload as unknown as ReportSnapshotPayload;
      if (!canFinance) {
        try {
          assertNoFinance(payload);
        } catch {
          this.log.error(
            'Finance content in finance-free report view',
            undefined,
            {
              reportId: row.id,
            },
          );
          throw this.notFound();
        }
      }
    }
    return { ...this.toSummary(row), payload };
  }

  async download(caller: ReportCaller, id: string): Promise<ReportDownload> {
    const canFinance = await this.canFinance(caller);
    const row = await this.prisma.report.findFirst({
      where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
      select: {
        id: true,
        type: true,
        status: true,
        periodStartDate: true,
        periodEndDate: true,
        artifactKey: true,
        artifactContentType: true,
      },
    });
    if (!row) throw this.notFound();
    if (row.status !== 'COMPLETED' || !row.artifactKey) {
      throw new ConflictException({
        message: 'The PDF for this report is not available',
        details: { reason: ReportApiReason.PDF_NOT_AVAILABLE },
      });
    }
    let body: Buffer;
    try {
      body = await this.storage.get(row.artifactKey);
    } catch (err) {
      this.log.error('Report artifact read failed', err, { reportId: row.id });
      throw new ServiceUnavailableException({
        message: 'The PDF could not be read. Try again shortly.',
        details: { reason: ReportApiReason.STORAGE_UNAVAILABLE },
      });
    }
    await this.auditSafe(caller, AuditAction.REPORT_DOWNLOADED, row.id, {
      type: row.type,
      periodStart: row.periodStartDate,
      periodEnd: row.periodEndDate,
    });
    return {
      body,
      contentType: row.artifactContentType ?? PDF_CONTENT_TYPE,
      fileName: this.fileName(row.type, row.periodStartDate, row.periodEndDate),
    };
  }

  // ── retry / delete ────────────────────────────────────────────────────────

  async retry(caller: ReportCaller, id: string): Promise<ReportSummary> {
    const canFinance = await this.canFinance(caller);
    const row = await this.prisma.report.findFirst({
      where: { id, ...this.visibleWhere(caller.farmId, canFinance) },
      select: { id: true, status: true, type: true, manualRetries: true },
    });
    if (!row) throw this.notFound();
    if (row.status !== 'FAILED') {
      throw new ConflictException({
        message: 'Only a failed report can be retried',
        details: { reason: ReportApiReason.NOT_RETRYABLE },
      });
    }
    if (row.manualRetries >= MAX_MANUAL_RETRIES) {
      throw new ConflictException({
        message: 'This report was retried too many times',
        details: {
          reason: ReportApiReason.RETRY_LIMIT,
          max: MAX_MANUAL_RETRIES,
        },
      });
    }
    await this.assertInFlightCapacity(this.prisma, caller.farmId);
    const reset = await this.lifecycle.resetForRetry(
      row.id,
      caller.farmId,
      MAX_MANUAL_RETRIES,
    );
    if (!reset) {
      throw new ConflictException({
        message: 'Only a failed report can be retried',
        details: { reason: ReportApiReason.NOT_RETRYABLE },
      });
    }
    try {
      await this.queue.enqueue(row.id);
    } catch (err) {
      this.log.error('Report re-enqueue failed', err, { reportId: row.id });
      await this.prisma.report
        .updateMany({
          where: { id: row.id, farmId: caller.farmId, status: 'QUEUED' },
          data: {
            status: 'FAILED',
            errorCategory: 'QUEUE_UNAVAILABLE',
            errorMessage: 'The report could not be queued. Please retry.',
          },
        })
        .catch(() => undefined);
      throw new ServiceUnavailableException({
        message: 'The report could not be queued. Please retry.',
        details: { reason: ReportApiReason.QUEUE_UNAVAILABLE },
      });
    }
    await this.auditSafe(caller, AuditAction.REPORT_RETRIED, row.id, {
      type: row.type,
      attempt: row.manualRetries + 1,
    });
    const fresh = await this.prisma.report.findFirst({
      where: { id: row.id, farmId: caller.farmId, deletedAt: null },
      select: SUMMARY_SELECT,
    });
    if (!fresh) throw this.notFound();
    return this.toSummary(fresh);
  }

  async remove(caller: ReportCaller, id: string): Promise<{ deleted: true }> {
    // Defence in depth: `reports.delete` is checked by the guard, the Owner role here.
    if (!this.isOwner(caller)) {
      throw new ForbiddenException({
        message: 'Only the farm owner can delete reports',
        details: { reason: ReportApiReason.OWNER_ONLY },
      });
    }
    const row = await this.prisma.report.findFirst({
      where: { id, farmId: caller.farmId, deletedAt: null },
      select: {
        id: true,
        type: true,
        artifactKey: true,
        status: true,
        startedAt: true,
      },
    });
    if (!row) throw this.notFound();
    const leaseCutoff = new Date(
      Date.now() - PROCESSING_LEASE_MINUTES * MINUTE_MS,
    );
    if (
      row.status === 'PROCESSING' &&
      (!row.startedAt || row.startedAt > leaseCutoff)
    ) {
      throw new ConflictException({
        message: 'This report is being generated and cannot be deleted yet',
        details: { reason: ReportApiReason.PROCESSING },
      });
    }

    const res = await this.prisma.report.updateMany({
      where: {
        id: row.id,
        farmId: caller.farmId,
        deletedAt: null,
        // Re-check at write time: a worker may have claimed the row since the read.
        NOT: { status: 'PROCESSING', startedAt: { gt: leaseCutoff } },
      },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw this.notFound();

    if (row.artifactKey) {
      try {
        await this.storage.delete(row.artifactKey);
        await this.prisma.report.updateMany({
          where: { id: row.id, farmId: caller.farmId },
          data: { artifactKey: null },
        });
      } catch (err) {
        // Best effort: the orphaned object is cleaned up by RPT-10. Log the id only.
        this.log.error('Report artifact delete failed', err, {
          reportId: row.id,
        });
      }
    }
    await this.auditSafe(caller, AuditAction.REPORT_DELETED, row.id, {
      type: row.type,
    });
    return { deleted: true };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  isOwner(caller: ReportCaller): boolean {
    return caller.isSystemRole && caller.roleName === SYSTEM_ROLES.OWNER;
  }

  private canFinance(caller: ReportCaller): Promise<boolean> {
    return this.permissions.hasPermission(
      caller.userId,
      caller.farmId,
      caller.permissionsVersion,
      ['finance.read'],
    );
  }

  /** Farm-scoped, not deleted, not expired, finance rows hidden without `finance.read`. */
  private visibleWhere(
    farmId: string,
    canFinance: boolean,
  ): Prisma.ReportWhereInput {
    return {
      farmId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(canFinance ? {} : { includesFinance: false }),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Report not found');
  }

  private idempotencyConflict(): ConflictException {
    return new ConflictException({
      message: 'This idempotency key cannot be reused',
      details: { reason: ReportApiReason.IDEMPOTENCY_CONFLICT },
    });
  }

  /** Rows that count toward the cap: QUEUED/PROCESSING and younger than the stale window. */
  private async assertInFlightCapacity(
    db: Db | PrismaService,
    farmId: string,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_IN_FLIGHT_MINUTES * MINUTE_MS);
    const inFlight = await db.report.count({
      where: {
        farmId,
        deletedAt: null,
        OR: [
          { status: 'QUEUED', createdAt: { gt: cutoff } },
          {
            status: 'PROCESSING',
            OR: [
              { startedAt: { gt: cutoff } },
              { startedAt: null, createdAt: { gt: cutoff } },
            ],
          },
        ],
      },
    });
    if (inFlight >= MAX_IN_FLIGHT_REPORTS) {
      throw new HttpException(
        {
          message: 'Too many reports are being generated. Try again shortly.',
          details: {
            reason: ReportApiReason.TOO_MANY_IN_FLIGHT,
            max: MAX_IN_FLIGHT_REPORTS,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** SHA-256 of the canonical normalised request (not forceNew, not the idempotency key). */
  private requestHash(
    prepared: {
      template: { id: string };
      selectedMetricIds: readonly string[];
      scope: ReportScope;
      period: ReportPeriod;
    },
    includesFinance: boolean,
  ): string {
    const canonical = JSON.stringify({
      templateVersionId: prepared.template.id,
      periodStart: prepared.period.startDate,
      periodEnd: prepared.period.endDate,
      timezone: prepared.period.timezone,
      scope: scopeIdentity(prepared.scope),
      metricIds: [...new Set(prepared.selectedMetricIds)].sort(),
      includesFinance,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private async latestTemplateRow(type: 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND') {
    return this.prisma.reportTemplateVersion.findFirst({
      where: { type, effectiveFrom: { lte: new Date() } },
      orderBy: [{ version: 'desc' }],
      select: { id: true, version: true, definition: true },
    });
  }

  private async latestTemplate(
    type: 'ON_DEMAND',
  ): Promise<{ id: string; definition: ReportTemplateDefinition }> {
    const row = await this.latestTemplateRow(type);
    if (!row) {
      throw new ServiceUnavailableException({
        message: 'No report template is published',
        details: { reason: ReportApiReason.TEMPLATE_UNAVAILABLE },
      });
    }
    return {
      id: row.id,
      definition: row.definition as unknown as ReportTemplateDefinition,
    };
  }

  /** Shared by preview and create: template, selection, scope and period, all validated. */
  private async prepare(
    caller: ReportCaller,
    dto: ReportConfigInput,
    canFinance: boolean,
  ) {
    const template = await this.latestTemplate('ON_DEMAND');
    if (
      dto.templateId !== ON_DEMAND_TEMPLATE_ALIAS &&
      dto.templateId !== template.id
    ) {
      throw new BadRequestException({
        message: 'Unknown report template',
        details: { reason: ReportApiReason.INVALID_TEMPLATE },
      });
    }
    const selectedMetricIds = validateMetricSelection({
      requested: dto.selectedMetricIds,
      allowed: allowedMetricIds(template.definition, METRIC_REGISTRY),
      registry: METRIC_REGISTRY,
      canFinance,
    });
    const scope = await this.resolveScope(caller.farmId, dto.scope);
    const period = await this.resolvePeriod(caller.farmId, dto.period);
    return { template, selectedMetricIds, scope, period };
  }

  private async resolveScope(
    farmId: string,
    input: ReportConfigInput['scope'],
  ): Promise<ReportScope> {
    const invalid = () =>
      new BadRequestException({
        message: 'Invalid report scope',
        details: { reason: ReportApiReason.INVALID_SCOPE },
      });
    if (input.kind === 'ALL_ELIGIBLE') {
      if (input.cattleId || input.groupId) throw invalid();
      return { kind: 'ALL_ELIGIBLE' };
    }
    if (input.kind === 'SINGLE_COW') {
      if (!input.cattleId || input.groupId) throw invalid();
      const cow = await this.prisma.cattle.findFirst({
        where: { id: input.cattleId, farmId },
        select: { id: true },
      });
      if (!cow) throw new NotFoundException('Animal not found');
      return { kind: 'SINGLE_COW', cattleId: cow.id };
    }
    if (!input.groupId || input.cattleId) throw invalid();
    const group = await this.prisma.animalGroup.findFirst({
      where: { id: input.groupId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    return {
      kind: 'GROUP',
      groupId: group.id,
      membershipAsOf: new Date().toISOString(),
    };
  }

  private async resolvePeriod(
    farmId: string,
    input: ReportConfigInput['period'],
  ): Promise<ReportPeriod> {
    const timezone = await this.farmClock.timezone(farmId);
    const custom =
      input.preset === 'custom'
        ? input.customStartDate && input.customEndDate
          ? { from: input.customStartDate, to: input.customEndDate }
          : undefined
        : undefined;
    if (
      input.preset !== 'custom' &&
      (input.customStartDate || input.customEndDate)
    ) {
      throw new BadRequestException({
        message: 'Custom dates are only valid with the custom preset',
        details: { reason: ReportApiReason.INVALID_PERIOD },
      });
    }
    try {
      return resolvePreset(input.preset, new Date(), timezone, custom);
    } catch (err) {
      if (err instanceof PeriodError) {
        throw new BadRequestException({
          message: 'Invalid report period',
          details: { reason: ReportApiReason.INVALID_PERIOD, code: err.code },
        });
      }
      throw err;
    }
  }

  private normaliseIdempotencyKey(raw?: string): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    const key = String(raw).trim();
    if (
      key.length === 0 ||
      key.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
      !/^[A-Za-z0-9._:-]+$/.test(key)
    ) {
      throw new BadRequestException({
        message: 'Invalid Idempotency-Key',
        details: { reason: ReportApiReason.INVALID_IDEMPOTENCY_KEY },
      });
    }
    return key;
  }

  private async findByIdempotencyKey(
    db: Db | PrismaService,
    caller: ReportCaller,
    key: string,
    canFinance: boolean,
    requestHash: string,
  ): Promise<ReportSummary | null> {
    const row = await db.report.findFirst({
      where: {
        farmId: caller.farmId,
        requestedBy: caller.userId,
        idempotencyKey: key,
      },
      select: { ...SUMMARY_SELECT, deletedAt: true, requestHash: true },
    });
    if (!row) return null;
    // A key whose report was deleted, or that now needs finance access, cannot be replayed.
    if (row.deletedAt || (row.includesFinance && !canFinance)) {
      throw this.idempotencyConflict();
    }
    // Same key, different request => conflict. Legacy rows (null hash) replay unchecked.
    if (row.requestHash && row.requestHash !== requestHash) {
      throw this.idempotencyConflict();
    }
    return this.toSummary(row);
  }

  private async findDuplicate(
    db: Db,
    farmId: string,
    prepared: {
      template: { id: string };
      period: ReportPeriod;
      scope: ReportScope;
      selectedMetricIds: readonly MetricId[];
    },
    includesFinance: boolean,
  ): Promise<ReportSummary | null> {
    const { period, scope } = prepared;
    const candidates = await db.report.findMany({
      where: {
        farmId,
        deletedAt: null,
        templateVersionId: prepared.template.id,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
        timezone: period.timezone,
        includesFinance,
        status: { in: [...DUPLICATE_STATUSES] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ...SUMMARY_SELECT, periodEnd: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
    });
    const wanted = scopeIdentity(scope);
    const now = Date.now();
    const staleCutoff = now - STALE_IN_FLIGHT_MINUTES * MINUTE_MS;
    const freshCutoff = now - DUPLICATE_FRESH_MINUTES * MINUTE_MS;
    const reusable = (r: (typeof candidates)[number]): boolean => {
      if (r.status === 'COMPLETED') {
        const completedAt = r.completedAt?.getTime();
        if (completedAt === undefined) return false;
        if (completedAt >= freshCutoff) return true;
        // Only a period that had already closed when generated is immutable; group membership
        // is as-of generation, so GROUP reuses only inside the fresh window.
        return scope.kind !== 'GROUP' && r.periodEnd.getTime() <= completedAt;
      }
      // In-flight twins are reusable, unless the job was lost (stale).
      const since = (r.startedAt ?? r.createdAt).getTime();
      return since > staleCutoff;
    };
    const hit = candidates.find(
      (r) =>
        reusable(r) &&
        scopeIdentity(r.scope as unknown as ReportScope) === wanted &&
        sameMetricSet(
          r.selectedMetricIds as unknown as string[],
          prepared.selectedMetricIds,
        ),
    );
    return hit ? this.toSummary(hit) : null;
  }

  private toSummary(row: SummaryRow): ReportSummary {
    return {
      id: row.id,
      type: row.type,
      origin: row.origin,
      status: row.status,
      templateVersion: row.templateVersion?.version ?? null,
      period: {
        startDate: row.periodStartDate,
        endDate: row.periodEndDate,
        timezone: row.timezone,
      },
      scope: row.scope as unknown as ReportScope,
      selectedMetricIds: row.selectedMetricIds as unknown as string[],
      includesFinance: row.includesFinance,
      hasPdf: row.status === 'COMPLETED' && !!row.artifactKey,
      pdfBytes: row.artifactBytes ?? null,
      attempts: row.attempts,
      errorCategory: row.status === 'FAILED' ? row.errorCategory : null,
      errorMessage:
        row.status === 'FAILED' && row.errorMessage
          ? row.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
          : null,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      expiresAt: row.expiresAt,
    };
  }

  /** Built from type + period only, restricted to a safe character set. */
  private fileName(type: string, start: string, end: string): string {
    const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
    const base = `report-${safe(type.toLowerCase())}-${safe(start)}_${safe(end)}`;
    return `${base}.pdf`;
  }

  private async auditSafe(
    caller: ReportCaller,
    action: AuditAction,
    reportId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        actorUserId: caller.userId,
        action,
        entityType: 'Report',
        entityId: reportId,
        farmId: caller.farmId,
        metadata,
      });
    } catch (err) {
      this.log.error('Report audit write failed', err, {
        reportId,
        action: String(action),
      });
    }
  }
}
