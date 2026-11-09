import { Injectable, OnModuleInit } from '@nestjs/common';
import { dayKey, localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ruleByKey } from 'src/modules/animal-events/domain/follow-up-rules';
import { DEFAULT_SOURCE_ROLES } from 'src/modules/notification/domain/audience';
import type {
  ResolveContext,
  SourceResolution,
  SourceResolver,
} from 'src/modules/notification/application/resolvers/source-resolver.port';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';

const DAY_MS = 86_400_000;
const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const;

/** `id:<taskId>` for a plain task; `rule:<ruleKey>:<farm-local due ymd>` for a follow-up rule group (NV2-B04). */
export type TaskSourceKey =
  | { kind: 'id'; taskId: string }
  | { kind: 'rule'; ruleKey: string; ymd: string };

export const plainTaskKey = (taskId: string): string => `id:${taskId}`;
export const ruleTaskKey = (ruleKey: string, ymd: string): string =>
  `rule:${ruleKey}:${ymd}`;

export function parseTaskSourceKey(key: string): TaskSourceKey | null {
  if (key.startsWith('id:') && key.length > 3) {
    return { kind: 'id', taskId: key.slice(3) };
  }
  const m = /^rule:(.+):(\d{4}-\d{2}-\d{2})$/.exec(key);
  return m ? { kind: 'rule', ruleKey: m[1], ymd: m[2] } : null;
}

interface Row {
  id: string;
  name: string;
  ruleKey: string | null;
  dueAt: Date;
  assignedToId: string | null;
  relatedCattleId: string | null;
  sourceEventId: string | null;
  cattles: { cattleId: string }[];
}

/**
 * Fire-time re-read of a Task notification group (RAKHAL-496, docs/EPIC_NOTIFICATIONS_V2.md §3.3-3.4). Owns the
 * link and copy the old follow-up sweep used to build. Registered in `onModuleInit`.
 */
@Injectable()
export class TaskSourceResolver implements SourceResolver, OnModuleInit {
  readonly sourceType = 'TASK' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SourceResolverRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async resolve(ctx: ResolveContext): Promise<SourceResolution> {
    const key = parseTaskSourceKey(ctx.sourceKey);
    if (!key) return { state: 'GONE' };

    const rows = await this.openRows(ctx.farmId, key, ctx.timezone);
    if (rows.length === 0) return { state: 'GONE' };

    // Animals that left the herd drop out; a group whose animals all left has nothing to say.
    const allCattleIds = [...new Set(rows.flatMap((r) => this.cattleIdsOf(r)))];
    const live = allCattleIds.length
      ? await this.prisma.cattle.findMany({
          where: {
            id: { in: allCattleIds },
            farmId: ctx.farmId,
            herdStatus: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true, tagNumber: true },
        })
      : [];
    if (allCattleIds.length > 0 && live.length === 0) {
      return { state: 'ANIMALS_GONE' };
    }
    const liveIds = new Set(live.map((c) => c.id));
    const liveRows = rows.filter((r) => {
      const ids = this.cattleIdsOf(r);
      return ids.length === 0 || ids.some((id) => liveIds.has(id));
    });
    if (liveRows.length === 0) return { state: 'ANIMALS_GONE' };

    const first = [...liveRows].sort(
      (a, b) => a.dueAt.getTime() - b.dueAt.getTime(),
    )[0];
    const dueYmd = localDateIso(ctx.timezone, first.dueAt);
    // The occurrence's OWN lead names the wording ("1 day before" reads as 1 day, even when the Upcoming
    // list is viewed days earlier); the day-of occurrence falls back to the calendar gap.
    const days =
      ctx.leadMinutes > 0
        ? Math.max(1, Math.round(ctx.leadMinutes / 1440))
        : Math.max(
            0,
            Math.round(
              (dayKey(dueYmd).getTime() -
                dayKey(localDateIso(ctx.timezone, ctx.now)).getTime()) /
                DAY_MS,
            ),
          );
    const label =
      key.kind === 'rule'
        ? (ruleByKey(key.ruleKey)?.title ?? first.name)
        : first.name;
    const animals = animalsText(live.map((c) => c.tagNumber));

    const userIds = [
      ...new Set(
        liveRows.flatMap((r) => (r.assignedToId ? [r.assignedToId] : [])),
      ),
    ];
    const title =
      ctx.leadMinutes > 0
        ? `Coming up in ${days} day(s): ${label}`
        : `Due today: ${label}`;

    return {
      state: 'OK',
      userIds,
      // A rule group always reaches Owner + Manager (plus any assignee); a plain task goes to its assignee, else them.
      roles: key.kind === 'rule' ? [...DEFAULT_SOURCE_ROLES] : undefined,
      params: { label, animals, date: dueYmd, days },
      title,
      message: `${label}: ${animals}, due ${dueYmd}.`,
      ...this.action(key, liveRows, [...liveIds]),
    };
  }

  /** The open rows of one group. A rule group is every open task of the rule due on that farm-local day. */
  private async openRows(
    farmId: string,
    key: TaskSourceKey,
    timezone: string,
  ): Promise<Row[]> {
    const select = {
      id: true,
      name: true,
      ruleKey: true,
      dueAt: true,
      assignedToId: true,
      relatedCattleId: true,
      sourceEventId: true,
      cattles: { select: { cattleId: true } },
    } as const;
    if (key.kind === 'id') {
      return this.prisma.task.findMany({
        where: {
          id: key.taskId,
          farmId,
          status: { in: [...OPEN_STATUSES] },
        },
        select,
      });
    }
    const day = dayKey(key.ymd).getTime();
    const rows = await this.prisma.task.findMany({
      where: {
        farmId,
        ruleKey: key.ruleKey,
        status: { in: [...OPEN_STATUSES] },
        // Coarse window; the exact farm-local day is checked below (timezones shift the UTC date by up to a day).
        dueAt: {
          gte: new Date(day - 2 * DAY_MS),
          lt: new Date(day + 3 * DAY_MS),
        },
      },
      select,
    });
    return rows.filter((r) => localDateIso(timezone, r.dueAt) === key.ymd);
  }

  private cattleIdsOf(row: Row): string[] {
    return [
      ...new Set([
        ...(row.relatedCattleId ? [row.relatedCattleId] : []),
        ...row.cattles.map((c) => c.cattleId),
      ]),
    ];
  }

  /**
   * What tapping the notification does. One animal and one task: that animal's record, pre-filled with the event that
   * completes the task. Several: the filtered Animals list. A plain task with no single animal is info only.
   */
  private action(
    key: TaskSourceKey,
    rows: Row[],
    cattleIds: string[],
  ): { link?: string; data: Record<string, unknown> } {
    const taskIds = rows.map((r) => r.id);
    const ruleKey =
      key.kind === 'rule' ? key.ruleKey : (rows[0].ruleKey ?? null);
    if (taskIds.length === 1 && cattleIds.length === 1) {
      const cattleId = cattleIds[0];
      const taskId = taskIds[0];
      const eventType = ruleKey
        ? (ruleByKey(ruleKey)?.completesOn[0] ?? null)
        : null;
      const q = new URLSearchParams({ view: cattleId });
      if (eventType) q.set('record', eventType);
      return {
        link: `/animals?${q.toString()}`,
        data: {
          cattleId,
          taskId,
          ruleKey,
          eventType,
          sourceEventId: rows[0].sourceEventId,
        },
      };
    }
    const data = { ruleKey, taskIds, count: taskIds.length };
    return ruleKey ? { link: `/animals?due=${ruleKey}`, data } : { data };
  }
}

function animalsText(tags: string[]): string {
  if (tags.length === 0) return 'farm-wide';
  if (tags.length <= 3) return tags.join(', ');
  return `${tags.slice(0, 3).join(', ')} +${tags.length - 3} more`;
}
