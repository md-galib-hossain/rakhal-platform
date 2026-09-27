import { Injectable } from '@nestjs/common';
import { TaskCategory, TaskPriority, TaskSource } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { FitDayRow, offTargetCows, streakDates } from '../../domain/fit-streak';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { FeedPlanService } from './feed-plan.service';

/** How many consecutive days off target before the digest fires (RAKHAL-459b). */
export const OFF_TARGET_DAYS = 3;
/** `FeedPlanFitQueryDto.cattleIds` accepts at most 500 per call. */
const FIT_CHUNK = 500;
export const OFF_TARGET_TASK_EVENT = 'FEED_PLAN_OUT_OF_BAND';

const SEVERITY = { ok: 'OK', warn: 'WARN', bad: 'BAD' } as const;

/**
 * Daily "is each program still right for its animals?" sweep (MILESTONE 27, RAKHAL-459b; run by the 5 AM
 * `SchedulerService` cron). For every farm with an applied program it judges each animal's fit against her program
 * (the same `FeedPlanService.fit` the Feeding Grid and plan editor use), stores one `FeedPlanFitDay` row per
 * (plan, cow, day), and — when any animal was **measured** off target on three consecutive days — raises ONE Task
 * Hub task per plan per day. An `estimated` day never counts (see `domain/fit-streak.ts`), so a guess never nags.
 *
 * Idempotent: a re-run refreshes the day's rows and does not raise a second task (dedupe on
 * `sourceEventType`/`sourceEventId` = plan + day). One broken plan or farm never stops the others.
 */
@Injectable()
export class FeedPlanFitSweepService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly resolver: FeedPlanResolverService,
    private readonly plans: FeedPlanService,
    private readonly tasks: TaskService,
  ) {
    this.log = logger.setContext(FeedPlanFitSweepService.name);
  }

  /** Every farm that has an applied program. Returns how many digest tasks were raised. */
  async sweepAll(now = new Date()): Promise<number> {
    const farms = await this.prisma.feedPlanAssignment.findMany({
      where: { removedAt: null, plan: { isActive: true } },
      select: { farmId: true },
      distinct: ['farmId'],
    });
    let raised = 0;
    for (const { farmId } of farms) {
      try {
        raised += await this.sweepFarm(farmId, now);
      } catch (err) {
        this.log.error('Feed plan fit sweep failed for a farm', {
          farmId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return raised;
  }

  async sweepFarm(farmId: string, now = new Date()): Promise<number> {
    const ymd = now.toISOString().slice(0, 10);
    const day = new Date(`${ymd}T00:00:00.000Z`);

    const herd = await this.prisma.cattle.findMany({
      where: activeHerd(farmId),
      select: { id: true, tagNumber: true },
    });
    const tagById = new Map(herd.map((c) => [c.id, c.tagNumber]));
    const programs = await this.resolver.resolveForCattle(
      farmId,
      herd.map((c) => c.id),
    );

    const byPlan = new Map<string, { name: string; cattleIds: string[] }>();
    for (const [cattleId, p] of programs) {
      const e = byPlan.get(p.planId) ?? { name: p.planName, cattleIds: [] };
      e.cattleIds.push(cattleId);
      byPlan.set(p.planId, e);
    }

    let raised = 0;
    for (const [planId, { name, cattleIds }] of byPlan) {
      try {
        await this.recordDay(farmId, planId, cattleIds, ymd, day);
        raised += await this.digest(
          farmId,
          planId,
          name,
          ymd,
          cattleIds,
          tagById,
          now,
        );
      } catch (err) {
        this.log.error('Feed plan fit sweep failed for a plan', {
          farmId,
          planId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return raised;
  }

  /** Judge every member against the plan and store the day (replacing a same-day re-run). */
  private async recordDay(
    farmId: string,
    planId: string,
    cattleIds: string[],
    ymd: string,
    day: Date,
  ) {
    const data: {
      farmId: string;
      planId: string;
      cattleId: string;
      date: Date;
      severity: 'OK' | 'WARN' | 'BAD';
      estimated: boolean;
    }[] = [];
    for (let i = 0; i < cattleIds.length; i += FIT_CHUNK) {
      const res = await this.plans.fit(farmId, planId, {
        cattleIds: cattleIds.slice(i, i + FIT_CHUNK),
        date: ymd,
      });
      for (const c of res.cows) {
        data.push({
          farmId,
          planId,
          cattleId: c.cattle_id,
          date: day,
          severity: SEVERITY[c.fit.severity],
          estimated: c.fit.estimated,
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.feedPlanFitDay.deleteMany({
        where: { planId, date: day },
      }),
      this.prisma.feedPlanFitDay.createMany({ data }),
    ]);
  }

  /** One task per plan per day when any member was measured off target on every one of the last three days. */
  private async digest(
    farmId: string,
    planId: string,
    planName: string,
    ymd: string,
    cattleIds: string[],
    tagById: Map<string, string>,
    now: Date,
  ): Promise<number> {
    const dates = streakDates(ymd, OFF_TARGET_DAYS);
    const stored = await this.prisma.feedPlanFitDay.findMany({
      where: {
        planId,
        cattleId: { in: cattleIds },
        date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
        severity: { in: ['WARN', 'BAD'] },
        estimated: false,
      },
      select: {
        cattleId: true,
        date: true,
        severity: true,
        estimated: true,
      },
    });
    const rows: FitDayRow[] = stored.map((r) => ({
      cattleId: r.cattleId,
      date: r.date.toISOString().slice(0, 10),
      severity: r.severity,
      estimated: r.estimated,
    }));
    const off = offTargetCows(rows, dates);
    if (off.length === 0) return 0;

    const eventId = `${planId}:${ymd}`;
    const existing = await this.prisma.task.findFirst({
      where: {
        farmId,
        sourceEventType: OFF_TARGET_TASK_EVENT,
        sourceEventId: eventId,
      },
      select: { id: true },
    });
    if (existing) return 0;

    const tags = off
      .slice(0, 5)
      .map((id) => tagById.get(id) ?? id)
      .join(', ');
    const more = off.length > 5 ? ` and ${off.length - 5} more` : '';
    await this.tasks.createInternal({
      farmId,
      createdBy: 'SYSTEM',
      name: `Feed plan "${planName}": ${off.length} animal${off.length === 1 ? '' : 's'} off target ${OFF_TARGET_DAYS} days running`,
      details: `Their daily dry matter, protein or energy from this plan has been outside the allowed range for ${OFF_TARGET_DAYS} days in a row (measured, not estimated): ${tags}${more}. Open Feed plans to adjust the plan or give them their own. [plan:${planId}]`,
      category: TaskCategory.FEEDING,
      priority: TaskPriority.MEDIUM,
      dueAt: now,
      source: TaskSource.SYSTEM_AUTO,
      sourceEventType: OFF_TARGET_TASK_EVENT,
      sourceEventId: eventId,
    });
    return 1;
  }
}
