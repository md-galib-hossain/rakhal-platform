import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { AudienceMember, resolveAudience } from '../../domain/audience';
import { evaluateLate } from '../../domain/late-rule';
import { eventKeyForBand } from '../../domain/schedule-math';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';
import { NotificationScheduler } from '../services/notification-scheduler.service';
import { NotificationService } from '../services/notification.service';
import { NOTIFICATION_CLOCK } from './notification-clock';
import type { NotificationClock } from './notification-clock';
import {
  NOTIFICATION_FIRE_JOB,
  NOTIFICATION_OCCURRENCE_QUEUE,
} from './schedule-queue.port';

type SkipReason = 'LATE' | 'NO_RECIPIENTS';
type CancelReason = 'PAUSED' | 'EDITED' | 'SOURCE_GONE' | 'ANIMALS_GONE';

export type FireOutcome =
  | { outcome: 'ignored' }
  | { outcome: 'fired'; recipientCount: number }
  | { outcome: 'skipped'; reason: SkipReason }
  | { outcome: 'cancelled'; reason: CancelReason };

/**
 * Fires one occurrence (RAKHAL-493, docs/EPIC_NOTIFICATIONS_V2.md §3.3). Re-reads everything at fire time: schedule
 * status, late rule, source state, current animals, current recipients. Idempotent: delivery dedupes on
 * `occurrence:<id>` and the FIRED mark is an `updateMany where status = SCHEDULED`.
 */
@Injectable()
export class OccurrenceProcessor {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmClock: FarmClockService,
    private readonly registry: SourceResolverRegistry,
    private readonly notifications: NotificationService,
    private readonly scheduler: NotificationScheduler,
    private readonly metrics: MetricsService,
    @Inject(NOTIFICATION_CLOCK) private readonly clock: NotificationClock,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OccurrenceProcessor.name);
  }

  async process(occurrenceId: string): Promise<FireOutcome> {
    const now = this.clock.now();
    const occ = await this.prisma.notificationOccurrence.findUnique({
      where: { id: occurrenceId },
      include: { schedule: true },
    });
    if (!occ || occ.status !== 'SCHEDULED') return { outcome: 'ignored' };
    const s = occ.schedule;

    // 1. The schedule must still be live.
    if (s.status !== 'ACTIVE') {
      return this.finishCancelled(
        occ.id,
        s.id,
        s.status === 'PAUSED' ? 'PAUSED' : 'EDITED',
      );
    }

    // 2. Late rule: a restart or short Redis outage still fires within 2 h, beyond that it is skipped.
    if (evaluateLate(occ.fireAt, now) === 'LATE') {
      return this.finishSkipped(occ.id, s.id, 'LATE');
    }

    const timezone = await this.farmClock.timezone(s.farmId);

    // 3. Re-check the source (system) or the anchor entity and animals (manual).
    let sourceUserIds: string[] = [];
    let sourceRoles: string[] = [];
    let params: Record<string, string | number> = {
      title: s.title ?? '',
      body: s.body ?? '',
    };
    let title = s.title ?? '';
    let message = s.body ?? '';
    let link: string | undefined;
    let data: Record<string, unknown> = {
      scheduleId: s.id,
      occurrenceId: occ.id,
    };

    if (s.origin === 'SYSTEM') {
      const resolver = s.sourceType
        ? this.registry.get(s.sourceType)
        : undefined;
      if (!resolver || !s.sourceKey) {
        // Not a verdict on the source: let BullMQ retry; reconcile re-enqueues if it stays unresolved.
        throw new Error(
          `No source resolver registered for ${String(s.sourceType)}`,
        );
      }
      const res = await resolver.resolve({
        farmId: s.farmId,
        sourceKey: s.sourceKey,
        timezone,
        now,
        leadMinutes: occ.leadMinutes,
        anchorAt: occ.anchorAt,
      });
      if (res.state === 'GONE') {
        return this.finishCancelled(occ.id, s.id, 'SOURCE_GONE');
      }
      if (res.state === 'ANIMALS_GONE') {
        return this.finishCancelled(occ.id, s.id, 'ANIMALS_GONE');
      }
      sourceUserIds = res.userIds;
      sourceRoles = res.roles ?? [];
      params = res.params;
      title = res.title;
      message = res.message;
      link = res.link;
      data = { ...data, ...(res.data ?? {}) };
    } else {
      if (s.anchorType && s.anchorId) {
        const checker = this.registry.getAnchorChecker(s.anchorType);
        if (checker && !(await checker.exists(s.farmId, s.anchorId))) {
          return this.finishCancelled(occ.id, s.id, 'SOURCE_GONE');
        }
      }
      if (s.animalIds.length > 0) {
        const alive = await this.prisma.cattle.count({
          where: {
            id: { in: s.animalIds },
            farmId: s.farmId,
            herdStatus: 'ACTIVE',
            deletedAt: null,
          },
        });
        if (alive === 0) {
          return this.finishCancelled(occ.id, s.id, 'ANIMALS_GONE');
        }
        if (s.animalIds.length === 1) link = `/animals?view=${s.animalIds[0]}`;
        data = { ...data, animalIds: s.animalIds };
      }
    }

    // 4. Resolve recipients now, never from the write-time list.
    const members = await this.loadMembers(s.farmId);
    const recipients = resolveAudience(
      {
        mode: s.audienceMode,
        userIds: s.audienceUserIds,
        roles: s.origin === 'SYSTEM' ? sourceRoles : s.audienceRoles,
        sourceUserIds,
      },
      members,
    );
    if (recipients.length === 0) {
      return this.finishSkipped(occ.id, s.id, 'NO_RECIPIENTS');
    }

    // 5. Deliver through the existing engine. A throw leaves the occurrence SCHEDULED for the retry.
    await this.notifications.notifyUsers({
      farmId: s.farmId,
      userIds: recipients,
      eventKey: eventKeyForBand(s.origin, occ.leadMinutes),
      title,
      message,
      params,
      link,
      data,
      dedupeKey: `occurrence:${occ.id}`,
    });

    // 6. Mark FIRED (a duplicate worker loses this race harmlessly), then 7. advance the series.
    const fired = await this.prisma.notificationOccurrence.updateMany({
      where: { id: occ.id, status: 'SCHEDULED' },
      data: {
        status: 'FIRED',
        firedAt: now,
        recipientCount: recipients.length,
      },
    });
    if (fired.count > 0) {
      this.metrics.recordNotificationOccurrence('fired');
      this.metrics.observeNotificationFireLag(
        (now.getTime() - occ.fireAt.getTime()) / 1000,
      );
    }
    this.log.info('Occurrence fired', {
      occurrenceId: occ.id,
      scheduleId: s.id,
      farmId: s.farmId,
      recipients: recipients.length,
    });
    await this.scheduler.advance(s.id);
    return { outcome: 'fired', recipientCount: recipients.length };
  }

  private async finishSkipped(
    occurrenceId: string,
    scheduleId: string,
    reason: SkipReason,
  ): Promise<FireOutcome> {
    await this.mark(occurrenceId, 'SKIPPED', reason);
    await this.scheduler.advance(scheduleId);
    return { outcome: 'skipped', reason };
  }

  private async finishCancelled(
    occurrenceId: string,
    scheduleId: string,
    reason: CancelReason,
  ): Promise<FireOutcome> {
    await this.mark(occurrenceId, 'CANCELLED', reason);
    await this.scheduler.advance(scheduleId);
    return { outcome: 'cancelled', reason };
  }

  private async mark(
    occurrenceId: string,
    status: 'SKIPPED' | 'CANCELLED',
    reason: string,
  ): Promise<void> {
    const { count } = await this.prisma.notificationOccurrence.updateMany({
      where: { id: occurrenceId, status: 'SCHEDULED' },
      data: { status, reason },
    });
    if (count > 0) {
      this.metrics.recordNotificationOccurrence(
        status === 'SKIPPED' ? 'skipped' : 'cancelled',
        reason,
      );
    }
  }

  private async loadMembers(farmId: string): Promise<AudienceMember[]> {
    const rows = await this.prisma.farmMember.findMany({
      where: { farmId },
      select: {
        userId: true,
        role: { select: { name: true } },
        user: { select: { deletedAt: true } },
      },
    });
    const byUser = new Map<string, { roles: string[]; active: boolean }>();
    for (const r of rows) {
      const m = byUser.get(r.userId) ?? {
        roles: [],
        active: r.user.deletedAt === null,
      };
      m.roles.push(r.role.name);
      byUser.set(r.userId, m);
    }
    return [...byUser.entries()].map(([userId, m]) => ({ userId, ...m }));
  }
}

/** BullMQ worker: one queue, one job type, all logic in `OccurrenceProcessor` (unit-testable without Redis). */
@Processor(NOTIFICATION_OCCURRENCE_QUEUE, {
  concurrency: 8,
  limiter: { max: 50, duration: 1000 },
})
export class OccurrenceWorker extends WorkerHost {
  constructor(private readonly processor: OccurrenceProcessor) {
    super();
  }

  async process(job: Job<{ occurrenceId: string }>): Promise<void> {
    if (job.name !== NOTIFICATION_FIRE_JOB) return;
    await this.processor.process(job.data.occurrenceId);
  }
}
