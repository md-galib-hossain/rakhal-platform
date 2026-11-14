import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthTaskStatus,
  HerdStatus,
  PlanEnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { dayKey, zonedToUtc } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';
import type {
  ResolveContext,
  ResolverSourceType,
  SourceResolution,
  SourceResolver,
} from 'src/modules/notification/application/resolvers/source-resolver.port';

/** A step that can still be acted on. `RESCHEDULED` keeps a live status with a new `dueDateTime`. */
const LIVE_TASK_STATUSES = [
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
const DAY_MS = 24 * 60 * 60 * 1000;

/** One notice's worth of steps: same protocol round (or same case) and the same farm-local due day. */
export interface StepGroupRef {
  kind: 'round' | 'case';
  /** `PlanApplication.id` for a round, `HealthCase.id` for a case. */
  id: string;
  /** Farm-local `YYYY-MM-DD`. */
  ymd: string;
}

/** `round:<planApplicationId>:<ymd>` (preventive) or `case:<healthCaseId>:<ymd>` (curative); ids are cuids (no `:`). */
export function stepSourceKey(ref: StepGroupRef): string {
  return `${ref.kind}:${ref.id}:${ref.ymd}`;
}

export function parseStepSourceKey(key: string): StepGroupRef | null {
  const m = /^(round|case):([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key);
  return m ? { kind: m[1] as 'round' | 'case', id: m[2], ymd: m[3] } : null;
}

const STEP_SELECT = {
  id: true,
  cattleId: true,
  title: true,
  dueDateTime: true,
  timeOfDay: true,
  healthCaseId: true,
  cattle: {
    select: { name: true, tagNumber: true, herdStatus: true, deletedAt: true },
  },
  healthCase: { select: { healthPlan: { select: { name: true } } } },
  planEnrollment: {
    select: {
      planApplicationId: true,
      healthPlan: { select: { name: true } },
    },
  },
  healthPlan: { select: { name: true } },
} satisfies Prisma.HealthTaskSelect;

export type StepRow = Prisma.HealthTaskGetPayload<{
  select: typeof STEP_SELECT;
}>;

export interface StepGroup {
  ref: StepGroupRef;
  /** Open steps of the group on that farm day (case open / enrollment ACTIVE), animals of any state. */
  open: StepRow[];
  /** The subset whose animal is still in the active herd. */
  live: StepRow[];
}

/**
 * Health protocol steps as a notification source (RAKHAL-497, docs/EPIC_NOTIFICATIONS_V2.md §3.4). Steps live in
 * `HealthTask` (deliberately not the Task Hub). Same grouping the retired health reminder sweep used: ONE notice per
 * protocol round (preventive) or per case (curative) and farm-local due day, never one per animal. The schedule never
 * copies state; this resolver re-reads the group at fire time.
 */
@Injectable()
export class HealthStepSourceResolver implements SourceResolver, OnModuleInit {
  readonly sourceType: ResolverSourceType = 'HEALTH_STEP';

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SourceResolverRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  /** Open steps of one group, farm-scoped. Pure read; joins an ambient transaction through the Prisma proxy. */
  async loadGroup(
    farmId: string,
    ref: StepGroupRef,
    timezone: string,
  ): Promise<StepGroup> {
    const start = zonedToUtc(timezone, ref.ymd, '00:00');
    const nextYmd = new Date(dayKey(ref.ymd).getTime() + DAY_MS)
      .toISOString()
      .slice(0, 10);
    const end = zonedToUtc(timezone, nextYmd, '00:00');

    const scope: Prisma.HealthTaskWhereInput =
      ref.kind === 'round'
        ? {
            planEnrollment: {
              is: {
                planApplicationId: ref.id,
                status: PlanEnrollmentStatus.ACTIVE,
                deletedAt: null,
              },
            },
          }
        : {
            healthCaseId: ref.id,
            healthCase: {
              is: { status: { in: OPEN_CASE_STATUSES }, deletedAt: null },
            },
          };

    const open = await this.prisma.healthTask.findMany({
      where: {
        farmId,
        deletedAt: null,
        status: { in: LIVE_TASK_STATUSES },
        dueDateTime: { gte: start, lt: end },
        ...scope,
      },
      select: STEP_SELECT,
      orderBy: [{ dueDateTime: 'asc' }, { id: 'asc' }],
    });
    const live = open.filter(
      (s) => s.cattle.herdStatus === HerdStatus.ACTIVE && !s.cattle.deletedAt,
    );
    return { ref, open, live };
  }

  async resolve(ctx: ResolveContext): Promise<SourceResolution> {
    const ref = parseStepSourceKey(ctx.sourceKey);
    if (!ref) return { state: 'GONE' };
    const group = await this.loadGroup(ctx.farmId, ref, ctx.timezone);
    if (group.open.length === 0) return { state: 'GONE' };
    if (group.live.length === 0) return { state: 'ANIMALS_GONE' };

    const label = stepGroupLabel(group);
    const animals = new Set(group.live.map((s) => s.cattleId)).size;
    const leadDays = Math.round(ctx.leadMinutes / 1440);
    return {
      state: 'OK',
      userIds: [],
      roles: ['Owner', 'Manager'],
      params: { label, animals, date: ref.ymd, days: leadDays },
      title: titleForLead(ctx.leadMinutes, leadDays),
      message: `${label}: ${animals} animal(s), due ${ref.ymd}.`,
      // Deep link to Protocols (RFE-143): Protocols is where due steps are recorded.
      link: `/healthcare?healthTab=protocols&date=${ref.ymd}`,
      data: {
        healthTab: 'protocols',
        date: ref.ymd,
        ...(ref.kind === 'round'
          ? { planApplicationId: ref.id }
          : { healthCaseId: ref.id }),
      },
    };
  }
}

/** Curative groups name the animal too ("Mastitis Treatment · Lakshmi"); preventive rounds name the protocol. */
export function stepGroupLabel(group: StepGroup): string {
  const first = group.live[0] ?? group.open[0];
  const planName =
    first.planEnrollment?.healthPlan.name ??
    first.healthCase?.healthPlan?.name ??
    first.healthPlan?.name ??
    first.title;
  return group.ref.kind === 'case'
    ? `${planName} · ${first.cattle.name ?? first.cattle.tagNumber}`
    : planName;
}

function titleForLead(leadMinutes: number, leadDays: number): string {
  if (leadMinutes === 0) return 'Health Step Due Today';
  if (leadMinutes < 1440) return `Health Step Due in ${leadMinutes} Minutes`;
  if (leadDays === 1) return 'Health Step Due Tomorrow';
  return `Health Step Due in ${leadDays} Days`;
}
