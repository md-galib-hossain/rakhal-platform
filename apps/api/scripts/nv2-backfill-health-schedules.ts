import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import {
  HealthCaseStatus,
  HealthTaskStatus,
  PlanEnrollmentStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { HealthStepNotificationProducer } from '../src/modules/health/application/resolvers/health-step-notification.producer';

/**
 * One-off dev-DB backfill (RAKHAL-497 / NV2-B06): creates the notification schedules for health steps that already
 * exist, because the producer hooks only fire on a change. Run once at cutover (docs/EPIC_NOTIFICATIONS_V2.md §12),
 * and only against the LOCAL dev database.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/nv2-backfill-health-schedules.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/nv2-backfill-health-schedules.ts
 *
 * - `--dry-run` writes nothing: it prints how many open steps / groups it would sync per farm.
 * - Idempotent: `upsertForSource` is keyed by `(farm, HEALTH_STEP, round|case:<id>:<ymd>)`, so a re-run only
 *   refreshes the same rows. Past occurrences are never created (no back-fill of missed fires).
 * - Refuses to run unless `DATABASE_URL` points at localhost / 127.0.0.1 / ::1.
 */
const LIVE_STATUSES = [
  HealthTaskStatus.PENDING,
  HealthTaskStatus.RESCHEDULED,
  HealthTaskStatus.OVERDUE,
];
const OPEN_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];
const CHUNK = 200;

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!isLocalDatabase(process.env.DATABASE_URL)) {
    console.error(
      'Refusing to run: DATABASE_URL is not localhost / 127.0.0.1. This backfill is for the local dev DB only.',
    );
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const producer = app.get(HealthStepNotificationProducer);
    const farms = await prisma.healthTask.findMany({
      where: { deletedAt: null, status: { in: LIVE_STATUSES } },
      select: { farmId: true },
      distinct: ['farmId'],
    });
    let totalSteps = 0;
    let totalGroups = 0;
    let totalQueued = 0;

    for (const { farmId } of farms) {
      const steps = await prisma.healthTask.findMany({
        where: {
          farmId,
          deletedAt: null,
          status: { in: LIVE_STATUSES },
          cattle: { herdStatus: 'ACTIVE', deletedAt: null },
          OR: [
            {
              healthCase: {
                is: { status: { in: OPEN_CASE_STATUSES }, deletedAt: null },
              },
            },
            {
              planEnrollment: {
                is: { status: PlanEnrollmentStatus.ACTIVE, deletedAt: null },
              },
            },
          ],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const ids = steps.map((s) => s.id);
      totalSteps += ids.length;

      const keys = new Set<string>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        for (const k of await producer.keysOfTasks(
          null,
          farmId,
          ids.slice(i, i + CHUNK),
        )) {
          keys.add(k);
        }
      }
      totalGroups += keys.size;
      console.log(
        `${dryRun ? '[dry-run] ' : ''}farm ${farmId}: ${ids.length} open steps in ${keys.size} groups`,
      );
      if (dryRun) continue;

      for (let i = 0; i < ids.length; i += CHUNK) {
        const enqueue = await producer.syncTasks(
          null,
          farmId,
          ids.slice(i, i + CHUNK),
        );
        totalQueued += enqueue?.length ?? 0;
        await producer.enqueueAfterCommit(enqueue);
      }
    }
    console.log(
      `${dryRun ? '[dry-run] ' : ''}done: ${totalSteps} open steps, ${totalGroups} groups${dryRun ? '' : `, ${totalQueued} occurrences written (those due within 48 h are queued; reconcile picks up the rest)`}.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
