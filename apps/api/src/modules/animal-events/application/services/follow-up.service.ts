import { Injectable } from '@nestjs/common';
import { TaskCategory, TaskPriority, TaskSource } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { TaskNotificationProducer } from 'src/modules/task/application/resolvers/task-notification.producer';
import { TaskService } from 'src/modules/task/application/services/task.service';
import {
  FOLLOW_UP_RULES,
  FollowUpOverride,
  FollowUpPlanItem,
  planFollowUps,
  RuleDefaults,
  RuleEvent,
  ruleByKey,
  rulesCompletedBy,
} from '../../domain/follow-up-rules';
import type { AnimalEventTypeKey } from '../../domain/catalogue';

const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const;

/** The Task columns the notification producer needs (plus `farmId`, to scope the refresh). */
const NOTIFY_SELECT = {
  id: true,
  farmId: true,
  status: true,
  priority: true,
  safetyCritical: true,
  ruleKey: true,
  dueAt: true,
  assignedToId: true,
} as const;

/** One line of the "What happens next" list (dry run and real run). */
export interface FollowUpPreviewItem {
  ruleKey: string;
  title: string;
  dueDate: string;
  defaultOn: boolean;
  /** Whether the engine will create/show it for this save. */
  enabled: boolean;
  kind: 'TASK' | 'SUGGESTION';
}

/**
 * RAKHAL-484: follow-up rules engine. Turns an event into Task Hub rows (deduped
 * by `followUpKey`), closes the ones the event satisfies (even when early), and
 * cancels them when the source event is voided. Never creates a task that is
 * already past due (history and back-dated entries).
 */
@Injectable()
export class FollowUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FarmSettingsService,
    private readonly tasks: TaskService,
    private readonly notifier: TaskNotificationProducer,
  ) {}

  async defaults(farmId: string): Promise<RuleDefaults> {
    const s = await this.settings.getEffective(farmId);
    return {
      pregnancyCheckDays: s.reproPregnancyCheckDays,
      vwpDays: s.reproVwpDays,
      dryPeriodDays: s.reproDryPeriodTargetDays,
      closeUpDays: s.reproCloseUpWindowDays,
    };
  }

  async overrides(
    farmId: string,
  ): Promise<Record<string, FollowUpOverride | undefined>> {
    const rows = await this.prisma.followUpRuleSetting.findMany({
      where: { farmId },
    });
    return Object.fromEntries(
      rows.map((r) => [
        r.ruleKey,
        { enabled: r.enabled, offsetDays: r.offsetDays },
      ]),
    );
  }

  /** The plan for an event after the farm's settings and the client's toggles. */
  async plan(
    farmId: string,
    event: RuleEvent,
    toggles: { ruleKey: string; enabled: boolean }[] = [],
    now = new Date(),
  ): Promise<{ item: FollowUpPlanItem; enabled: boolean }[]> {
    const [defaults, overrides] = await Promise.all([
      this.defaults(farmId),
      this.overrides(farmId),
    ]);
    return planFollowUps(event, defaults, overrides, now).map((item) => ({
      item,
      enabled:
        toggles.find((t) => t.ruleKey === item.ruleKey)?.enabled ??
        (item.defaultOn && !item.pastDue),
    }));
  }

  async preview(
    farmId: string,
    event: RuleEvent,
    toggles: { ruleKey: string; enabled: boolean }[] = [],
  ): Promise<FollowUpPreviewItem[]> {
    return (await this.plan(farmId, event, toggles)).map(
      ({ item, enabled }) => ({
        ruleKey: item.ruleKey,
        title: item.title,
        dueDate: item.dueDate.toISOString(),
        defaultOn: item.defaultOn && !item.pastDue,
        enabled: enabled && !item.pastDue,
        kind: item.kind,
      }),
    );
  }

  /**
   * After an event is saved: close the follow-ups it satisfies, then create the
   * new ones. Runs inside the save transaction (the Prisma proxy joins it).
   */
  async onEventSaved(args: {
    farmId: string;
    userId: string;
    cattleId: string;
    eventId: string;
    event: RuleEvent;
    toggles?: { ruleKey: string; enabled: boolean }[];
    /** NV2-B05: bulk callers collect the new task ids here and announce them once after the commit. */
    taskSink?: string[];
  }): Promise<{ created: string[]; completed: number }> {
    const { farmId, cattleId, eventId, event } = args;
    const completed = await this.completeFor(cattleId, event.type, eventId);

    const tag = (
      await this.prisma.cattle.findUnique({
        where: { id: cattleId },
        select: { tagNumber: true },
      })
    )?.tagNumber;
    const created: string[] = [];
    const newTaskIds: string[] = [];
    for (const { item, enabled } of await this.plan(
      farmId,
      event,
      args.toggles,
    )) {
      if (item.kind !== 'TASK' || item.pastDue || !enabled) continue;
      const followUpKey = `${item.ruleKey}:${eventId}`;
      try {
        const task = await this.tasks.createInternal({
          // NV2-B05: announced once for the whole event (or once per bulk), not per task.
          skipNotify: true,
          farmId,
          createdBy: args.userId,
          name: `${item.title}${tag ? ` — ${tag}` : ''}`,
          category:
            event.type === 'VACCINATION'
              ? TaskCategory.HEALTHCARE
              : TaskCategory.BREEDING,
          priority: TaskPriority.MEDIUM,
          dueAt: item.dueDate,
          source: TaskSource.SYSTEM_AUTO,
          relatedCattleId: cattleId,
          sourceEventType: 'ANIMAL_EVENT',
          sourceEventId: eventId,
          followUpKey,
          ruleKey: item.ruleKey,
        });
        created.push(item.ruleKey);
        newTaskIds.push(task.id);
      } catch (error) {
        // A parallel save already made this follow-up: the partial unique index held.
        const existing = await this.prisma.task.findFirst({
          where: { farmId, followUpKey, status: { in: [...OPEN] } },
          select: { id: true },
        });
        if (!existing) throw error;
      }
    }
    if (args.taskSink) args.taskSink.push(...newTaskIds);
    else await this.notifier.syncByIds(farmId, newTaskIds);
    return { created, completed };
  }

  /** An event of `type` satisfies the open follow-ups of these rules for the animal. */
  async completeFor(
    cattleId: string,
    type: AnimalEventTypeKey,
    exceptEventId: string,
  ): Promise<number> {
    const keys = rulesCompletedBy(type);
    if (!keys.length) return 0;
    const rows = await this.prisma.task.findMany({
      where: {
        relatedCattleId: cattleId,
        ruleKey: { in: keys },
        status: { in: [...OPEN] },
        NOT: { sourceEventId: exceptEventId },
      },
      select: NOTIFY_SELECT,
    });
    if (!rows.length) return 0;
    const res = await this.prisma.task.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: { in: [...OPEN] } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.notifier.sync(
      rows[0].farmId,
      rows.map((r) => ({ ...r, status: 'COMPLETED' })),
    );
    return res.count;
  }

  /** Voiding (or re-dating) the source event cancels its open follow-ups. */
  async cancelForEvent(eventId: string): Promise<number> {
    const where = {
      sourceEventType: 'ANIMAL_EVENT',
      sourceEventId: eventId,
      status: { in: [...OPEN] },
    };
    const rows = await this.prisma.task.findMany({
      where,
      select: NOTIFY_SELECT,
    });
    if (!rows.length) return 0;
    const res = await this.prisma.task.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: { in: [...OPEN] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.notifier.sync(
      rows[0].farmId,
      rows.map((r) => ({ ...r, status: 'CANCELLED' })),
    );
    return res.count;
  }

  // ---- farm settings (GET / PUT /settings/follow-up-rules) -----------------

  async listRules(farmId: string) {
    const [defaults, overrides] = await Promise.all([
      this.defaults(farmId),
      this.overrides(farmId),
    ]);
    return FOLLOW_UP_RULES.map((r) => {
      const o = overrides[r.key];
      return {
        ruleKey: r.key,
        title: r.title,
        kind: r.kind,
        trigger: r.trigger,
        enabled: o?.enabled ?? r.defaultOn,
        defaultOn: r.defaultOn,
        offsetDays: o?.offsetDays ?? r.defaultOffsetDays(defaults),
        defaultOffsetDays: r.defaultOffsetDays(defaults),
        completesOn: r.completesOn,
      };
    });
  }

  async updateRules(
    farmId: string,
    items: { ruleKey: string; enabled?: boolean; offsetDays?: number | null }[],
  ) {
    for (const i of items) {
      if (!ruleByKey(i.ruleKey)) continue;
      await this.prisma.followUpRuleSetting.upsert({
        where: { farmId_ruleKey: { farmId, ruleKey: i.ruleKey } },
        create: {
          farmId,
          ruleKey: i.ruleKey,
          enabled: i.enabled ?? true,
          offsetDays: i.offsetDays ?? null,
        },
        update: {
          ...(i.enabled !== undefined ? { enabled: i.enabled } : {}),
          ...(i.offsetDays !== undefined ? { offsetDays: i.offsetDays } : {}),
        },
      });
    }
    return this.listRules(farmId);
  }
}
