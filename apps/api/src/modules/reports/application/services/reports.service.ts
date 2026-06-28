import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportFormat, ReportJobStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { renderCsv } from '../../domain/csv-renderer';
import { renderPdf } from '../../domain/pdf-renderer';
import { groupedCatalogue, isKnownReport } from '../../domain/report-catalogue';
import { GenerateReportDto } from '../../presentation/dto/generate-report.dto';
import {
  ReportGeneratorsService,
  ReportParams,
} from './report-generators.service';

/** Generated files live for this many days before download returns 410. */
const REPORT_TTL_DAYS = 7;

/**
 * Reports module orchestrator (PRD §22 / API §15). Owns the `ReportJob`
 * lifecycle: catalogue → generate (synchronous for the MVP) → status → download.
 * Output bytes are stored on the job (`fileData`) and streamed by the controller
 * — no object storage/CDN needed yet.
 */
@Injectable()
export class ReportsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly generators: ReportGeneratorsService,
    private readonly logger: LoggerService,
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

  /** `POST /reports/generate` — synchronous generation; returns the job summary. */
  async generate(farmId: string, userId: string, dto: GenerateReportDto) {
    if (!isKnownReport(dto.reportId)) {
      throw new BadRequestException(`Unknown report: ${dto.reportId}`);
    }
    const params: ReportParams = dto.parameters ?? {};

    const job = await this.prisma.reportJob.create({
      data: {
        farmId,
        reportId: dto.reportId,
        format: dto.format,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params: params as any,
        status: ReportJobStatus.GENERATING,
        createdBy: userId,
      },
      select: { id: true },
    });

    try {
      const data = await this.generators.generate(farmId, dto.reportId, params);
      const buffer =
        dto.format === ReportFormat.CSV
          ? renderCsv(data)
          : await renderPdf(data);
      const ext = dto.format === ReportFormat.CSV ? 'csv' : 'pdf';
      const fileName = `${dto.reportId}_${this.stamp()}.${ext}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REPORT_TTL_DAYS);

      await this.prisma.reportJob.update({
        where: { id: job.id },
        data: {
          status: ReportJobStatus.COMPLETED,
          title: data.title,
          fileName,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          fileData: Buffer.from(buffer) as any,
          byteSize: buffer.length,
          expiresAt,
        },
      });
      this.log.info('Report generated', {
        jobId: job.id,
        farmId,
        reportId: dto.reportId,
        format: dto.format,
        bytes: buffer.length,
      });
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

    return { job_id: job.id, status: 'completed', estimated_seconds: 0 };
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

  /** `GET /reports/jobs/:id/download` — returns the stored bytes (controller streams). */
  async download(farmId: string, id: string) {
    const job = await this.getJobOrThrow(farmId, id);
    if (job.status !== ReportJobStatus.COMPLETED || !job.fileData) {
      throw new BadRequestException('Report is not ready for download');
    }
    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Report download has expired; regenerate it');
    }
    return {
      fileName: job.fileName ?? `${job.reportId}.${job.format.toLowerCase()}`,
      contentType:
        job.format === ReportFormat.CSV ? 'text/csv' : 'application/pdf',
      buffer: Buffer.from(job.fileData),
    };
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
