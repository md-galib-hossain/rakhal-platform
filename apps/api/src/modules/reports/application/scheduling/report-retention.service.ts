import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../../../media/application/ports/object-storage.port';
import {
  DAY_MS,
  RETENTION_BATCH,
  RETENTION_FAILED_AGE_DAYS,
  RETENTION_MAX_BATCHES,
  RETENTION_SOFT_DELETE_GRACE_DAYS,
  SCHEDULE_TOMBSTONE_DAYS,
} from './scheduling.constants';

export interface RetentionCleanupResult {
  considered: number;
  deleted: number;
  /** SCHEDULED rows whose artifact + snapshot were removed but the row kept as a tombstone. */
  tombstoned: number;
  /** Storage deletes that threw: the row is kept (artifactKey intact) and retried next run. */
  storageFailures: number;
  /** Row deletes that threw after the artifact was removed (also retried next run). */
  rowFailures: number;
}

/**
 * Hard-deletes reports that are past retention. The stored artifact is removed FIRST; only when that succeeds
 * (or there is no artifact) is the row deleted, and the snapshot cascades with it (it can hold finance data).
 * A failed storage delete keeps the row, so the next run retries: rerun-safe.
 *
 * SCHEDULED rows are tombstones: they are hard-deleted only once `periodEnd` is older than
 * SCHEDULE_TOMBSTONE_DAYS (the sweep's catch-up window plus margin). Before that, only the artifact and
 * snapshot payload are removed (artifactKey nulled) and the row stays, so a user-deleted, FAILED or expired
 * scheduled report is never regenerated. Such rows stay hidden from the API (deletedAt / expiresAt filters).
 *
 * Orphans: the storage port cannot list objects, so an artifact with no row can only arise from a failed
 * delete, and that case is covered by keeping the row until its delete succeeds. PROCESSING rows and rows
 * that are neither expired, nor soft-deleted past grace, nor old FAILED are never touched.
 */
@Injectable()
export class ReportRetentionService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportRetentionService.name);
  }

  async cleanup(
    now: Date,
    options: {
      batchSize?: number;
      maxBatches?: number;
      farmIds?: string[];
    } = {},
  ): Promise<RetentionCleanupResult> {
    const batchSize = options.batchSize ?? RETENTION_BATCH;
    const maxBatches = options.maxBatches ?? RETENTION_MAX_BATCHES;
    const result: RetentionCleanupResult = {
      considered: 0,
      deleted: 0,
      tombstoned: 0,
      storageFailures: 0,
      rowFailures: 0,
    };
    const graceCutoff = new Date(
      now.getTime() - RETENTION_SOFT_DELETE_GRACE_DAYS * DAY_MS,
    );
    const failedCutoff = new Date(
      now.getTime() - RETENTION_FAILED_AGE_DAYS * DAY_MS,
    );
    const tombstoneCutoff = new Date(
      now.getTime() - SCHEDULE_TOMBSTONE_DAYS * DAY_MS,
    );

    let cursor: string | undefined;
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const rows = await this.prisma.report.findMany({
        where: {
          status: { not: 'PROCESSING' },
          ...(options.farmIds ? { farmId: { in: options.farmIds } } : {}),
          ...(cursor ? { id: { gt: cursor } } : {}),
          OR: [
            { deletedAt: null, expiresAt: { lt: now } },
            { deletedAt: { lt: graceCutoff } },
            { status: 'FAILED', createdAt: { lt: failedCutoff } },
          ],
          // A SCHEDULED row inside the tombstone window is only picked while it still holds an artifact or
          // snapshot to strip; once stripped it is skipped until its periodEnd passes the tombstone age.
          AND: [
            {
              OR: [
                { origin: { not: 'SCHEDULED' } },
                { periodEnd: { lt: tombstoneCutoff } },
                { artifactKey: { not: null } },
                { snapshot: { isNot: null } },
              ],
            },
          ],
        },
        select: {
          id: true,
          artifactKey: true,
          origin: true,
          periodEnd: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;
      result.considered += rows.length;

      for (const row of rows) {
        if (row.artifactKey) {
          try {
            await this.storage.delete(row.artifactKey);
          } catch {
            result.storageFailures += 1;
            continue;
          }
        }
        if (row.origin === 'SCHEDULED' && row.periodEnd >= tombstoneCutoff) {
          // Tombstone: the artifact and snapshot payload go, the row stays so the sweep cannot recreate it.
          try {
            await this.prisma.reportSnapshot.deleteMany({
              where: { reportId: row.id },
            });
            const { count } = await this.prisma.report.updateMany({
              where: { id: row.id, status: { not: 'PROCESSING' } },
              data: {
                artifactKey: null,
                artifactBytes: null,
                artifactContentType: null,
              },
            });
            result.tombstoned += count;
          } catch {
            result.rowFailures += 1;
          }
          continue;
        }
        try {
          // Re-assert "not PROCESSING" so a row claimed in the meantime is never removed.
          const { count } = await this.prisma.report.deleteMany({
            where: { id: row.id, status: { not: 'PROCESSING' } },
          });
          result.deleted += count;
        } catch {
          result.rowFailures += 1;
        }
      }
      if (rows.length < batchSize) break;
    }

    if (result.storageFailures > 0 || result.rowFailures > 0) {
      this.log.warn('Report retention cleanup had failures', { ...result });
    } else {
      this.log.info('Report retention cleanup complete', { ...result });
    }
    return result;
  }
}
