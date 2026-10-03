import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HealthCaseStatus,
  HerdStatus,
  PlanEnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso } from 'src/common/farm-time/farm-time';
import {
  CursorPage,
  CursorPayload,
  decodeCursor,
  encodeCursor,
} from 'src/common/pagination';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  applicationRoundKey,
  buildRoundGrid,
  GridRunFact,
  parseRoundKey,
  RoundSummary,
  RoundTaskFact,
  summarizeRound,
  treatmentRoundKey,
} from '../../domain/health-round';
import { planKind, PlanKind } from '../../domain/health-plan-stats';
import {
  AddRoundAnimalsDto,
  RoundGridQueryDto,
  RoundsQueryDto,
} from '../../presentation/dto/health-rounds.dto';
import { farmDayStart } from '../../domain/health-farm-day';
import { HealthService } from './health.service';

const OPEN_CASE_STATUSES: HealthCaseStatus[] = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

const PLAN_SELECT = {
  id: true,
  name: true,
  category: true,
  deletedAt: true,
} satisfies Prisma.HealthPlanSelect;

const CATTLE_LIVE_SELECT = {
  id: true,
  name: true,
  tagNumber: true,
  herdStatus: true,
  deletedAt: true,
} satisfies Prisma.CattleSelect;

const TASK_SELECT = {
  id: true,
  healthPlanId: true,
  healthCaseId: true,
  planEnrollmentId: true,
  stepNumber: true,
  title: true,
  status: true,
  dueDateTime: true,
  completedAt: true,
  createdAt: true,
} satisfies Prisma.HealthTaskSelect;

type PlanRef = Prisma.HealthPlanGetPayload<{ select: typeof PLAN_SELECT }>;
type TaskRow = Prisma.HealthTaskGetPayload<{ select: typeof TASK_SELECT }>;
type CattleRow = Prisma.CattleGetPayload<{ select: typeof CATTLE_LIVE_SELECT }>;

const isActiveHerd = (cattle: Pick<CattleRow, 'herdStatus' | 'deletedAt'>) =>
  cattle.herdStatus === HerdStatus.ACTIVE && cattle.deletedAt === null;

export interface RoundRow extends RoundSummary {
  /** Opaque to clients: `app:<applicationId>` or `trt:<planId>:<yyyy-mm-dd>`. */
  roundKey: string;
  healthPlan: PlanRef;
  kind: PlanKind;
  /** The farm-local day the protocol was applied. */
  startDate: string;
  animalCount: number;
}

interface Draft {
  key: string;
  plan: PlanRef;
  startDate: string;
  cattleIds: Set<string>;
  tasks: RoundTaskFact[];
}

/**
 * Protocol rounds (RAKHAL-471 list, RAKHAL-472 grid — MILESTONE 29d, `docs/EPIC_PROTOCOL_ROUNDS.md`). Pure reads, no
 * migration. A round is one application of a protocol on one farm-local day: a real `PlanApplication` for preventive /
 * breeding protocols, a *derived* group (same protocol, same day the steps were created) for treatment (RD-116).
 * The maths and the grid shape live in `domain/health-round.ts`; this service only loads the facts, scoped to the farm.
 *
 * The list is built in memory for the whole farm and paged by a keyset cursor over the derived order — a farm has
 * hundreds of rounds, not millions, and the derivation (group by plan + day) cannot be expressed as one SQL page.
 */
@Injectable()
export class HealthRoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: FarmClockService,
    private readonly health: HealthService,
  ) {}

  async list(
    farmId: string,
    query: RoundsQueryDto,
  ): Promise<CursorPage<RoundRow>> {
    const timezone = await this.clock.timezone(farmId);
    const now = new Date();
    const dayOf = (d: Date) => localDateIso(timezone, d);
    const compare = roundCompare(query);

    const plans = (
      await this.prisma.healthPlan.findMany({
        where: {
          farmId,
          ...(query.healthPlanId ? { id: query.healthPlanId } : {}),
          ...(query.search
            ? { name: { contains: query.search, mode: 'insensitive' } }
            : {}),
        },
        select: PLAN_SELECT,
      })
    ).filter((plan) => !query.kind || planKind(plan.category) === query.kind);
    if (plans.length === 0) return keysetPage<RoundRow>([], compare, query);

    const planIds = plans.map((plan) => plan.id);
    const [applications, enrollments, cases, tasks] = await Promise.all([
      this.prisma.planApplication.findMany({
        where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
        select: { id: true, healthPlanId: true, startDate: true },
      }),
      this.prisma.planEnrollment.findMany({
        where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
        select: {
          id: true,
          planApplicationId: true,
          cattleId: true,
          status: true,
          cattle: { select: CATTLE_LIVE_SELECT },
        },
      }),
      this.prisma.healthCase.findMany({
        where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
        select: {
          id: true,
          healthPlanId: true,
          cattleId: true,
          status: true,
          startDate: true,
          cattle: { select: CATTLE_LIVE_SELECT },
        },
      }),
      this.prisma.healthTask.findMany({
        where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
        select: TASK_SELECT,
      }),
    ]);

    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const drafts = new Map<string, Draft>();
    const roundOfRun = new Map<string, string>();
    const liveOfRun = new Map<string, boolean>();

    for (const app of applications) {
      const plan = planById.get(app.healthPlanId);
      if (!plan) continue;
      const key = applicationRoundKey(app.id);
      drafts.set(key, {
        key,
        plan,
        startDate: dayOf(app.startDate),
        cattleIds: new Set(),
        tasks: [],
      });
    }
    for (const enrollment of enrollments) {
      const key = applicationRoundKey(enrollment.planApplicationId);
      const draft = drafts.get(key);
      if (!draft) continue;
      draft.cattleIds.add(enrollment.cattleId);
      roundOfRun.set(enrollment.id, key);
      liveOfRun.set(
        enrollment.id,
        enrollment.status === PlanEnrollmentStatus.ACTIVE &&
          isActiveHerd(enrollment.cattle),
      );
    }

    // A case joins the round of the day its protocol was applied = the day its first plan step was created.
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const appliedAt = firstStepCreatedAt(tasks, caseById);
    for (const c of cases) {
      const plan = planById.get(c.healthPlanId as string);
      if (!plan) continue;
      const day = dayOf(appliedAt.get(c.id) ?? c.startDate);
      const key = treatmentRoundKey(plan.id, day);
      let draft = drafts.get(key);
      if (!draft) {
        draft = { key, plan, startDate: day, cattleIds: new Set(), tasks: [] };
        drafts.set(key, draft);
      }
      draft.cattleIds.add(c.cattleId);
      roundOfRun.set(c.id, key);
      liveOfRun.set(
        c.id,
        OPEN_CASE_STATUSES.includes(c.status) && isActiveHerd(c.cattle),
      );
    }

    for (const task of tasks) {
      const runId = task.planEnrollmentId ?? task.healthCaseId;
      if (!runId) continue;
      if (!task.planEnrollmentId && !caseOwnsTask(task, caseById)) continue;
      const draft = drafts.get(roundOfRun.get(runId) ?? '');
      if (!draft) continue;
      draft.tasks.push(toFact(task, runId, liveOfRun.get(runId) ?? false));
    }

    const rows: RoundRow[] = [...drafts.values()]
      .map((draft) => ({
        roundKey: draft.key,
        healthPlan: draft.plan,
        kind: planKind(draft.plan.category),
        startDate: draft.startDate,
        animalCount: draft.cattleIds.size,
        ...summarizeRound(draft.tasks, timezone, now, dayOf),
      }))
      .filter((row) => !query.status || row.status === query.status);

    rows.sort((a, b) => compare(roundSortKey(a), roundSortKey(b)));
    return keysetPage(rows, compare, query, roundSortKey);
  }

  /**
   * RAKHAL-473 — add animals to a round that already exists. Resolves the round (404 for a malformed / unknown /
   * memberless key) and its protocol (which must not be deleted), then lets `HealthService.addAnimalsToRound` do the writes
   * with the same helpers a normal apply uses: a preventive / breeding round gets new enrollments on its application, a
   * treatment round gets new cases stamped with the round's day so they land in it. Steps already past are due now.
   */
  async addAnimals(
    farmId: string,
    userId: string,
    roundKey: string,
    dto: AddRoundAnimalsDto,
  ) {
    const parts = parseRoundKey(roundKey);
    if (!parts) throw new NotFoundException('Round not found');
    const timezone = await this.clock.timezone(farmId);
    const withSteps = {
      steps: { orderBy: { dayNumber: 'asc' as const } },
    } satisfies Prisma.HealthPlanInclude;

    let planId: string;
    let startDate: Date;
    let applicationId: string | undefined;
    if (parts.type === 'APPLICATION') {
      const application = await this.prisma.planApplication.findFirst({
        where: { id: parts.applicationId, farmId, deletedAt: null },
        select: { startDate: true, healthPlanId: true },
      });
      if (!application) throw new NotFoundException('Round not found');
      planId = application.healthPlanId;
      startDate = application.startDate;
      applicationId = parts.applicationId;
    } else {
      planId = parts.planId;
      if (
        !(await this.treatmentRoundExists(farmId, planId, parts.day, timezone))
      ) {
        throw new NotFoundException('Round not found');
      }
      // an instant safely inside the round's farm day (noon), so the derived round day is exactly `parts.day`
      startDate = new Date(
        farmDayStart(parts.day, timezone).getTime() + 12 * 60 * 60 * 1000,
      );
    }
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id: planId, farmId },
      include: withSteps,
    });
    if (!plan) throw new NotFoundException('Round not found');
    if (plan.deletedAt) {
      throw new BadRequestException(
        'This protocol was deleted, so animals cannot be added to its rounds',
      );
    }

    const result = await this.health.addAnimalsToRound(farmId, userId, {
      plan,
      cattleIds: dto.cattleIds,
      startDate,
      applicationId,
    });
    return {
      roundKey,
      addedCount: result.appliedCount,
      skippedCount: result.skippedCount,
      results: result.results,
    };
  }

  /**
   * Undo a whole round as a mistake (protocols v2). Every animal in it is cancelled in one call: recorded doses reversed,
   * steps deleted, enrollments / auto-created cases removed (see `HealthService.cancelEnrollment` / `cancelCaseProtocol`).
   * A preventive round is its application's enrollments; a treatment round is the plan's cases whose applied farm day is
   * the round's day (same day rule as `list` / `grid`).
   */
  async cancelRound(
    farmId: string,
    userId: string,
    roundKey: string,
    reason?: string,
  ) {
    const parts = parseRoundKey(roundKey);
    if (!parts) throw new NotFoundException('Round not found');

    const totals = {
      animals: 0,
      stepsRemoved: 0,
      dosesReversed: 0,
      casesRemoved: 0,
    };
    const add = (r: {
      stepsRemoved: number;
      dosesReversed: number;
      caseRemoved: boolean;
    }) => {
      totals.animals += 1;
      totals.stepsRemoved += r.stepsRemoved;
      totals.dosesReversed += r.dosesReversed;
      if (r.caseRemoved) totals.casesRemoved += 1;
    };

    if (parts.type === 'APPLICATION') {
      const enrollments = await this.prisma.planEnrollment.findMany({
        where: {
          farmId,
          planApplicationId: parts.applicationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (enrollments.length === 0)
        throw new NotFoundException('Round not found');
      for (const e of enrollments) {
        add(await this.health.cancelEnrollment(farmId, userId, e.id, reason));
      }
    } else {
      const timezone = await this.clock.timezone(farmId);
      const caseIds = await this.treatmentRoundCaseIds(
        farmId,
        parts.planId,
        parts.day,
        timezone,
      );
      if (caseIds.length === 0) throw new NotFoundException('Round not found');
      for (const id of caseIds) {
        add(await this.health.cancelCaseProtocol(farmId, userId, id, reason));
      }
    }
    return { roundKey, ...totals };
  }

  /** The cases of a treatment round (plan + farm day) — the ids behind `treatmentRoundExists`. */
  private async treatmentRoundCaseIds(
    farmId: string,
    planId: string,
    day: string,
    timezone: string,
  ): Promise<string[]> {
    const cases = await this.prisma.healthCase.findMany({
      where: { farmId, healthPlanId: planId, deletedAt: null },
      select: { id: true, healthPlanId: true, startDate: true },
    });
    if (cases.length === 0) return [];
    const tasks = await this.prisma.healthTask.findMany({
      where: {
        farmId,
        deletedAt: null,
        healthPlanId: planId,
        healthCaseId: { in: cases.map((c) => c.id) },
      },
      select: TASK_SELECT,
    });
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const appliedAt = firstStepCreatedAt(tasks, caseById);
    return cases
      .filter(
        (c) =>
          localDateIso(timezone, appliedAt.get(c.id) ?? c.startDate) === day,
      )
      .map((c) => c.id);
  }

  /** Does a treatment round (plan + farm day) have at least one case in it? Same day rule as `list` / `grid`. */
  private async treatmentRoundExists(
    farmId: string,
    planId: string,
    day: string,
    timezone: string,
  ): Promise<boolean> {
    const cases = await this.prisma.healthCase.findMany({
      where: { farmId, healthPlanId: planId, deletedAt: null },
      select: { id: true, healthPlanId: true, startDate: true },
    });
    if (cases.length === 0) return false;
    const tasks = await this.prisma.healthTask.findMany({
      where: {
        farmId,
        deletedAt: null,
        healthPlanId: planId,
        healthCaseId: { in: cases.map((c) => c.id) },
      },
      select: TASK_SELECT,
    });
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const appliedAt = firstStepCreatedAt(tasks, caseById);
    return cases.some(
      (c) => localDateIso(timezone, appliedAt.get(c.id) ?? c.startDate) === day,
    );
  }

  async grid(farmId: string, roundKey: string, query: RoundGridQueryDto) {
    const parts = parseRoundKey(roundKey);
    if (!parts) throw new NotFoundException('Round not found');
    const timezone = await this.clock.timezone(farmId);
    const now = new Date();
    const dayOf = (d: Date) => localDateIso(timezone, d);

    let plan: PlanRef & { steps: { dayNumber: number; title: string }[] };
    let startDate: string;
    const runs: GridRunFact[] = [];
    const liveOfRun = new Map<string, boolean>();
    let taskRows: TaskRow[];

    if (parts.type === 'APPLICATION') {
      const application = await this.prisma.planApplication.findFirst({
        where: { id: parts.applicationId, farmId, deletedAt: null },
        select: {
          startDate: true,
          healthPlan: {
            select: {
              ...PLAN_SELECT,
              steps: {
                select: { dayNumber: true, title: true },
                orderBy: { dayNumber: 'asc' },
              },
            },
          },
        },
      });
      if (!application) throw new NotFoundException('Round not found');
      plan = application.healthPlan;
      startDate = dayOf(application.startDate);
      const enrollments = await this.prisma.planEnrollment.findMany({
        where: {
          farmId,
          planApplicationId: parts.applicationId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          cattle: { select: CATTLE_LIVE_SELECT },
        },
      });
      for (const e of enrollments) {
        runs.push({
          runKey: e.id,
          runType: 'ENROLLMENT',
          healthCaseId: null,
          planEnrollmentId: e.id,
          caseCode: null,
          cattle: toCattle(e.cattle),
        });
        liveOfRun.set(
          e.id,
          e.status === PlanEnrollmentStatus.ACTIVE && isActiveHerd(e.cattle),
        );
      }
      taskRows = enrollments.length
        ? await this.prisma.healthTask.findMany({
            where: {
              farmId,
              deletedAt: null,
              planEnrollmentId: { in: enrollments.map((e) => e.id) },
            },
            select: TASK_SELECT,
          })
        : [];
    } else {
      const found = await this.prisma.healthPlan.findFirst({
        where: { id: parts.planId, farmId },
        select: {
          ...PLAN_SELECT,
          steps: {
            select: { dayNumber: true, title: true },
            orderBy: { dayNumber: 'asc' },
          },
        },
      });
      if (!found) throw new NotFoundException('Round not found');
      plan = found;
      startDate = parts.day;
      const cases = await this.prisma.healthCase.findMany({
        where: { farmId, healthPlanId: parts.planId, deletedAt: null },
        select: {
          id: true,
          caseCode: true,
          healthPlanId: true,
          status: true,
          startDate: true,
          cattle: { select: CATTLE_LIVE_SELECT },
        },
      });
      const allTasks = cases.length
        ? await this.prisma.healthTask.findMany({
            where: {
              farmId,
              deletedAt: null,
              healthPlanId: parts.planId,
              healthCaseId: { in: cases.map((c) => c.id) },
            },
            select: TASK_SELECT,
          })
        : [];
      const caseById = new Map(cases.map((c) => [c.id, c]));
      const appliedAt = firstStepCreatedAt(allTasks, caseById);
      const members = cases.filter(
        (c) => dayOf(appliedAt.get(c.id) ?? c.startDate) === parts.day,
      );
      if (members.length === 0) throw new NotFoundException('Round not found');
      const memberIds = new Set(members.map((c) => c.id));
      for (const c of members) {
        runs.push({
          runKey: c.id,
          runType: 'CASE',
          healthCaseId: c.id,
          planEnrollmentId: null,
          caseCode: c.caseCode,
          cattle: toCattle(c.cattle),
        });
        liveOfRun.set(
          c.id,
          OPEN_CASE_STATUSES.includes(c.status) && isActiveHerd(c.cattle),
        );
      }
      taskRows = allTasks.filter(
        (t) => t.healthCaseId && memberIds.has(t.healthCaseId),
      );
    }

    const facts = taskRows.map((task) => {
      const runId = (task.planEnrollmentId ?? task.healthCaseId) as string;
      return toFact(task, runId, liveOfRun.get(runId) ?? false);
    });
    const { columns, rows } = buildRoundGrid(
      runs,
      facts,
      plan.steps,
      timezone,
      now,
    );
    const shown = query.dueOnly ? rows.filter((row) => row.dueCount > 0) : rows;
    const items = shown.map((row) => ({
      runKey: row.runKey,
      runType: row.runType,
      healthCaseId: row.healthCaseId,
      planEnrollmentId: row.planEnrollmentId,
      caseCode: row.caseCode,
      cattle: row.cattle,
      dueCount: row.dueCount,
      overdueCount: row.overdueCount,
      cells: row.cells,
    }));
    const page = keysetPage(items, gridCompare, query, (item) => ({
      id: item.runKey,
      overdue: item.overdueCount,
      due: item.dueCount,
      label: item.cattle.name ?? item.cattle.tagNumber,
    }));

    return {
      data: {
        round: {
          roundKey,
          healthPlan: {
            id: plan.id,
            name: plan.name,
            category: plan.category,
            deletedAt: plan.deletedAt,
          },
          kind: planKind(plan.category),
          startDate,
          animalCount: runs.length,
          ...summarizeRound(facts, timezone, now, dayOf),
        },
        columns,
        rows: page.items,
      },
      meta: page.meta,
    };
  }
}

function toFact(task: TaskRow, runKey: string, live: boolean): RoundTaskFact {
  return {
    id: task.id,
    runKey,
    stepNumber: task.stepNumber,
    title: task.title,
    status: task.status,
    dueDateTime: task.dueDateTime,
    completedAt: task.completedAt,
    live,
  };
}

function toCattle(cattle: CattleRow) {
  return { id: cattle.id, name: cattle.name, tagNumber: cattle.tagNumber };
}

/** A task counts for a case only while the case is still on the task's protocol (a stopped protocol clears the case's). */
function caseOwnsTask(
  task: Pick<TaskRow, 'healthCaseId' | 'healthPlanId'>,
  caseById: Map<string, { healthPlanId: string | null }>,
): boolean {
  const c = task.healthCaseId ? caseById.get(task.healthCaseId) : undefined;
  return Boolean(c && c.healthPlanId === task.healthPlanId);
}

/** When each case's protocol was applied: the creation time of its earliest step of that protocol. */
function firstStepCreatedAt(
  tasks: TaskRow[],
  caseById: Map<string, { healthPlanId: string | null }>,
): Map<string, Date> {
  const first = new Map<string, Date>();
  for (const task of tasks) {
    if (!task.healthCaseId || !caseOwnsTask(task, caseById)) continue;
    const prev = first.get(task.healthCaseId);
    if (!prev || task.createdAt < prev) {
      first.set(task.healthCaseId, task.createdAt);
    }
  }
  return first;
}

type SortKey = CursorPayload;

const roundSortKey = (row: RoundRow): SortKey => ({
  id: row.roundKey,
  startDate: row.startDate,
});

/** Newest round first by default (`sortOrder=asc` flips it); the round key breaks ties. */
function roundCompare(query: Pick<RoundsQueryDto, 'sortOrder'>) {
  const dir = query.sortOrder === 'asc' ? 1 : -1;
  return (a: SortKey, b: SortKey): number =>
    dir *
    (String(a.startDate).localeCompare(String(b.startDate)) ||
      a.id.localeCompare(b.id));
}

/** Most urgent animal first: more late steps, then more due today, then name, then run key. */
function gridCompare(a: SortKey, b: SortKey): number {
  return (
    Number(b.overdue) - Number(a.overdue) ||
    Number(b.due) - Number(a.due) ||
    String(a.label).localeCompare(String(b.label)) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Keyset page over rows that are already sorted by `compare`. The cursor carries the last row's sort key, so the next
 * page starts at the first row strictly after it — still right when rows appear or vanish between requests.
 */
function keysetPage<T>(
  rows: T[],
  compare: (a: SortKey, b: SortKey) => number,
  query: { limit: number; cursor?: string },
  sortKey: (row: T) => SortKey = () => ({ id: '' }),
): CursorPage<T> {
  let start = 0;
  if (query.cursor) {
    const after = decodeCursor(query.cursor);
    const index = rows.findIndex((row) => compare(sortKey(row), after) > 0);
    start = index === -1 ? rows.length : index;
  }
  const page = rows.slice(start, start + query.limit);
  return {
    items: page,
    meta: {
      count: page.length,
      limit: query.limit,
      hasNextPage: start + query.limit < rows.length,
      hasPreviousPage: Boolean(query.cursor),
      startCursor: page.length ? encodeCursor(sortKey(page[0])) : null,
      endCursor: page.length
        ? encodeCursor(sortKey(page[page.length - 1]))
        : null,
    },
  };
}
