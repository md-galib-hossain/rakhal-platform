import {
  BadRequestException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportFormat, ReportJobStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OBJECT_STORAGE } from 'src/modules/media/application/ports/object-storage.port';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import { renderCsv } from '../../domain/csv-renderer';
import { renderPdf } from '../../domain/pdf-renderer';
import { groupedCatalogue, isKnownReport } from '../../domain/report-catalogue';
import { GenerateReportDto } from '../../presentation/dto/generate-report.dto';
import { ReportsQueueService } from '../../infrastructure/queue/reports-queue.service';
import {
  ReportGeneratorsService,
  ReportParams,
} from './report-generators.service';

/** Generated files live for this many days before download returns 410. */
const REPORT_TTL_DAYS = 7;

/** RD-013: caps against a farm flooding either the job queue or R2 storage. */
const MAX_CONCURRENT_JOBS_PER_FARM = 3;
const MAX_STORED_REPORTS_PER_FARM = 50;

export interface ReportDownload {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * Reports module orchestrator (PRD §22 / API §15). Owns the `ReportJob`
 * lifecycle: catalogue → generate (queued on BullMQ, RD-013a) → status →
 * download. Output is stored in Cloudflare R2 via the shared `OBJECT_STORAGE`
 * seam (RD-013b) and downloaded via a short-lived presigned URL; `fileData`
 * (legacy bytea) is only read for rows written before this change.
 */
@Injectable()
export class ReportsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly generators: ReportGeneratorsService,
    private readonly logger: LoggerService,
    private readonly queue: ReportsQueueService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {
    this.log = this.logger.setContext(ReportsService.name);
  }

  /** `GET /reports` — the catalogue grouped by category + each report's last run. */
  async catalogue(farmId: string) {
    const lastRuns = await this.prisma.reportJob.groupBy({
      by: ['reportId'],
      where: { farmId, status: ReportJobStatus.COMPLETED },
      _max: { createdAt: true },
    });
    const lastById = new Map(
      lastRuns.map((r) => [r.reportId, r._max.createdAt]),
    );

    return {
      report_categories: groupedCatalogue().map((group) => ({
        category: group.category,
        reports: group.reports.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          formats: r.formats,
          frequency: r.frequency,
          version: r.version,
          params: r.params,
          last_generated: lastById.get(r.id) ?? null,
        })),
      })),
    };
  }

  /** `POST /reports/generate` — creates the job and enqueues it (RD-013a: async via BullMQ). */
  async generate(farmId: string, userId: string, dto: GenerateReportDto) {
    if (!isKnownReport(dto.reportId)) {
      throw new BadRequestException(`Unknown report: ${dto.reportId}`);
    }
    await this.assertUnderConcurrentJobCap(farmId);
    const params: ReportParams = dto.parameters ?? {};

    const job = await this.prisma.reportJob.create({
      data: {
        farmId,
        reportId: dto.reportId,
        format: dto.format,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: params as any,
        status: ReportJobStatus.QUEUED,
        createdBy: userId,
      },
      select: { id: true },
    });

    await this.queue.enqueue(job.id);
    this.log.info('Report queued', {
      jobId: job.id,
      farmId,
      reportId: dto.reportId,
      format: dto.format,
    });

    return { job_id: job.id, status: 'queued', estimated_seconds: 5 };
  }

  /**
   * Creates + immediately enqueues a job on a schedule's behalf
   * (`ReportScheduleRunner`) — same path as `generate()` but farm/report/format
   * come from the `ReportSchedule` row, and the job is tagged `scheduleId`.
   */
  async generateForSchedule(schedule: {
    id: string;
    farmId: string;
    reportId: string;
    format: ReportFormat;
    params: unknown;
    createdBy: string;
  }): Promise<string> {
    await this.assertUnderConcurrentJobCap(schedule.farmId);
    const job = await this.prisma.reportJob.create({
      data: {
        farmId: schedule.farmId,
        reportId: schedule.reportId,
        format: schedule.format,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: (schedule.params ?? {}) as any,
        status: ReportJobStatus.QUEUED,
        createdBy: schedule.createdBy,
        scheduleId: schedule.id,
      },
      select: { id: true },
    });
    await this.queue.enqueue(job.id);
    return job.id;
  }

  /**
   * Runs the actual generation for a queued job — called by `ReportProcessor`
   * off the request thread. Not farm-scoped in its `where` (the processor only
   * has a jobId), but the job row itself carries `farmId` for everything it
   * touches downstream.
   */
  async executeJob(jobId: string): Promise<void> {
    const job = await this.prisma.reportJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    await this.prisma.reportJob.update({
      where: { id: jobId },
      data: { status: ReportJobStatus.GENERATING },
    });

    try {
      const params = (job.params ?? {}) as ReportParams;
      const data = await this.generators.generate(
        job.farmId,
        job.reportId,
        params,
      );
      const buffer =
        job.format === ReportFormat.CSV
          ? renderCsv(data)
          : await renderPdf(data);
      const ext = job.format === ReportFormat.CSV ? 'csv' : 'pdf';
      const fileName = `${job.reportId}_${this.stamp()}.${ext}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REPORT_TTL_DAYS);

      const storageKey = `reports/${job.farmId}/${job.id}.${ext}`;
      await this.storage.put({
        key: storageKey,
        body: Buffer.from(buffer),
        contentType: this.contentTypeFor(job.format),
      });

      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: ReportJobStatus.COMPLETED,
          title: data.title,
          fileName,
          storageKey,
          byteSize: buffer.length,
          expiresAt,
        },
      });
      this.log.info('Report generated', {
        jobId: job.id,
        farmId: job.farmId,
        reportId: job.reportId,
        format: job.format,
        bytes: buffer.length,
      });

      await this.enforceStoredReportCap(job.farmId);
    } catch (error) {
      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: ReportJobStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  /** `GET /reports/jobs/:id` — status + download link + expiry. */
  async getJob(farmId: string, id: string) {
    const job = await this.getJobOrThrow(farmId, id);
    return {
      job_id: job.id,
      report_id: job.reportId,
      status: job.status.toLowerCase(),
      format: job.format.toLowerCase(),
      file_name: job.fileName,
      byte_size: job.byteSize,
      error: job.error,
      download_url:
        job.status === ReportJobStatus.COMPLETED
          ? `/api/v1/reports/jobs/${job.id}/download`
          : null,
      expires_at: job.expiresAt,
    };
  }

  /**
   * `GET /reports/jobs/:id/download` — fetches bytes from R2 (via the shared
   * `OBJECT_STORAGE` seam) for jobs generated after RD-013(b); legacy
   * pre-migration jobs (still only holding `fileData`) read straight from the
   * row. Either way the controller streams the same response shape as before.
   */
  async download(farmId: string, id: string): Promise<ReportDownload> {
    const job = await this.getJobOrThrow(farmId, id);
    if (job.status !== ReportJobStatus.COMPLETED) {
      throw new BadRequestException('Report is not ready for download');
    }
    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Report download has expired; regenerate it');
    }
    const fileName =
      job.fileName ?? `${job.reportId}.${job.format.toLowerCase()}`;
    const contentType = this.contentTypeFor(job.format);
    if (job.storageKey) {
      const buffer = await this.storage.get(job.storageKey);
      return { fileName, contentType, buffer };
    }
    if (job.fileData) {
      return { fileName, contentType, buffer: Buffer.from(job.fileData) };
    }
    throw new BadRequestException('Report is not ready for download');
  }

  /** Rejects a new job if the farm already has too many in flight (RD-013 flood guard). */
  private async assertUnderConcurrentJobCap(farmId: string): Promise<void> {
    const inFlight = await this.prisma.reportJob.count({
      where: {
        farmId,
        status: { in: [ReportJobStatus.QUEUED, ReportJobStatus.GENERATING] },
      },
    });
    if (inFlight >= MAX_CONCURRENT_JOBS_PER_FARM) {
      throw new BadRequestException(
        `Too many reports in progress (max ${MAX_CONCURRENT_JOBS_PER_FARM} at a time). Wait for one to finish.`,
      );
    }
  }

  /**
   * Hard ceiling on stored output per farm, independent of the TTL sweep —
   * a rate-limited but sustained caller regenerating just under the throttle
   * would otherwise accumulate storage forever. Purges the oldest completed
   * jobs' blobs (row/history kept) once a farm exceeds the cap.
   */
  private async enforceStoredReportCap(farmId: string): Promise<void> {
    const stored = await this.prisma.reportJob.findMany({
      where: {
        farmId,
        status: ReportJobStatus.COMPLETED,
        storageKey: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, storageKey: true },
    });
    const excess = stored.length - MAX_STORED_REPORTS_PER_FARM;
    if (excess <= 0) return;

    for (const row of stored.slice(0, excess)) {
      try {
        if (row.storageKey) await this.storage.delete(row.storageKey);
        await this.prisma.reportJob.update({
          where: { id: row.id },
          data: { storageKey: null, fileData: null, byteSize: null },
        });
      } catch (error) {
        this.log.error('Failed purging over-cap stored report', error, {
          jobId: row.id,
          farmId,
        });
      }
    }
    this.log.info('Purged over-cap stored reports', { farmId, count: excess });
  }

  private contentTypeFor(format: ReportFormat): string {
    return format === ReportFormat.CSV ? 'text/csv' : 'application/pdf';
  }

  private async getJobOrThrow(farmId: string, id: string) {
    const job = await this.prisma.reportJob.findFirst({
      where: { id, farmId },
    });
    if (!job) {
      throw new NotFoundException('Report job not found');
    }
    return job;
  }

  private stamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }
}
