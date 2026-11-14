import { ConflictException, Injectable } from '@nestjs/common';
import { PlanEnrollmentStatus } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { HealthService } from './health.service';
import { PROTOCOL_OUT_OF_STOCK } from './protocol-stock.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_BLOCKED_EVENT_KEY = 'health_cycle_blocked';

/**
 * Protocols v2 — auto-repeat. A preventive protocol with `cycleLengthDays` re-enrolls the same
 * animal when the cycle ends: once the current enrollment is COMPLETED and `startDate +
 * cycleLengthDays` has arrived. A stopped protocol soft-deletes its enrollment so it never
 * repeats; a short stock gate skips the cow, notifies owners/managers and retries next day.
 * `nextCycleCreatedAt` on the finished enrollment makes the sweep idempotent.
 */
@Injectable()
export class HealthCycleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthService,
    private readonly farmClock: FarmClockService,
    private readonly notifications: NotificationService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(HealthCycleService.name);
  }

  /** Daily entry point (scheduler). Returns the number of cycles spawned. */
  async sweepAll(): Promise<number> {
    const farms = await this.prisma.planEnrollment.findMany({
      where: {
        status: PlanEnrollmentStatus.COMPLETED,
        deletedAt: null,
        nextCycleCreatedAt: null,
        healthPlan: { deletedAt: null, cycleLengthDays: { gt: 0 } },
      },
      distinct: ['farmId'],
      select: { farmId: true },
    });
    let spawned = 0;
    for (const { farmId } of farms) {
      try {
        spawned += await this.sweepFarm(farmId);
      } catch (err) {
        this.log.error('Health cycle sweep failed for farm', { farmId, err });
      }
    }
    return spawned;
  }

  async sweepFarm(farmId: string): Promise<number> {
    const today = await this.farmClock.todayStart(farmId);
    const finished = await this.prisma.planEnrollment.findMany({
      where: {
        farmId,
        status: PlanEnrollmentStatus.COMPLETED,
        deletedAt: null,
        nextCycleCreatedAt: null,
        healthPlan: { deletedAt: null, cycleLengthDays: { gt: 0 } },
        cattle: { herdStatus: 'ACTIVE', deletedAt: null },
      },
      include: {
        healthPlan: { include: { steps: { orderBy: { dayNumber: 'asc' } } } },
        cattle: { select: { id: true, tagNumber: true, shedId: true } },
        planApplication: { select: { appliedBy: true } },
      },
      orderBy: { id: 'asc' },
    });

    let spawned = 0;
    for (const e of finished) {
      const length = e.healthPlan.cycleLengthDays!;
      const nextStart = new Date(e.startDate.getTime() + length * DAY_MS);
      if (nextStart > today) continue;
      if (e.healthPlan.steps.length === 0) continue;

      try {
        const result = await this.health.applyCycleRepeat(
          farmId,
          e.planApplication.appliedBy,
          e.healthPlan,
          e.cattle,
          nextStart < today ? today : nextStart,
          { cycleNumber: e.cycleNumber + 1, repeatedFromId: e.id },
        );
        // applied = new cycle created; skipped = animal already enrolled again (someone re-applied by hand).
        await this.prisma.planEnrollment.update({
          where: { id: e.id },
          data: { nextCycleCreatedAt: new Date() },
        });
        if (result.appliedCount > 0) spawned += 1;
      } catch (err) {
        if (
          err instanceof ConflictException &&
          (err.getResponse() as { details?: { reason?: string } })?.details
            ?.reason === PROTOCOL_OUT_OF_STOCK
        ) {
          await this.notifyBlocked(farmId, e, today);
          continue;
        }
        this.log.error('Cycle repeat failed', { enrollmentId: e.id, err });
      }
    }
    return spawned;
  }

  private async notifyBlocked(
    farmId: string,
    e: {
      id: string;
      cycleNumber: number;
      healthPlan: { name: string };
      cattle: { tagNumber: string };
    },
    today: Date,
  ) {
    const ymd = today.toISOString().slice(0, 10);
    await this.notifications.notifyOwnersAndManagers({
      farmId,
      eventKey: CYCLE_BLOCKED_EVENT_KEY,
      title: 'Protocol Repeat Blocked',
      message: `${e.healthPlan.name} was due to repeat for ${e.cattle.tagNumber} but a medicine is out of stock. It retries daily once restocked.`,
      params: { label: e.healthPlan.name, tag: e.cattle.tagNumber },
      link: '/healthcare?healthTab=protocols',
      dedupeKey: `${CYCLE_BLOCKED_EVENT_KEY}:${e.id}:${ymd}`,
    });
  }
}
