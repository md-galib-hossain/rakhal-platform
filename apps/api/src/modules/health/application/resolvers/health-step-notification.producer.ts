import { Injectable } from '@nestjs/common';
import { HealthTaskStatus, Prisma } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
import { allDayAnchorFromYmd } from 'src/modules/notification/domain/schedule-math';
import {
  HealthStepSourceResolver,
  parseStepSourceKey,
  stepSourceKey,
} from './health-step-source.resolver';

type Tx = Prisma.TransactionClient | null;

/** Lead defaults (docs/EPIC_NOTIFICATIONS_V2.md §1 item 8): preventive rounds 7d, 1d, day-of; curative steps day-of only. */
const PREVENTIVE_LEADS = [10080, 1440, 0];
const CURATIVE_LEADS = [0];
/** A step with a time of day: the day before and one hour before. */
const TIMED_LEADS = [1440, 60];

const LIVE_TASK_STATUSES = [
  HealthTaskStatus.PENDING,
  HealthTaskStatus.RESCHEDULED,
  HealthTaskStatus.OVERDUE,
];

/**
 * Keeps the `NotificationSchedule` of every health-step group in line with the steps (RAKHAL-497). `HealthService`
 * calls it where steps are created, rescheduled, completed, skipped or a case closes. Every method recomputes the
 * group from the table, so a caller only has to name the groups a change could have touched (the old group key plus
 * the new one on a reschedule).
 *
 * Pass the producer's open transaction as `tx` so the reads see its uncommitted steps and the schedule rows commit with
 * them; call `enqueueAfterCommit` with the returned ids once it commits (never Redis inside a transaction).
 */
@Injectable()
export class HealthStepNotificationProducer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: NotificationScheduler,
    private readonly resolver: HealthStepSourceResolver,
    private readonly farmClock: FarmClockService,
  ) {}

  /** Re-syncs the groups of these steps (their current due day) plus any `extraKeys` captured before a change. */
  syncTasks(
    tx: Tx,
    farmId: string,
    taskIds: string[],
    extraKeys: string[] = [],
  ): Promise<string[] | null> {
    return this.run(tx, async () => {
      const keys = [
        ...extraKeys,
        ...(await this.keysForTasks(farmId, taskIds)),
      ];
      return this.syncKeys(farmId, keys);
    });
  }

  /** Re-syncs every open group of these cases (curative), plus any `extraKeys` captured before a change. */
  syncCases(
    tx: Tx,
    farmId: string,
    caseIds: string[],
    extraKeys: string[] = [],
  ): Promise<string[] | null> {
    return this.run(tx, async () => {
      const keys = [...extraKeys];
      for (const id of caseIds) {
        keys.push(...(await this.keysForCase(farmId, id)));
      }
      return this.syncKeys(farmId, keys);
    });
  }

  /** Re-syncs every open group of one protocol round (preventive). */
  syncRound(
    tx: Tx,
    farmId: string,
    planApplicationId: string,
  ): Promise<string[] | null> {
    return this.run(tx, async () => {
      const tz = await this.farmClock.timezone(farmId);
      const rows = await this.prisma.healthTask.findMany({
        where: {
          farmId,
          deletedAt: null,
          status: { in: LIVE_TASK_STATUSES },
          planEnrollment: { is: { planApplicationId } },
        },
        select: { dueDateTime: true },
      });
      return this.syncKeys(
        farmId,
        rows.map((r) =>
          stepSourceKey({
            kind: 'round',
            id: planApplicationId,
            ymd: localDateIso(tz, r.dueDateTime),
          }),
        ),
      );
    });
  }

  /** Group keys of these steps as they are NOW. Call before a change to capture the old group. `[]` when disabled. */
  keysOfTasks(tx: Tx, farmId: string, taskIds: string[]): Promise<string[]> {
    return this.run(tx, () => this.keysForTasks(farmId, taskIds));
  }

  /** Group keys of a case's open steps NOW. `[]` when disabled. */
  keysOfCase(tx: Tx, farmId: string, caseId: string): Promise<string[]> {
    return this.run(tx, () => this.keysForCase(farmId, caseId));
  }

  async enqueueAfterCommit(ids: string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) return;
    await this.scheduler.enqueueAfterCommit(ids);
  }

  // -------------------------------------------------------------------------------------------------------------

  private run<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
    return tx ? txStore.run({ tx }, fn) : fn();
  }

  private async keysForTasks(
    farmId: string,
    taskIds: string[],
  ): Promise<string[]> {
    if (taskIds.length === 0) return [];
    const tz = await this.farmClock.timezone(farmId);
    const rows = await this.prisma.healthTask.findMany({
      where: { farmId, id: { in: taskIds } },
      select: {
        dueDateTime: true,
        healthCaseId: true,
        planEnrollment: { select: { planApplicationId: true } },
      },
    });
    const keys: string[] = [];
    for (const r of rows) {
      const ymd = localDateIso(tz, r.dueDateTime);
      if (r.planEnrollment) {
        keys.push(
          stepSourceKey({
            kind: 'round',
            id: r.planEnrollment.planApplicationId,
            ymd,
          }),
        );
      } else if (r.healthCaseId) {
        keys.push(stepSourceKey({ kind: 'case', id: r.healthCaseId, ymd }));
      }
    }
    return keys;
  }

  private async keysForCase(farmId: string, caseId: string): Promise<string[]> {
    const tz = await this.farmClock.timezone(farmId);
    const rows = await this.prisma.healthTask.findMany({
      where: {
        farmId,
        healthCaseId: caseId,
        deletedAt: null,
        status: { in: LIVE_TASK_STATUSES },
      },
      select: { dueDateTime: true },
    });
    return rows.map((r) =>
      stepSourceKey({
        kind: 'case',
        id: caseId,
        ymd: localDateIso(tz, r.dueDateTime),
      }),
    );
  }

  /** One schedule per group key: still has a live step -> upsert (moves with the anchor), nothing left -> cancel. */
  private async syncKeys(
    farmId: string,
    keys: string[],
  ): Promise<string[] | null> {
    const tz = await this.farmClock.timezone(farmId);
    const toEnqueue: string[] = [];
    for (const key of new Set(keys)) {
      const ref = parseStepSourceKey(key);
      if (!ref) continue;
      const group = await this.resolver.loadGroup(farmId, ref, tz);
      if (group.live.length === 0) {
        await this.scheduler.cancelForSource(farmId, 'HEALTH_STEP', key);
        continue;
      }
      const timed = group.live.find((s) => s.timeOfDay);
      const result = await this.scheduler.upsertForSource({
        farmId,
        sourceType: 'HEALTH_STEP',
        sourceKey: key,
        anchorAt: timed ? timed.dueDateTime : allDayAnchorFromYmd(ref.ymd),
        allDay: !timed,
        leadMinutes: timed
          ? TIMED_LEADS
          : ref.kind === 'round'
            ? PREVENTIVE_LEADS
            : CURATIVE_LEADS,
        eventKey: 'scheduled_upcoming',
        category: 'health_safety',
        priority: 'medium',
        audienceHint: { roles: ['Owner', 'Manager'] },
      });
      if (result) toEnqueue.push(...result.toEnqueue);
    }
    return toEnqueue;
  }
}
