import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Task,
  TaskCategory,
  TaskPriority,
  TaskRecurrence,
  TaskSource,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  buildSteps,
  displayStatus,
  parseSteps,
  TaskStep,
} from '../../domain/task-step';
import { CreateTaskDto } from '../../presentation/dto/create-task.dto';
import { ListTaskQueryDto } from '../../presentation/dto/list-task-query.dto';
import { UpdateTaskDto } from '../../presentation/dto/update-task.dto';
import { CompleteTaskDto } from '../../presentation/dto/complete-task.dto';

/** Input for module-to-module task creation (RAKHAL-097). */
export interface CreateTaskInternalInput {
  farmId: string;
  createdBy: string;
  name: string;
  category: TaskCategory;
  dueAt: Date;
  source: TaskSource;
  priority?: TaskPriority;
  details?: string;
  assignedToId?: string;
  relatedCattleId?: string;
  steps?: string[];
  safetyCritical?: boolean;
  /** RAKHAL-303 edit substrate: the domain event this task was generated
   * from (e.g. "BREEDING_EVENT"), paired with `sourceEventId`. Lets
   * `rescheduleBySourceEvent` find it when that event is later edited. */
  sourceEventType?: string;
  sourceEventId?: string;
}

type TaskWithAssignee = Task & {
  assignedTo: { id: string; name: string } | null;
};

@Injectable()
export class TaskService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TaskService.name);
  }

  // ---- Write paths ---------------------------------------------------------

  /** Controller path — a user creates a manual task. */
  async create(farmId: string, userId: string, dto: CreateTaskDto) {
    await this.assertAssignee(farmId, dto.assignedToId);

    return this.present(
      await this.insert({
        farmId,
        createdBy: userId,
        name: dto.name,
        details: dto.details,
        category: dto.category ?? TaskCategory.GENERAL,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueAt: new Date(dto.dueAt),
        steps: buildSteps(dto.steps),
        recurring: dto.recurring ?? false,
        recurrenceType: dto.recurrenceType,
        recurrenceEndDate: dto.recurrenceEndDate
          ? new Date(dto.recurrenceEndDate)
          : null,
        safetyCritical: dto.safetyCritical ?? false,
        source: TaskSource.MANUAL,
        relatedCattleId: dto.relatedCattleId,
        assignedToId: dto.assignedToId,
      }),
    );
  }

  /**
   * Internal create API (RAKHAL-097): other modules call this to spin up tasks
   * (reproduction pregnancy-check, calving colostrum, health-plan doses, …). The
   * record is identical to a manual task and shows up in the Task Hub.
   */
  async createInternal(input: CreateTaskInternalInput): Promise<Task> {
    await this.assertAssignee(input.farmId, input.assignedToId);
    return this.insert({
      farmId: input.farmId,
      createdBy: input.createdBy,
      name: input.name,
      details: input.details,
      category: input.category,
      priority: input.priority ?? TaskPriority.MEDIUM,
      dueAt: input.dueAt,
      steps: buildSteps(input.steps),
      recurring: false,
      recurrenceType: null,
      recurrenceEndDate: null,
      safetyCritical: input.safetyCritical ?? false,
      source: input.source,
      relatedCattleId: input.relatedCattleId,
      assignedToId: input.assignedToId,
      sourceEventType: input.sourceEventType,
      sourceEventId: input.sourceEventId,
    });
  }

  /**
   * RAKHAL-303: move `dueAt` on every non-completed task generated from a
   * given domain event, in one `updateMany` — called by an edit handler
   * (RAKHAL-305/306) when the event's date changes (e.g. a moved breeding
   * date shifts its pregnancy-check task). Already-completed tasks are left
   * untouched and reported back so the caller can surface "1 task was
   * already done" rather than silently rewriting history. Never deletes —
   * `remove()` stays manual-only.
   */
  async rescheduleBySourceEvent(
    farmId: string,
    sourceEventType: string,
    sourceEventId: string,
    newDueAt: Date,
  ): Promise<{
    rescheduledTaskIds: string[];
    alreadyCompletedTaskIds: string[];
  }> {
    const tasks = await this.prisma.task.findMany({
      where: { farmId, sourceEventType, sourceEventId },
      select: { id: true, status: true },
    });
    const pending = tasks.filter((t) => t.status !== TaskStatus.COMPLETED);
    const alreadyCompleted = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    );

    if (pending.length > 0) {
      await this.prisma.task.updateMany({
        where: { id: { in: pending.map((t) => t.id) } },
        data: { dueAt: newDueAt },
      });
    }

    this.log.info('Tasks rescheduled by source event', {
      farmId,
      sourceEventType,
      sourceEventId,
      rescheduled: pending.length,
      alreadyCompleted: alreadyCompleted.length,
    });

    return {
      rescheduledTaskIds: pending.map((t) => t.id),
      alreadyCompletedTaskIds: alreadyCompleted.map((t) => t.id),
    };
  }

  /**
   * RAKHAL-315: complete every non-completed task tagged with this source
   * event in one shot — used when a domain event resolves the task's whole
   * reason for existing (e.g. a pregnancy diagnosis closes its pregnancy-check
   * task, a return-to-heat closes the one it superseded). Mirrors
   * `rescheduleBySourceEvent`'s shape. Already-completed tasks are a no-op,
   * not an error. No `TaskStatus.CANCELLED` exists (MILESTONE 17 dropped a
   * cancel substrate on purpose) — `note` lets a caller like return-to-heat
   * record *why* it closed without a distinct status.
   */
  async completeBySourceEvent(
    farmId: string,
    sourceEventType: string,
    sourceEventId: string,
    userId: string,
    note?: string,
  ): Promise<{ completedTaskIds: string[] }> {
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        sourceEventType,
        sourceEventId,
        status: { not: TaskStatus.COMPLETED },
      },
      select: { id: true, details: true },
    });

    await Promise.all(
      tasks.map((t) =>
        this.prisma.task.update({
          where: { id: t.id },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
            completedById: userId,
            details: note ? `${t.details ?? ''}\n${note}`.trim() : t.details,
          },
        }),
      ),
    );

    this.log.info('Tasks completed by source event', {
      farmId,
      sourceEventType,
      sourceEventId,
      completed: tasks.length,
    });

    return { completedTaskIds: tasks.map((t) => t.id) };
  }

  async update(farmId: string, id: string, dto: UpdateTaskDto) {
    await this.getOrThrow(farmId, id);
    await this.assertAssignee(farmId, dto.assignedToId);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        name: dto.name,
        details: dto.details,
        category: dto.category,
        priority: dto.priority,
        status: dto.status,
        ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
        assignedToId: dto.assignedToId,
        safetyCritical: dto.safetyCritical,
      },
      include: this.assigneeInclude(),
    });

    this.log.info('Task updated', { taskId: id, farmId });
    return this.present(task);
  }

  /** Complete a task; if recurring, spawn the next occurrence (PRD §17.6 on-complete path). */
  async complete(
    farmId: string,
    userId: string,
    id: string,
    dto: CompleteTaskDto,
  ) {
    const existing = await this.getOrThrow(farmId, id);
    if (existing.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Task is already completed');
    }

    const completedSteps = parseSteps(existing.steps).map((s) => ({
      ...s,
      completed: true,
    }));

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedById: userId,
        completionPhotoUrl: dto.completionPhotoUrl,
        steps: completedSteps,
      },
      include: this.assigneeInclude(),
    });

    const next = await this.maybeCreateNextRecurrence(existing, userId);

    this.log.info('Task completed', {
      taskId: id,
      farmId,
      nextRecurrenceCreated: Boolean(next),
    });
    return {
      ...this.present(task),
      nextRecurrenceCreated: Boolean(next),
      nextTaskId: next?.id ?? null,
    };
  }

  async checkStep(
    farmId: string,
    id: string,
    stepId: string,
    completed: boolean,
  ) {
    const existing = await this.getOrThrow(farmId, id);
    const steps = parseSteps(existing.steps);
    const target = steps.find((s) => s.id === stepId);
    if (!target) {
      throw new NotFoundException('Step not found');
    }
    target.completed = completed;

    const task = await this.prisma.task.update({
      where: { id },
      data: { steps: steps as unknown as Prisma.InputJsonValue },
      include: this.assigneeInclude(),
    });
    return this.present(task);
  }

  async remove(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    await this.prisma.task.delete({ where: { id } });
    this.log.info('Task deleted', { taskId: id, farmId });
    return { deleted: true };
  }

  // ---- Read paths ----------------------------------------------------------

  async findAll(farmId: string, userId: string, query: ListTaskQueryDto) {
    const now = new Date();
    const where: Prisma.TaskWhereInput = {
      farmId,
      ...this.filterClause(query.filter, userId, now),
      ...(query.category ? { category: query.category } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ dueAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.assigneeInclude(),
    });

    const page = toCursorPage(rows, query);
    const highlights = await this.highlights(farmId, now);

    return {
      items: page.items.map((task) => this.present(task)),
      meta: { ...page.meta, highlights },
    };
  }

  async findOne(farmId: string, id: string) {
    return this.present(await this.getOrThrow(farmId, id, true));
  }

  // ---- Helpers -------------------------------------------------------------

  private filterClause(
    filter: ListTaskQueryDto['filter'],
    userId: string,
    now: Date,
  ): Prisma.TaskWhereInput {
    switch (filter) {
      case 'my_tasks':
        return { assignedToId: userId };
      case 'overdue':
        return { status: { not: TaskStatus.COMPLETED }, dueAt: { lt: now } };
      case 'blocked':
        return { status: TaskStatus.BLOCKED };
      default:
        return {};
    }
  }

  private async highlights(farmId: string, now: Date) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dueToday, overdue, blocked, completedThisMonth] = await Promise.all([
      this.prisma.task.count({
        where: {
          farmId,
          status: { not: TaskStatus.COMPLETED },
          dueAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      this.prisma.task.count({
        where: {
          farmId,
          status: { not: TaskStatus.COMPLETED },
          dueAt: { lt: now },
        },
      }),
      this.prisma.task.count({
        where: { farmId, status: TaskStatus.BLOCKED },
      }),
      this.prisma.task.findMany({
        where: {
          farmId,
          status: TaskStatus.COMPLETED,
          completedAt: { gte: monthStart },
        },
        select: { dueAt: true, completedAt: true },
      }),
    ]);

    const late = completedThisMonth.filter(
      (t) => t.completedAt && t.completedAt.getTime() > t.dueAt.getTime(),
    ).length;
    const lateRate =
      completedThisMonth.length > 0
        ? Math.round((late / completedThisMonth.length) * 1000) / 10
        : 0;

    return {
      dueToday,
      overdue,
      blocked,
      lateCompletionRatePct: lateRate,
    };
  }

  private async insert(data: {
    farmId: string;
    createdBy: string;
    name: string;
    details?: string;
    category: TaskCategory;
    priority: TaskPriority;
    dueAt: Date;
    steps: TaskStep[];
    recurring: boolean;
    recurrenceType?: TaskRecurrence | null;
    recurrenceEndDate?: Date | null;
    safetyCritical: boolean;
    source: TaskSource;
    relatedCattleId?: string;
    assignedToId?: string;
    sourceEventType?: string;
    sourceEventId?: string;
  }): Promise<Task> {
    // Sequential per-farm reference with a small retry on the unique race.
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.task.count({
        where: { farmId: data.farmId },
      });
      const reference = `TSK-${String(count + 1 + attempt).padStart(3, '0')}`;
      try {
        return await this.prisma.task.create({
          data: {
            farmId: data.farmId,
            reference,
            name: data.name,
            details: data.details,
            category: data.category,
            priority: data.priority,
            dueAt: data.dueAt,
            steps: data.steps.length
              ? (data.steps as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            recurring: data.recurring,
            recurrenceType: data.recurrenceType ?? null,
            recurrenceEndDate: data.recurrenceEndDate ?? null,
            safetyCritical: data.safetyCritical,
            source: data.source,
            relatedCattleId: data.relatedCattleId,
            assignedToId: data.assignedToId,
            sourceEventType: data.sourceEventType,
            sourceEventId: data.sourceEventId,
            createdBy: data.createdBy,
          },
        });
      } catch (error) {
        if (this.isUniqueError(error)) continue;
        throw error;
      }
    }
    throw new BadRequestException('Could not allocate a task reference');
  }

  private async maybeCreateNextRecurrence(
    task: Task,
    userId: string,
  ): Promise<Task | null> {
    if (!task.recurring || !task.recurrenceType) return null;

    const nextDue = this.addInterval(task.dueAt, task.recurrenceType);
    if (
      task.recurrenceEndDate &&
      nextDue.getTime() > task.recurrenceEndDate.getTime()
    ) {
      return null;
    }

    return this.insert({
      farmId: task.farmId,
      createdBy: userId,
      name: task.name,
      details: task.details ?? undefined,
      category: task.category,
      priority: task.priority,
      dueAt: nextDue,
      steps: parseSteps(task.steps).map((s) => ({ ...s, completed: false })),
      recurring: true,
      recurrenceType: task.recurrenceType,
      recurrenceEndDate: task.recurrenceEndDate,
      safetyCritical: task.safetyCritical,
      source: task.source,
      relatedCattleId: task.relatedCattleId ?? undefined,
      assignedToId: task.assignedToId ?? undefined,
    });
  }

  private addInterval(date: Date, type: TaskRecurrence): Date {
    const next = new Date(date);
    if (type === TaskRecurrence.DAILY) next.setDate(next.getDate() + 1);
    else if (type === TaskRecurrence.WEEKLY) next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    return next;
  }

  private async assertAssignee(farmId: string, assignedToId?: string) {
    if (!assignedToId) return;
    const member = await this.prisma.farmMember.findUnique({
      where: { farmId_userId: { farmId, userId: assignedToId } },
      select: { id: true },
    });
    if (!member) {
      throw new BadRequestException('Assignee must be a member of this farm');
    }
  }

  private async getOrThrow(
    farmId: string,
    id: string,
    withAssignee = false,
  ): Promise<TaskWithAssignee> {
    const task = await this.prisma.task.findFirst({
      where: { id, farmId },
      include: withAssignee ? this.assigneeInclude() : this.assigneeInclude(),
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private assigneeInclude() {
    return {
      assignedTo: { select: { id: true, name: true } },
    } satisfies Prisma.TaskInclude;
  }

  private present(
    task: Task & { assignedTo?: { id: string; name: string } | null },
  ) {
    const steps = parseSteps(task.steps);
    const now = new Date();
    const display = displayStatus(task.status, task.dueAt, now);
    return {
      ...task,
      steps,
      stepsTotal: steps.length,
      stepsCompleted: steps.filter((s) => s.completed).length,
      displayStatus: display,
      overdueByHours:
        display === 'overdue'
          ? Math.floor((now.getTime() - task.dueAt.getTime()) / 3_600_000)
          : null,
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
