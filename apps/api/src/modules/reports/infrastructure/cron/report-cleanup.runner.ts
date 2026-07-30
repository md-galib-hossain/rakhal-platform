import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OBJECT_STORAGE } from 'src/modules/media/application/ports/object-storage.port';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';

/**
 * RD-013(b) TTL enforcement. `ReportJob.expiresAt` (set on completion, 7 days
 * out) only gates the *download* response today (410 past expiry) — nothing
 * actually removed the bytes, so both the old bytea column and, if left
 * unfixed, R2 objects would accumulate forever regardless of whether anyone
 * ever downloaded them. Runs hourly (matches `ReportScheduleRunner`'s cadence)
 * and deletes the R2 object for any expired job, then nulls the row's
 * storage-related fields. The job row itself is kept (id/reportId/status/
 * createdAt/scheduleId) — the catalogue's "last generated" lookup and
 * schedule history read only that metadata, never the blob.
 */
@Injectable()
export class ReportCleanupRunner {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {
    this.log = logger.setContext(ReportCleanupRunner.name);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'report-cleanup-runner' })
  async purgeExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.reportJob.findMany({
      where: {
        expiresAt: { lt: now },
        OR: [{ storageKey: { not: null } }, { fileData: { not: null } }],
      },
      select: { id: true, farmId: true, storageKey: true },
    });

    let purged = 0;
    for (const job of expired) {
      try {
        if (job.storageKey) {
          await this.storage.delete(job.storageKey);
        }
        await this.prisma.reportJob.update({
          where: { id: job.id },
          data: { storageKey: null, fileData: null, byteSize: null },
        });
        purged += 1;
      } catch (err) {
        this.log.error('Failed purging expired report', err, {
          jobId: job.id,
          farmId: job.farmId,
        });
      }
    }
    if (purged > 0) {
      this.log.info('Expired reports purged', { count: purged });
    }
    return purged;
  }
}
