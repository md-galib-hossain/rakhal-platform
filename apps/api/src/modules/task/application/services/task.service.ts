import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Task,
  TaskAuditAction,
  TaskCategory,
  TaskKind,
  TaskPriority,
  TaskRecurrence,
  TaskSource,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { displayStatus } from '../../domain/task-status';
import { nextOccurrence } from 'src/modules/animal-events/domain/reminder-cadence';
import { CreateTaskDto } from '../../presentation/dto/create-task.dto';
import { ListTaskQueryDto } from '../../presentation/dto/list-task-query.dto';
import { UpdateTaskDto } from '../../presentation/dto/update-task.dto';
import {
  CompleteTaskDto,
  CancelTaskDto,
} from '../../presentation/dto/complete-task.dto';

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
  safetyCritical?: boolean;
  /** RAKHAL-303 edit substrate: the domain event this task was generated
   * from (e.g. "BREEDING_EVENT"), paired with `sourceEventId`. Lets
   * `rescheduleBySourceEvent` find it when that event is later edited. */
  sourceEventType?: string;
  sourceEventId?: string;
  /** RAKHAL-484: `<ruleKey>:<sourceEventId>`; unique while the task is open. */
  followUpKey?: string;
  ruleKey?: string;
}

type TaskWithAssignee = Task & {
  assignedTo: { id: string; name: string } | null;
  cattles: { cattleId: string }[];
  recipients: { userId: string }[];
};

import { eventApiContext } from 'src/modules/animal-events/application/event-api-context';

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

    if (dto.relatedCattleId && dto.cattleIds?.length) {
      throw new BadRequestException(
        'Provide either relatedCattleId or cattleIds, not both',
      );
    }
    if (dto.cattleIds?.length) {
      await this.assertCattleIds(farmId, dto.cattleIds);
    }

    // RAKHAL-491: kind decides; the deprecated category=REMINDER is still accepted as a kind=REMINDER alias.
    if (dto.kind === TaskKind.TASK && dto.category === TaskCategory.REMINDER) {
      throw new BadRequestException(
        'kind TASK conflicts with the legacy category REMINDER',
      );
    }
    const isReminder =
      dto.kind === TaskKind.REMINDER || dto.category === TaskCategory.REMINDER;
    const link = isReminder
      ? await this.resolveReminderLink(farmId, dto)
      : null;
    if (!isReminder && !dto.dueAt) {
      throw new BadRequestException('dueAt is required');
    }
    if (isReminder) {
      this.assertRepeat(dto, link!.dueAt);
      await this.assertMembers(farmId, dto.recipientUserIds);
    }
    // A reminder linked to an event defaults to that event's animal.
    const relatedCattleId = dto.cattleIds?.length
      ? undefined
      : (dto.relatedCattleId ?? link?.cattleId);

    return this.present(
      await this.insert({
        farmId,
        createdBy: userId,
        name: dto.name,
        details: dto.details,
        category: this.topic(dto.category),
        kind: isReminder ? TaskKind.REMINDER : TaskKind.TASK,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        dueAt: link ? link.dueAt : new Date(dto.dueAt!),
        recurring: dto.recurring ?? false,
        recurrenceType: dto.recurrenceType,
        recurrenceEndDate: dto.recurrenceEndDate
          ? new Date(dto.recurrenceEndDate)
          : null,
        safetyCritical: dto.safetyCritical ?? false,
        source: TaskSource.MANUAL,
        relatedCattleId,
        cattleIds: dto.cattleIds,
        assignedToId: dto.assignedToId,
        ...(isReminder
          ? {
              remindDaysBefore: dto.remindDaysBefore,
              notifyRoleNames: dto.notifyRoleNames,
              recurrenceIntervalDays: dto.recurrenceIntervalDays,
              recipientUserIds: dto.recipientUserIds,
              ...(link?.sourceEventId
                ? {
                    sourceEventType: 'ANIMAL_EVENT',
                    sourceEventId: link.sourceEventId,
                    reminderOffsetDays: dto.offsetDays,
                  }
                : {}),
            }
          : {}),
      }),
    );
  }

  /**
   * RAKHAL-487: a reminder is due on a fixed date OR relative to an animal event (event date +
   * `offsetDays`). The linked event must be this farm's and not voided.
   */
  private async resolveReminderLink(
    farmId: string,
    dto: Pick<CreateTaskDto, 'dueAt' | 'sourceEventId' | 'offsetDays'>,
  ): Promise<{
    dueAt: Date;
    sourceEventId?: string;
    cattleId?: string;
  }> {
    if (dto.sourceEventId) {
      if (dto.dueAt) {
        throw new BadRequestException(
          'Give either dueAt or sourceEventId with offsetDays, not both',
        );
      }
      if (dto.offsetDays === undefined) {
        throw new BadRequestException(
          'offsetDays is required with sourceEventId',
        );
      }
      const ev = await this.prisma.animalEvent.findFirst({
        where: { id: dto.sourceEventId, farmId },
        select: { id: true, cattleId: true, eventAt: true, status: true },
      });
      if (!ev) throw new NotFoundException('Source event not found');
      if (ev.status === 'VOIDED') {
        throw new BadRequestException('The source event is voided');
      }
      return {
        dueAt: new Date(ev.eventAt.getTime() + dto.offsetDays * 86_400_000),
        sourceEventId: ev.id,
        cattleId: ev.cattleId,
      };
    }
    if (!dto.dueAt) {
      throw new BadRequestException(
        'A reminder needs dueAt, or sourceEventId with offsetDays',
      );
    }
    return { dueAt: new Date(dto.dueAt) };
  }

  /** Repeat rules: a type when recurring, an interval for EVERY_N_DAYS, an end after the first date. */
  private assertRepeat(
    dto: Pick<
      CreateTaskDto,
      | 'recurring'
      | 'recurrenceType'
      | 'recurrenceIntervalDays'
      | 'recurrenceEndDate'
    >,
    firstDue: Date,
  ) {
    if (!dto.recurring) return;
    if (!dto.recurrenceType) {
      throw new BadRequestException(
        'recurrenceType is required when repeating',
      );
    }
    if (
      dto.recurrenceType === TaskRecurrence.EVERY_N_DAYS &&
      !dto.recurrenceIntervalDays
    ) {
      throw new BadRequestException(
        'recurrenceIntervalDays is required for EVERY_N_DAYS',
      );
    }
    if (
      dto.recurrenceEndDate &&
      new Date(dto.recurrenceEndDate).getTime() < firstDue.getTime()
    ) {
      throw new BadRequestException(
        'recurrenceEndDate must not be before the first due date',
      );
    }
  }

  /** Named reminder recipients must be members of this farm. */
  private async assertMembers(farmId: string, userIds?: string[]) {
    const unique = Array.from(new Set(userIds ?? []));
    if (!unique.length) return;
    const found = await this.prisma.farmMember.count({
      where: { farmId, userId: { in: unique } },
    });
    if (found !== unique.length) {
      throw new BadRequestException(
        'Every recipient must be a member of this farm',
      );
    }
  }

  /**
   * RAKHAL-487: spawn the next occurrence of a repeating reminder, once. The claim (`spawnedNextAt`
   * null -> now) is a single conditional update, so a second sweep or a completion racing the sweep
   * spawns nothing more. Past occurrences are skipped so a long gap does not flood the hub.
   */
  async spawnNextReminder(
    taskId: string,
    now = new Date(),
  ): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: this.assigneeInclude(),
    });
    if (
      !task ||
      task.kind !== TaskKind.REMINDER ||
      !task.recurring ||
      !task.recurrenceType
    ) {
      return null;
    }
    const claim = await this.prisma.task.updateMany({
      where: { id: taskId, spawnedNextAt: null },
      data: { spawnedNextAt: now },
    });
    if (claim.count === 0) return null;

    let nextDue = nextOccurrence(
      task.dueAt,
      task.recurrenceType,
      task.recurrenceIntervalDays,
    );
    for (
      let i = 0;
      i < 400 && nextDue.getTime() < now.getTime() - 86_400_000;
      i++
    ) {
      nextDue = nextOccurrence(
        nextDue,
        task.recurrenceType,
        task.recurrenceIntervalDays,
      );
    }
    if (
      task.recurrenceEndDate &&
      nextDue.getTime() > task.recurrenceEndDate.getTime()
    ) {
      return null;
    }
    // A reminder tied to an event is a one-off milestone: its repeats are free-standing.
    return this.insert({
      farmId: task.farmId,
      createdBy: task.createdBy,
      name: task.name,
      details: task.details ?? undefined,
      category: task.category,
      kind: TaskKind.REMINDER,
      priority: task.priority,
      dueAt: nextDue,
      recurring: true,
      recurrenceType: task.recurrenceType,
      recurrenceEndDate: task.recurrenceEndDate,
      recurrenceIntervalDays: task.recurrenceIntervalDays ?? undefined,
      safetyCritical: task.safetyCritical,
      source: task.source,
      relatedCattleId: task.relatedCattleId ?? undefined,
      cattleIds: task.cattles.length
        ? task.cattles.map((c) => c.cattleId)
        : undefined,
      assignedToId: task.assignedToId ?? undefined,
      remindDaysBefore: task.remindDaysBefore ?? undefined,
      notifyRoleNames: task.notifyRoleNames,
      recipientUserIds: task.recipients.map((r) => r.userId),
    });
  }

  /**
   * Internal create API (RAKHAL-097): other modules call this to spin up tasks
   * (reproduction pregnancy-check, calving colostrum, health-plan doses, …). The
   * record is identical to a manual task and shows up in the Task Hub.
   */
  async createInternal(input: CreateTaskInternalInput): Promise<Task> {
    // RAKHAL-481: a HISTORICAL entry creates no reminder (hub §3.5). Callers
    // of this seam ignore the row, so a placeholder keeps the signature.
    if (eventApiContext()?.historical)
      return { id: 'historical-skipped' } as Task;
    await this.assertAssignee(input.farmId, input.assignedToId);
    return this.insert({
      farmId: input.farmId,
      createdBy: input.createdBy,
      name: input.name,
      details: input.details,
      category: input.category,
      priority: input.priority ?? TaskPriority.MEDIUM,
      dueAt: input.dueAt,
      recurring: false,
      recurrenceType: null,
      recurrenceEndDate: null,
      safetyCritical: input.safetyCritical ?? false,
      source: input.source,
      relatedCattleId: input.relatedCattleId,
      assignedToId: input.assignedToId,
      sourceEventType: input.sourceEventType,
      sourceEventId: input.sourceEventId,
      followUpKey: input.followUpKey,
      ruleKey: input.ruleKey,
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
    const closedStatuses: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.CANCELLED,
    ];
    const pending = tasks.filter((t) => !closedStatuses.includes(t.status));
    const alreadyCompleted = tasks.filter((t) =>
      closedStatuses.includes(t.status),
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
   * not an error. This is a *system* close, not the user-facing `cancel()` —
   * MILESTONE 17 deliberately modeled a superseded task as COMPLETED+note
   * rather than a distinct status, so a caller like return-to-heat records
   * *why* it closed instead of using `cancel()` (RAKHAL-405).
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
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
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

  /**
   * RAKHAL-399: close every non-completed task tied to a cattle row once
   * she's left the herd (sold/culled/deceased) — a disposed animal shouldn't
   * keep generating "pregnancy check due" / "vaccination due" reminders.
   * Mirrors {@link completeBySourceEvent}'s shape and the same reasoning:
   * this is a *system* close on COMPLETED+note (MILESTONE 17 convention),
   * not the user-facing `cancel()` (RAKHAL-405).
   */
  async completeForCattle(
    farmId: string,
    cattleId: string,
    userId: string,
    note: string,
  ): Promise<{ completedTaskIds: string[] }> {
    const tasks = await this.prisma.task.findMany({
      where: {
        farmId,
        relatedCattleId: cattleId,
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
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
            details: `${t.details ?? ''}\n${note}`.trim(),
          },
        }),
      ),
    );

    this.log.info('Tasks closed on animal disposition', {
      farmId,
      cattleId,
      completed: tasks.length,
    });

    return { completedTaskIds: tasks.map((t) => t.id) };
  }

  async update(farmId: string, userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.getOrThrow(farmId, id);
    if (dto.category === TaskCategory.REMINDER) {
      throw new BadRequestException(
        'category REMINDER is deprecated and cannot be set on update; kind is not changeable',
      );
    }
    await this.assertAssignee(farmId, dto.assignedToId);
    await this.assertMembers(farmId, dto.recipientUserIds);

    // RAKHAL-487: a new offset re-derives the due date from the linked event; an explicit dueAt
    // detaches the reminder from the event's date.
    let dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    let reminderOffsetDays: number | null | undefined;
    if (dto.offsetDays !== undefined) {
      if (
        existing.sourceEventType !== 'ANIMAL_EVENT' ||
        !existing.sourceEventId
      ) {
        throw new BadRequestException(
          'This reminder is not linked to an event',
        );
      }
      const ev = await this.prisma.animalEvent.findFirst({
        where: { id: existing.sourceEventId, farmId },
        select: { eventAt: true },
      });
      if (!ev) throw new NotFoundException('Source event not found');
      dueAt = new Date(ev.eventAt.getTime() + dto.offsetDays * 86_400_000);
      reminderOffsetDays = dto.offsetDays;
    } else if (dueAt && existing.reminderOffsetDays !== null) {
      reminderOffsetDays = null;
    }
    const recurring = dto.recurring ?? existing.recurring;
    if (existing.kind === TaskKind.REMINDER && recurring) {
      this.assertRepeat(
        {
          recurring,
          recurrenceType:
            dto.recurrenceType ?? existing.recurrenceType ?? undefined,
          recurrenceIntervalDays:
            dto.recurrenceIntervalDays ??
            existing.recurrenceIntervalDays ??
            undefined,
          recurrenceEndDate: dto.recurrenceEndDate,
        },
        dueAt ?? existing.dueAt,
      );
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        name: dto.name,
        details: dto.details,
        category: dto.category ? this.topic(dto.category) : undefined,
        priority: dto.priority,
        status: dto.status,
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(reminderOffsetDays !== undefined ? { reminderOffsetDays } : {}),
        assignedToId: dto.assignedToId,
        safetyCritical: dto.safetyCritical,
        remindDaysBefore: dto.remindDaysBefore,
        notifyRoleNames: dto.notifyRoleNames,
        recurring: dto.recurring,
        recurrenceType: dto.recurrenceType,
        recurrenceIntervalDays: dto.recurrenceIntervalDays,
        ...(dto.recurrenceEndDate
          ? { recurrenceEndDate: new Date(dto.recurrenceEndDate) }
          : {}),
        ...(dto.recipientUserIds
          ? {
              recipients: {
                deleteMany: {},
                create: [...new Set(dto.recipientUserIds)].map((userId) => ({
                  userId,
                })),
              },
            }
          : {}),
      },
      include: this.assigneeInclude(),
    });
    await this.recordAudit(id, TaskAuditAction.UPDATED, userId);

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

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedById: userId,
        completionPhotoUrl: dto.completionPhotoUrl,
        completionNote: dto.notes,
      },
      include: this.assigneeInclude(),
    });
    await this.recordAudit(
      id,
      TaskAuditAction.COMPLETED,
      userId,
      dto.notes ?? null,
    );

    const next = await this.maybeCreateNextRecurrence(existing, userId);

    this.log.info('Task completed', {
      taskId: id,
      farmId,
      nextRecurrenceCreated: Boolean(next),
    });
    const presented = await this.present(task);
    return {
      ...presented,
      nextRecurrenceCreated: Boolean(next),
      nextTaskId: next?.id ?? null,
    };
  }

  /**
   * Undo an accidental `complete()` (e.g. a farm owner mistouching the Task
   * Hub checkbox). Reverts status to PENDING and clears the completion
   * stamp; the task keeps its original `sourceEventType`/`sourceEventId`
   * link, so it reappears wherever it was sourced from (e.g. the
   * reproduction dashboard's pregnancy-check-due panel).
   */
  async reopen(farmId: string, userId: string, id: string) {
    const existing = await this.getOrThrow(farmId, id);
    if (existing.status !== TaskStatus.COMPLETED) {
      throw new BadRequestException('Task is not completed');
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.PENDING,
        completedAt: null,
        completedById: null,
        completionPhotoUrl: null,
      },
      include: this.assigneeInclude(),
    });
    await this.recordAudit(id, TaskAuditAction.REOPENED, userId);

    this.log.info('Task reopened', { taskId: id, farmId });
    return this.present(task);
  }

  /**
   * User-initiated cancellation (abandoning a task, distinct from completing
   * it). Not valid from COMPLETED — cancel a live task, don't rewrite a
   * finished one. Distinct from `completeBySourceEvent`/`completeForCattle`,
   * which close *system*-superseded tasks as COMPLETED+note (MILESTONE 17
   * convention) — this is the user-facing counterpart for a task nobody
   * else's event resolved.
   */
  async cancel(farmId: string, userId: string, id: string, dto: CancelTaskDto) {
    const existing = await this.getOrThrow(farmId, id);
    if (existing.status === TaskStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot cancel a task that is already completed',
      );
    }
    if (existing.status === TaskStatus.CANCELLED) {
      throw new BadRequestException('Task is already cancelled');
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: userId,
        completionNote: dto.notes,
      },
      include: this.assigneeInclude(),
    });
    await this.recordAudit(
      id,
      TaskAuditAction.CANCELLED,
      userId,
      dto.notes ?? null,
    );

    this.log.info('Task cancelled', { taskId: id, farmId });
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
    // `cattleId` and `search` each need their own `OR` — combined via `AND` so a plain object
    // spread never lets the second `OR` silently clobber the first when both filters are active.
    const andClauses: Prisma.TaskWhereInput[] = [];
    if (query.cattleId) {
      andClauses.push({
        OR: [
          { relatedCattleId: query.cattleId },
          { cattles: { some: { cattleId: query.cattleId } } },
        ],
      });
    }
    // In the AND list so it combines with (never clobbers) `filter=overdue|blocked`'s own status.
    if (query.status?.length) {
      andClauses.push({ status: { in: query.status } });
    }
    // In the AND list so the custom range intersects (never overwrites) `filter=upcoming|overdue`'s own `dueAt`.
    if (query.dueFrom || query.dueTo) {
      andClauses.push({
        dueAt: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lt: new Date(query.dueTo) } : {}),
        },
      });
    }
    if (query.search) {
      andClauses.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { reference: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.TaskWhereInput = {
      farmId,
      ...this.filterClause(query.filter, userId, now),
      ...(query.kind ? { kind: this.kindOf(query.kind) } : {}),
      ...(query.recurring !== undefined ? { recurring: query.recurring } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
    };

    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ dueAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.assigneeInclude(),
    });

    const page = toCursorPage(rows, query);
    // Counters are farm-wide, not page-wide: first page only, later pages omit them.
    const [highlights, reminderHighlights] = query.cursor
      ? [undefined, undefined]
      : await Promise.all([
          this.highlights(farmId, now),
          this.reminderHighlights(farmId, now),
        ]);

    const cattleIds = page.items
      .flatMap((task) => [
        task.relatedCattleId,
        ...(task.cattles ?? []).map((c) => c.cattleId),
      ])
      .filter((id): id is string => !!id);
    const actorIds = page.items
      .flatMap((task) => [
        task.createdBy,
        ...(task.history ?? []).map((h) => h.actorId),
      ])
      .filter((id): id is string => !!id);
    const [cattleMap, actorMap] = await Promise.all([
      this.buildCattleLabelMap(farmId, cattleIds),
      this.buildUserNameMap(actorIds),
    ]);
    const items = await Promise.all(
      page.items.map((task) => this.present(task, cattleMap, actorMap)),
    );

    return {
      items,
      meta: { ...page.meta, highlights, reminderHighlights },
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
        return {
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          dueAt: { lt: now },
        };
      case 'upcoming':
        // Exact complement of `overdue` among open items (dueAt is non-null): same `now`.
        return {
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          dueAt: { gte: now },
        };
      case 'blocked':
        return { status: TaskStatus.BLOCKED };
      default:
        return {};
    }
  }

  /** Deprecated category REMINDER is never stored: it maps to the general topic. */
  private topic(category?: TaskCategory): TaskCategory {
    return !category || category === TaskCategory.REMINDER
      ? TaskCategory.GENERAL
      : category;
  }

  private kindOf(kind: 'task' | 'reminder'): TaskKind {
    return kind === 'reminder' ? TaskKind.REMINDER : TaskKind.TASK;
  }

  /** Reminder counters (RAKHAL-491): open reminders only; `highlights` counts kind=TASK only. */
  private async reminderHighlights(farmId: string, now: Date) {
    const open = {
      farmId,
      kind: TaskKind.REMINDER,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
    };
    const [upcoming, overdue, repeating] = await Promise.all([
      this.prisma.task.count({ where: { ...open, dueAt: { gte: now } } }),
      this.prisma.task.count({ where: { ...open, dueAt: { lt: now } } }),
      this.prisma.task.count({ where: { ...open, recurring: true } }),
    ]);
    return { upcoming, overdue, repeating };
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
          kind: TaskKind.TASK,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          dueAt: { gte: dayStart, lt: dayEnd },
        },
      }),
      this.prisma.task.count({
        where: {
          farmId,
          kind: TaskKind.TASK,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
          dueAt: { lt: now },
        },
      }),
      this.prisma.task.count({
        where: { farmId, kind: TaskKind.TASK, status: TaskStatus.BLOCKED },
      }),
      this.prisma.task.findMany({
        where: {
          farmId,
          kind: TaskKind.TASK,
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
    kind?: TaskKind;
    priority: TaskPriority;
    scheduledAt?: Date;
    dueAt: Date;
    recurring: boolean;
    recurrenceType?: TaskRecurrence | null;
    recurrenceEndDate?: Date | null;
    safetyCritical: boolean;
    source: TaskSource;
    relatedCattleId?: string;
    /** Multi-cow target (user request, no ticket #) — creates one `TaskCattle` row per id after
     * the task itself is created. Empty/undefined for every existing single-cow caller. */
    cattleIds?: string[];
    assignedToId?: string;
    sourceEventType?: string;
    sourceEventId?: string;
    followUpKey?: string;
    ruleKey?: string;
    /** RAKHAL-487 (kind REMINDER). */
    remindDaysBefore?: number;
    notifyRoleNames?: string[];
    reminderOffsetDays?: number;
    recurrenceIntervalDays?: number;
    recipientUserIds?: string[];
  }): Promise<
    Task & { cattles: { cattleId: string }[]; recipients: { userId: string }[] }
  > {
    // Sequential per-farm reference with a small retry on the unique race.
    for (let attempt = 0; attempt < 5; attempt++) {
      // Highest numbered reference + 1, not a row count: a deleted task leaves a gap that a count
      // would re-issue, and a unique violation inside a caller's transaction aborts the whole of it.
      const [{ max }] = await this.prisma.$queryRaw<{ max: number | null }[]>`
        SELECT max(cast(substring(reference from 5) as int))::int AS max
        FROM "Task"
        WHERE "farmId" = ${data.farmId} AND reference ~ '^TSK-[0-9]+$'`;
      const reference = `TSK-${String((max ?? 0) + 1 + attempt).padStart(3, '0')}`;
      try {
        const task = await this.prisma.task.create({
          data: {
            farmId: data.farmId,
            reference,
            name: data.name,
            details: data.details,
            category: data.category,
            kind: data.kind ?? TaskKind.TASK,
            priority: data.priority,
            scheduledAt: data.scheduledAt,
            dueAt: data.dueAt,
            recurring: data.recurring,
            recurrenceType: data.recurrenceType ?? null,
            recurrenceEndDate: data.recurrenceEndDate ?? null,
            safetyCritical: data.safetyCritical,
            source: data.source,
            relatedCattleId: data.relatedCattleId,
            assignedToId: data.assignedToId,
            sourceEventType: data.sourceEventType,
            sourceEventId: data.sourceEventId,
            followUpKey: data.followUpKey,
            ruleKey: data.ruleKey,
            remindDaysBefore: data.remindDaysBefore,
            notifyRoleNames: data.notifyRoleNames ?? [],
            reminderOffsetDays: data.reminderOffsetDays,
            recurrenceIntervalDays: data.recurrenceIntervalDays,
            createdBy: data.createdBy,
          },
        });

        if (data.cattleIds?.length) {
          await this.prisma.taskCattle.createMany({
            data: data.cattleIds.map((cattleId) => ({
              taskId: task.id,
              cattleId,
            })),
          });
        }
        const recipientUserIds = [...new Set(data.recipientUserIds ?? [])];
        if (recipientUserIds.length) {
          await this.prisma.taskRecipient.createMany({
            data: recipientUserIds.map((userId) => ({
              taskId: task.id,
              userId,
            })),
          });
        }

        return {
          ...task,
          cattles: (data.cattleIds ?? []).map((cattleId) => ({ cattleId })),
          recipients: recipientUserIds.map((userId) => ({ userId })),
        };
      } catch (error) {
        // RAKHAL-484: a duplicate open follow-up is not a reference race; let the caller see it.
        if (data.followUpKey && JSON.stringify(error).includes('followUpKey'))
          throw error;
        if (this.isUniqueError(error)) continue;
        throw error;
      }
    }
    throw new BadRequestException('Could not allocate a task reference');
  }

  private async maybeCreateNextRecurrence(
    task: TaskWithAssignee,
    userId: string,
  ): Promise<Task | null> {
    if (!task.recurring || !task.recurrenceType) return null;
    // RAKHAL-487: a repeating reminder spawns when it fires (the sweep); completing it must not spawn again.
    if (task.kind === TaskKind.REMINDER) {
      return this.spawnNextReminder(task.id);
    }

    const nextDue = this.addInterval(
      task.dueAt,
      task.recurrenceType,
      task.recurrenceIntervalDays,
    );
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
      recurring: true,
      recurrenceType: task.recurrenceType,
      recurrenceEndDate: task.recurrenceEndDate,
      safetyCritical: task.safetyCritical,
      source: task.source,
      relatedCattleId: task.relatedCattleId ?? undefined,
      cattleIds: task.cattles.length
        ? task.cattles.map((c) => c.cattleId)
        : undefined,
      assignedToId: task.assignedToId ?? undefined,
    });
  }

  private addInterval(
    date: Date,
    type: TaskRecurrence,
    intervalDays?: number | null,
  ): Date {
    const next = new Date(date);
    if (type === TaskRecurrence.EVERY_N_DAYS) {
      next.setDate(next.getDate() + Math.max(1, intervalDays ?? 1));
    } else if (type === TaskRecurrence.DAILY) next.setDate(next.getDate() + 1);
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

  /** Standard `include` for every read/write path that returns a task through `present()`.
   * `history` is ordered oldest-first so `present()` can append it straight after the synthesized
   * CREATED entry with no re-sort. */
  private assigneeInclude() {
    return {
      assignedTo: { select: { id: true, name: true } },
      cattles: { select: { cattleId: true } },
      recipients: { select: { userId: true } },
      history: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          actorId: true,
          note: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.TaskInclude;
  }

  /** One row per lifecycle transition (activity/history section, user request, no ticket #).
   * CREATED is never written here — synthesized in `present()` from `createdBy`/`createdAt`,
   * which the `Task` row already carries. Fire-and-forget relative to the caller's own write: a
   * missing row here would only shorten the history list, never corrupt task state. */
  private async recordAudit(
    taskId: string,
    action: TaskAuditAction,
    actorId: string,
    note?: string | null,
  ) {
    await this.prisma.taskAuditLog.create({
      data: { taskId, action, actorId, note: note ?? null },
    });
  }

  /** Cow-name display (user request, no ticket #) — `relatedCattleId`/`TaskCattle.cattleId` are
   * plain scalars (see `task.prisma`'s own doc comment on why), so the tag/name has to be joined
   * here rather than via a Prisma `include`. `cattleMap` lets `findAll` batch one query for the
   * whole page instead of N+1; single-item paths (create/update/complete/...) build their own
   * 1-2-id map inline. A cow missing from the map (deleted, or map omitted) is simply left out of
   * `relatedCattle`/`cattleTags` — `cattleIds` still round-trips for the edit form regardless.
   * `actorMap` does the same batching for the activity/history section's actor names. */
  private async present(
    task: Task & {
      assignedTo?: { id: string; name: string } | null;
      cattles?: { cattleId: string }[];
      recipients?: { userId: string }[];
      history?: {
        id: string;
        action: TaskAuditAction;
        actorId: string | null;
        note: string | null;
        createdAt: Date;
      }[];
    },
    cattleMap?: Map<string, { tagNumber: string; name: string | null }>,
    actorMap?: Map<string, string>,
  ) {
    const now = new Date();
    const display = displayStatus(task.status, task.dueAt, now);
    const { cattles, recipients, history: historyRows, ...rest } = task;
    const cattleIds = [
      task.relatedCattleId,
      ...(cattles ?? []).map((c) => c.cattleId),
    ].filter((id): id is string => !!id);
    const cMap =
      cattleMap ?? (await this.buildCattleLabelMap(task.farmId, cattleIds));
    const relatedCattle =
      task.relatedCattleId && cMap.has(task.relatedCattleId)
        ? { id: task.relatedCattleId, ...cMap.get(task.relatedCattleId)! }
        : null;
    const cattleTags = (cattles ?? [])
      .filter((c) => cMap.has(c.cattleId))
      .map((c) => ({ id: c.cattleId, ...cMap.get(c.cattleId)! }));

    const actorIds = [
      task.createdBy,
      ...(historyRows ?? []).map((h) => h.actorId),
    ].filter((id): id is string => !!id);
    const aMap = actorMap ?? (await this.buildUserNameMap(actorIds));
    const history = [
      {
        id: 'created',
        action: 'CREATED' as const,
        actorId: task.createdBy,
        actorName: aMap.get(task.createdBy) ?? null,
        note: null as string | null,
        createdAt: task.createdAt,
      },
      ...(historyRows ?? []).map((h) => ({
        id: h.id,
        action: h.action,
        actorId: h.actorId,
        actorName: h.actorId ? (aMap.get(h.actorId) ?? null) : null,
        note: h.note,
        createdAt: h.createdAt,
      })),
    ];

    return {
      ...rest,
      cattleIds: (cattles ?? []).map((c) => c.cattleId),
      recipientUserIds: (recipients ?? []).map((r) => r.userId),
      relatedCattle,
      cattleTags,
      history,
      displayStatus: display,
      overdueByHours:
        display === 'overdue'
          ? Math.floor((now.getTime() - task.dueAt.getTime()) / 3_600_000)
          : null,
    };
  }

  private async buildCattleLabelMap(farmId: string, ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (!unique.length) {
      return new Map<string, { tagNumber: string; name: string | null }>();
    }
    const rows = await this.prisma.cattle.findMany({
      where: { id: { in: unique }, farmId },
      select: { id: true, tagNumber: true, name: true },
    });
    return new Map(
      rows.map((r) => [r.id, { tagNumber: r.tagNumber, name: r.name }]),
    );
  }

  /** No `farmId` filter — mirrors `assignedTo`'s own `include` (a user's farm membership is
   * validated at write time, not re-checked on every read). */
  private async buildUserNameMap(ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Validates every id belongs to this farm's active herd (RAKHAL-398's `activeHerd` convention
   * would apply here too, but Task doesn't import the Cattle module's domain layer — mirrors
   * `assertAssignee`'s own simple existence-check style instead). */
  private async assertCattleIds(farmId: string, cattleIds: string[]) {
    const unique = Array.from(new Set(cattleIds));
    const found = await this.prisma.cattle.findMany({
      where: {
        id: { in: unique },
        farmId,
        deletedAt: null,
        herdStatus: 'ACTIVE',
      },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException(
        'One or more selected cows are not in this farm’s active herd',
      );
    }
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
