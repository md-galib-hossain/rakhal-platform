import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattleDispositionType,
  ClinicalProgress,
  ExpenseCategory,
  HealthActionType,
  HealthCareType,
  HealthCaseStatus,
  HealthCloseOutcome,
  HealthCondition,
  HealthPlan,
  HealthPlanCategory,
  HealthPlanStep,
  HealthPriority,
  HealthTaskStatus,
  PlanEnrollmentStatus,
  Prisma,
  SafetyWithdrawalStatus,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { DEFAULT_FARM_TIMEZONE } from 'src/common/farm-time/farm-time';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { farmDayEnd } from '../../domain/health-farm-day';
import { applyTimeOfDay } from '../../domain/protocol-time';
import { ProtocolStockService } from './protocol-stock.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { HealthOutcomesService } from './health-outcomes.service';
import { CattleService } from 'src/modules/cattle/application/services/cattle.service';
import { ExpenseService } from 'src/modules/purchasing/application/expense.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import {
  ApplyHealthPlanDto,
  CloseHealthCaseDto,
  CreateHealthUpdateDto,
  LogTaskTreatmentDto,
  LogTreatmentDto,
  MortalityDto,
  RecordTreatmentDto,
  RescheduleHealthTaskDto,
  SkipHealthTaskDto,
} from '../../presentation/dto/case-actions.dto';
import { CreateHealthCaseDto } from '../../presentation/dto/create-health-case.dto';
import { BulkCreateHealthCasesDto } from '../../presentation/dto/bulk-create-health-cases.dto';
import {
  AppliedPlansQueryDto,
  HealthPlanQueryDto,
  HealthTaskCalendarQueryDto,
  HealthTaskQueryDto,
  PlanRunsQueryDto,
  SafetyWithdrawalQueryDto,
  SickBayQueryDto,
  TreatmentLogsQueryDto,
} from '../../presentation/dto/health-query.dto';
import {
  ApplyPlanToAnimalsDto,
  CreateHealthPlanDto,
  UpdateHealthPlanDto,
} from '../../presentation/dto/health-plan.dto';
import { UpdateHealthCaseDto } from '../../presentation/dto/update-health-case.dto';
import { StopCattleProtocolDto } from '../../presentation/dto/stop-protocol.dto';

const ACTIVE_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/** RAKHAL-418: only `TREATMENT` plans are curative — every other category (PREVENTION/BREEDING/
 * VACCINATION/DEWORMING/ROUTINE) is preventive care. Replaces the old 8-value
 * `PLAN_CATEGORY_TO_DIAGNOSIS_TYPE` map (`isPreventiveDiagnosisType` did the same yes/no reduction
 * one step later); a plain equality check is now the whole routing decision. */
function careTypeForPlanCategory(category: HealthPlanCategory): HealthCareType {
  return category === HealthPlanCategory.TREATMENT
    ? HealthCareType.CURATIVE
    : HealthCareType.PREVENTIVE;
}

/**
 * Healthcare service (PRD §13). Farm-scoped: `farmId` is supplied by the
 * controller from the verified token context (`FarmContextGuard`), so every
 * query is scoped to it and no cross-tenant access is possible. Domain events
 * feed the live AQR/Activity engines: reporting sickness emits −10, recovery
 * +5, and mortality nullifies the score (PRD §19.2).
 */
import { eventApiContext } from 'src/modules/animal-events/application/event-api-context';

@Injectable()
export class HealthService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aqrService: AqrService,
    private readonly activityLog: ActivityLogService,
    private readonly medicineService: MedicineService,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService,
    private readonly cattleService: CattleService,
    private readonly expenseService: ExpenseService,
    private readonly logger: LoggerService,
    // RAKHAL-467 — last, so positional `new HealthService(...)` callers keep their order.
    private readonly outcomes: HealthOutcomesService,
    // Protocols v2 — optional + last so positional `new HealthService(...)` callers keep working.
    @Optional() private readonly protocolStock?: ProtocolStockService,
    @Optional() private readonly farmClock?: FarmClockService,
  ) {
    this.log = this.logger.setContext(HealthService.name);
  }

  /** Protocols v2 undo: stamp the log id on the stock movements its dose drew, so a void can reverse them batch-exactly. */
  private async stampMovements(
    tx: Prisma.TransactionClient,
    movementIds: string[] | undefined,
    treatmentLogId: string,
  ) {
    if (!movementIds || movementIds.length === 0) return;
    await tx.medicineStockMovement.updateMany({
      where: { id: { in: movementIds } },
      data: { treatmentLogId },
    });
  }

  /** Protocols v2: resolves a step's due instant — the day offset plus its optional farm-local "HH:mm". */
  private async dueResolver(farmId: string) {
    const tz = (await this.farmClock?.timezone(farmId)) ?? 'UTC';
    return (base: Date, step: { timeOfDay?: string | null }) =>
      applyTimeOfDay(base, step.timeOfDay, tz);
  }

  async getHealthDashboard(farmId: string) {
    const now = new Date();

    const [
      totalAnimalCount,
      sickBayCount,
      safetyWithdrawalCount,
      upcomingTasksCount,
      overdueTasksCount,
      diseaseRows,
      shedRows,
      trendRows,
      medicineExpense,
    ] = await Promise.all([
      this.prisma.cattle.count({
        where: activeHerd(farmId),
      }),
      this.prisma.healthCase.count({
        where: {
          farmId,
          status: { in: ACTIVE_CASE_STATUSES },
          deletedAt: null,
        },
      }),
      this.prisma.safetyWithdrawal.count({
        where: { farmId, status: SafetyWithdrawalStatus.ACTIVE },
      }),
      this.prisma.healthTask.count({
        where: {
          farmId,
          deletedAt: null,
          status: HealthTaskStatus.PENDING,
          dueDateTime: { gte: now },
        },
      }),
      this.prisma.healthTask.count({
        where: {
          farmId,
          deletedAt: null,
          status: { in: [HealthTaskStatus.PENDING, HealthTaskStatus.OVERDUE] },
          dueDateTime: { lt: now },
        },
      }),
      // RAKHAL-418: `note` is optional free text now (a poor groupBy key — mostly null or
      // one-row-per-string); `condition` is the real structured bucket this breakdown wants.
      // Response field stays named `diagnosis` (zero frontend blast radius — `types.ts`'s
      // `diseaseBreakdown: { diagnosis, count }[]` is unchanged), only its source improves.
      this.prisma.healthCase.groupBy({
        by: ['condition'],
        where: {
          farmId,
          deletedAt: null,
          condition: { not: null },
        },
        _count: { condition: true },
      }),
      this.prisma.healthCase.groupBy({
        by: ['shedName'],
        where: {
          farmId,
          deletedAt: null,
        },
        _count: { shedName: true },
      }),
      this.prisma.healthCase.findMany({
        where: {
          farmId,
          deletedAt: null,
        },
        select: { startDate: true },
        orderBy: { startDate: 'asc' },
      }),
      this.sumHealthExpense(farmId),
    ]);

    const healthyAnimalCount = Math.max(totalAnimalCount - sickBayCount, 0);

    return {
      herdHealthScore: this.calculateHerdHealthScore(
        healthyAnimalCount,
        totalAnimalCount,
      ),
      healthyAnimalCount,
      totalAnimalCount,
      sickBayCount,
      medicineExpense,
      safetyWithdrawalCount,
      morbidityTrend: this.groupByDay(trendRows.map((row) => row.startDate)),
      diseaseBreakdown: diseaseRows.map((row) => ({
        diagnosis: this.describeCondition(row.condition!),
        count: row._count.condition,
      })),
      shedWiseHealth: shedRows.map((row) => ({
        shedName: row.shedName ?? 'Unassigned',
        count: row._count.shedName,
      })),
      upcomingTasksCount,
      overdueTasksCount,
    };
  }

  async getSickBay(farmId: string, query: SickBayQueryDto) {
    // RAKHAL-418: `diagnosis` now needs its own `OR` (note contains, or condition label matches)
    // alongside `search`'s existing `OR` — two `where.OR` keys on one object would silently
    // clobber each other, so both live as `AND`-ed `OR` groups instead.
    const andClauses: Prisma.HealthCaseWhereInput[] = [];
    if (query.search) {
      andClauses.push({
        OR: [
          { note: { contains: query.search, mode: 'insensitive' } },
          { caseCode: { contains: query.search, mode: 'insensitive' } },
          {
            cattle: {
              tagNumber: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            cattle: {
              name: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      });
    }
    if (query.diagnosis) {
      const matchingConditions = this.matchConditionLabels(query.diagnosis);
      andClauses.push({
        OR: [
          { note: { contains: query.diagnosis, mode: 'insensitive' } },
          ...(matchingConditions.length
            ? [{ condition: { in: matchingConditions } }]
            : []),
        ],
      });
    }

    const where: Prisma.HealthCaseWhereInput = {
      farmId,
      deletedAt: null,
      status: query.status ?? { in: ACTIVE_CASE_STATUSES },
      ...(query.shed
        ? { shedName: { contains: query.shed, mode: 'insensitive' } }
        : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
    };

    const rows = await this.prisma.healthCase.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        cattle: {
          select: { id: true, name: true, tagNumber: true, image: true },
        },
        healthPlan: { select: { id: true, name: true } },
        tasks: {
          where: { status: HealthTaskStatus.PENDING },
          orderBy: { dueDateTime: 'asc' },
          take: 1,
        },
        // RAKHAL-470: the milk/meat hold still running on this case, so a row can show "3 days left" without the
        // client fetching (and capping) a separate withdrawals list.
        safetyWithdrawals: {
          where: {
            status: {
              in: [
                SafetyWithdrawalStatus.ACTIVE,
                SafetyWithdrawalStatus.READY_FOR_RELEASE,
              ],
            },
          },
          select: { milkWithdrawalUntil: true, meatWithdrawalUntil: true },
        },
      },
    });

    const projected = rows.map(({ safetyWithdrawals, ...row }) => {
      const days = safetyWithdrawals
        .flatMap((w) => [
          this.daysRemaining(w.milkWithdrawalUntil),
          this.daysRemaining(w.meatWithdrawalUntil),
        ])
        .filter((d): d is number => d !== null);
      return {
        ...row,
        /** Days until the animal's milk and meat are both safe again (the longer of the two); `null` = no hold. */
        withdrawalDaysLeft: days.length ? Math.max(...days) : null,
      };
    });
    return toCursorPage(projected, query);
  }

  async getTreatmentLogs(farmId: string, query: TreatmentLogsQueryDto) {
    const andClauses: Prisma.TreatmentLogWhereInput[] = [];

    if (query.search) {
      andClauses.push({
        OR: [
          { medicineName: { contains: query.search, mode: 'insensitive' } },
          { notes: { contains: query.search, mode: 'insensitive' } },
          {
            cattle: {
              tagNumber: { contains: query.search, mode: 'insensitive' },
            },
          },
          {
            cattle: {
              name: { contains: query.search, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    if (query.fromDate || query.toDate) {
      andClauses.push({
        administeredAt: {
          ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
          ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
        },
      });
    }

    if (query.careType) {
      andClauses.push({
        healthCase: {
          careType: query.careType,
        },
      });
    }

    if (query.route) {
      andClauses.push({
        route: query.route,
      });
    }

    const where: Prisma.TreatmentLogWhereInput = {
      farmId,
      voidedAt: null,
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
    };

    const rows = await this.prisma.treatmentLog.findMany({
      where,
      orderBy: [
        { administeredAt: query.sortOrder ?? 'desc' },
        { id: query.sortOrder ?? 'desc' },
      ],
      ...getCursorArgs(query),
      include: {
        cattle: {
          select: { id: true, name: true, tagNumber: true, image: true },
        },
        healthCase: {
          select: {
            id: true,
            caseCode: true,
            careType: true,
            condition: true,
            note: true,
          },
        },
      },
    });

    return toCursorPage(rows, query);
  }

  async createHealthCase(
    farmId: string,
    userId: string,
    dto: CreateHealthCaseDto,
  ) {
    const cattle = await this.assertCattleInFarm(farmId, dto.cattleId);
    if (dto.shedId) await this.assertShedInFarm(farmId, dto.shedId);

    // RAKHAL-418: `note` is now optional, so the old `equals: dto.diagnosis` filter (always
    // present) can't drive the duplicate check unconditionally — matching on an absent field would
    // match every active case for the animal, not the one with the same complaint. Prefer the
    // structured `condition` when given (it's the more reliable identity for "same ailment");
    // fall back to `note` text; skip the check entirely when neither is provided.
    if (dto.condition || dto.note) {
      const duplicate = await this.prisma.healthCase.findFirst({
        where: {
          farmId,
          cattleId: dto.cattleId,
          status: { in: ACTIVE_CASE_STATUSES },
          ...(dto.condition
            ? { condition: dto.condition }
            : { note: { equals: dto.note, mode: 'insensitive' } }),
        },
      });
      // RAKHAL-481: through the event API this is the finding OPEN_CASE_EXISTS, not a 409.
      if (duplicate && !eventApiContext()) {
        throw new ConflictException(
          'Active health case already exists for this diagnosis',
        );
      }
    }

    const healthCase = await this.createCaseWithCode(farmId, (caseCode) => ({
      data: {
        farmId,
        cattleId: dto.cattleId,
        caseCode,
        note: dto.note,
        condition: dto.condition,
        careType: dto.careType,
        priority: dto.priority,
        shedId: dto.shedId ?? cattle.shedId,
        shedName: dto.shedName,
        reportedBy: dto.reportedBy ?? userId,
        assignedVet: dto.assignedVet,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        expectedRecoveryDate: dto.expectedRecoveryDate
          ? new Date(dto.expectedRecoveryDate)
          : undefined,
        symptoms: dto.symptoms ?? [],
        notes: dto.notes,
        photoUrl: dto.photoUrl,
      },
      include: this.caseInclude(),
    }));

    // Initial vitals (PRD §8.7): land temperature/appetite/observation on the
    // case timeline without moving the case off ACTIVE (so it reads as "Sick").
    if (
      dto.temperature !== undefined ||
      dto.appetite !== undefined ||
      dto.staffObservation
    ) {
      await this.prisma.healthUpdate.create({
        data: {
          farmId,
          cattleId: dto.cattleId,
          healthCaseId: healthCase.id,
          clinicalProgress: ClinicalProgress.STABLE,
          symptoms: dto.symptoms ?? [],
          temperature: dto.temperature,
          appetite: dto.appetite,
          observation: dto.staffObservation,
          recordedBy: userId,
          recordedAt: new Date(),
        },
      });
    }

    // RAKHAL-418: `dto.note` is now optional — every message below that used to quote it verbatim
    // falls back to a condition label or a generic phrase via `caseDescription()`.
    const description = this.caseDescription(dto);

    if (dto.careType === HealthCareType.CURATIVE) {
      // AQR: Animal Sickness Reported (−10) + immutable Activity Log entry.
      await this.aqrService.applyEvent(
        farmId,
        dto.cattleId,
        'sickness_reported',
        {
          actorId: userId,
          actionDetails: `Sickness reported for [${cattle.tagNumber}] — ${description}.`,
        },
      );

      // Notify Owner + Manager (PRD §8.7 / §20.2 `animal_sickness_reported`). Two
      // distinct artefacts: an **actionable Task** to review, and a **push alert**
      // via the notification engine (RAKHAL-098) — in-app now, SMS once a provider
      // lands (the delivery seam is wired).
      await this.taskService.createInternal({
        farmId,
        createdBy: userId,
        name: `Review reported sickness — ${cattle.tagNumber}`,
        details: `Sickness reported for [${cattle.name ?? cattle.tagNumber}] (${cattle.tagNumber}) — ${description}. Priority: ${dto.priority}.`,
        category: TaskCategory.HEALTHCARE,
        priority: this.toTaskPriority(dto.priority),
        dueAt: new Date(),
        source: TaskSource.SYSTEM_AUTO,
        relatedCattleId: dto.cattleId,
      });
      await this.notificationService.notifyOwnersAndManagers({
        farmId,
        eventKey: 'animal_sickness_reported',
        title: 'Animal Sickness Reported',
        message: `${cattle.name ?? cattle.tagNumber} (${cattle.tagNumber}) — ${description} reported (priority: ${dto.priority}).`,
        params: {
          name: cattle.name ?? cattle.tagNumber,
          tagNumber: cattle.tagNumber,
          diagnosis: description,
          priority: dto.priority,
        },
        link: `/healthcare/cases/${healthCase.id}`,
      });
    } else {
      // Preventive care (vaccine/deworming/routine checkup/etc.) is not
      // sickness — no sickness AQR penalty, no "review sickness" task, no
      // owner/manager sickness alert. Zero-impact AQR event keeps an Activity
      // Log trail without penalizing the score.
      await this.aqrService.applyEvent(
        farmId,
        dto.cattleId,
        'preventive_care_logged',
        {
          actorId: userId,
          actionDetails: `Preventive care logged for [${cattle.tagNumber}] — ${description}.`,
        },
      );
    }

    this.log.info('Health case created', {
      healthCaseId: healthCase.id,
      farmId,
      cattleId: dto.cattleId,
    });
    return healthCase;
  }

  /**
   * RAKHAL-469 (MILESTONE 29) — report one condition for several animals in a single call (an outbreak).
   *
   *  - **All-or-nothing validation:** any id that is not an active animal of this farm fails the whole call (404 naming
   *    them) with nothing written — same stance as `applyPlanToAnimals`.
   *  - **Duplicates are skipped, not errors:** an animal that already has an open case for the same condition (or the
   *    same note, when no condition is given) is reported as `skipped`, because in a group report one such animal must
   *    not block the other 29. Same rule as the single-case duplicate check.
   *  - **One transaction** creates every new case (codes minted from the tx so none repeats).
   *  - **Follow-up work happens after the commit and is grouped:** each animal gets its own AQR event (the sickness
   *    penalty is per animal) but the farm gets ONE review task and ONE Owner/Manager alert for the whole outbreak,
   *    not thirty.
   */
  async createHealthCasesBulk(
    farmId: string,
    userId: string,
    dto: BulkCreateHealthCasesDto,
  ) {
    if (!dto.condition && !dto.note?.trim()) {
      throw new BadRequestException(
        'Give a condition or a note, so the cases can be told apart from duplicates',
      );
    }
    const cattleIds = [...new Set(dto.cattleIds)];
    const careType = dto.careType ?? HealthCareType.CURATIVE;

    const cattleRows = await this.prisma.cattle.findMany({
      where: { id: { in: cattleIds }, farmId, deletedAt: null },
      select: { id: true, tagNumber: true, name: true, shedId: true },
    });
    const byId = new Map(cattleRows.map((c) => [c.id, c]));
    const missing = cattleIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Cattle not found in this farm: ${missing.join(', ')}`,
      );
    }

    const open = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        cattleId: { in: cattleIds },
        status: { in: ACTIVE_CASE_STATUSES },
        ...(dto.condition
          ? { condition: dto.condition }
          : { note: { equals: dto.note, mode: 'insensitive' } }),
      },
      select: { cattleId: true },
    });
    const alreadyOpen = new Set(open.map((c) => c.cattleId));
    const toCreate = cattleIds.filter((id) => !alreadyOpen.has(id));

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const created = new Map<
      string,
      { healthCaseId: string; caseCode: string }
    >();
    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const cattleId of toCreate) {
          const caseCode = await this.nextCaseCode(farmId, tx);
          const healthCase = await tx.healthCase.create({
            data: {
              farmId,
              cattleId,
              caseCode,
              note: dto.note,
              condition: dto.condition,
              careType,
              priority: dto.priority,
              shedId: byId.get(cattleId)!.shedId,
              reportedBy: userId,
              assignedVet: dto.assignedVet,
              startDate,
              expectedRecoveryDate: dto.expectedRecoveryDate
                ? new Date(dto.expectedRecoveryDate)
                : undefined,
              symptoms: dto.symptoms ?? [],
              notes: dto.notes,
            },
            select: { id: true, caseCode: true },
          });
          created.set(cattleId, {
            healthCaseId: healthCase.id,
            caseCode: healthCase.caseCode,
          });
        }
      });
    }

    if (toCreate.length > 0) {
      const description = this.caseDescription(dto);
      const curative = careType === HealthCareType.CURATIVE;
      for (const cattleId of toCreate) {
        const tag = byId.get(cattleId)!.tagNumber;
        await this.aqrService.applyEvent(
          farmId,
          cattleId,
          curative ? 'sickness_reported' : 'preventive_care_logged',
          {
            actorId: userId,
            actionDetails: curative
              ? `Sickness reported for [${tag}] — ${description} (group report of ${toCreate.length}).`
              : `Preventive care logged for [${tag}] — ${description} (group report of ${toCreate.length}).`,
          },
        );
      }

      if (curative) {
        const tags = toCreate.map((id) => byId.get(id)!.tagNumber);
        const shown = tags.slice(0, 5).join(', ');
        const summary = `${toCreate.length} animal${toCreate.length === 1 ? '' : 's'}`;
        await this.taskService.createInternal({
          farmId,
          createdBy: userId,
          name: `Review reported sickness — ${summary}`,
          details: `Sickness reported for ${summary} (${shown}${tags.length > 5 ? ', …' : ''}) — ${description}. Priority: ${dto.priority}.`,
          category: TaskCategory.HEALTHCARE,
          priority: this.toTaskPriority(dto.priority),
          dueAt: new Date(),
          source: TaskSource.SYSTEM_AUTO,
        });
        await this.notificationService.notifyOwnersAndManagers({
          farmId,
          eventKey: 'animal_sickness_reported',
          title: 'Animal Sickness Reported',
          message: `${summary} (${shown}${tags.length > 5 ? ', …' : ''}) — ${description} reported (priority: ${dto.priority}).`,
          params: {
            name: summary,
            tagNumber: shown,
            diagnosis: description,
            priority: dto.priority,
          },
          link: '/healthcare',
        });
      }
    }

    this.log.info('Health cases bulk-reported', {
      farmId,
      requested: cattleIds.length,
      createdCount: created.size,
      skippedCount: alreadyOpen.size,
    });

    return {
      createdCount: created.size,
      skippedCount: alreadyOpen.size,
      results: cattleIds.map((cattleId) => {
        const made = created.get(cattleId);
        return made
          ? { cattleId, status: 'created' as const, ...made }
          : {
              cattleId,
              status: 'skipped' as const,
              reason: 'Animal already has an open case for this condition',
            };
      }),
    };
  }

  /** Map a case priority to a Task Hub priority (PRD §8.7 notification). */
  private toTaskPriority(priority: HealthPriority): TaskPriority {
    switch (priority) {
      case HealthPriority.CRITICAL:
      case HealthPriority.HIGH:
        return TaskPriority.HIGH;
      case HealthPriority.MEDIUM:
        return TaskPriority.MEDIUM;
      case HealthPriority.LOW:
        return TaskPriority.LOW;
    }
  }

  /** RAKHAL-418: `condition` has no backend label map (labels are an i18n/frontend concern) — this
   * derives a readable form from the enum key itself ("MILK_FEVER" -> "Milk Fever") for the two
   * places that need one server-side: the sick-bay `diagnosis` search filter and the dashboard's
   * disease-breakdown labels. */
  private describeCondition(condition: HealthCondition): string {
    return condition
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /** `HealthCondition` values whose readable label contains `search` (case-insensitive) — backs
   * `GET /health/sick-bay?diagnosis=`'s "filters ... the condition label" requirement. */
  private matchConditionLabels(search: string): HealthCondition[] {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return Object.values(HealthCondition).filter((condition) =>
      this.describeCondition(condition).toLowerCase().includes(needle),
    );
  }

  /** RAKHAL-418: `note` is now optional free text — messages/AQR trails that used to quote the
   * required `diagnosis` verbatim need a fallback when a case is reported with only a structured
   * `condition` (or, in principle, neither). */
  private caseDescription(dto: {
    note?: string;
    condition?: HealthCondition;
  }): string {
    if (dto.note?.trim()) return dto.note.trim();
    if (dto.condition) return this.describeCondition(dto.condition);
    return 'health issue';
  }

  /**
   * Create a HealthCase with a collision-safe per-farm `caseCode`. The code is
   * derived from the current max suffix (+1); a unique-violation (concurrent
   * insert or a non-contiguous sequence) retries with a freshly computed code.
   */
  private async createCaseWithCode<T extends Prisma.HealthCaseCreateArgs>(
    farmId: string,
    build: (caseCode: string) => T,
  ): Promise<Prisma.HealthCaseGetPayload<T>> {
    for (let attempt = 0; ; attempt += 1) {
      const caseCode = await this.nextCaseCode(farmId);
      try {
        return (await this.prisma.healthCase.create(
          build(caseCode),
        )) as Prisma.HealthCaseGetPayload<T>;
      } catch (error) {
        const isUnique = (error as { code?: string }).code === 'P2002';
        if (isUnique && attempt < 4) continue;
        throw error;
      }
    }
  }

  /**
   * Next per-farm `HC-XXXXX` code from the current max suffix (PRD §13).
   * Ordering by `caseCode desc` (string sort) breaks once any row uses a
   * differently-shaped code — e.g. seed data's `HC-SEED-05` sorts ahead of
   * `HC-00008` alphabetically ('S' > '0'), so the old single-row lookup kept
   * re-deriving `HC-00006` and colliding (P2002) on every attempt, forever.
   * Only consider codes matching the real `HC-<digits>` shape when computing
   * the max suffix.
   */
  private async nextCaseCode(
    farmId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    // Deliberately includes archived cases — a code must never be reused even
    // after its case is closed/archived. Takes an optional tx client so a
    // multi-case bulk create (RAKHAL-414's `applyPlanToAnimals`) sees its own
    // just-created rows and never mints the same code twice within one call.
    const rows = await client.healthCase.findMany({
      where: { farmId, caseCode: { startsWith: 'HC-' } },
      select: { caseCode: true },
    });
    const n = rows.reduce((max, row) => {
      const match = /^HC-(\d+)$/.exec(row.caseCode);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `HC-${String(n + 1).padStart(5, '0')}`;
  }

  async getHealthCase(farmId: string, id: string) {
    // Deliberately includes archived cases — a closed/recovered case must
    // stay viewable as history.
    const healthCase = await this.prisma.healthCase.findFirst({
      where: { id, farmId },
      include: {
        ...this.caseInclude(),
        treatmentLogs: {
          where: { voidedAt: null },
          orderBy: { administeredAt: 'desc' },
        },
        healthUpdates: { orderBy: { recordedAt: 'desc' } },
        tasks: { orderBy: { dueDateTime: 'asc' } },
        mortalityRecord: true,
        safetyWithdrawals: { where: { status: SafetyWithdrawalStatus.ACTIVE } },
      },
    });
    if (!healthCase) throw new NotFoundException('Health case not found');
    return {
      ...healthCase,
      // RAKHAL-467: the case's result — days, steps, protocol, treatments, cost, outcome, recurrence.
      summary: await this.outcomes.caseSummary(farmId, healthCase),
      nextDose:
        healthCase.tasks.find(
          (task) => task.status === HealthTaskStatus.PENDING,
        ) ?? null,
      lastDose: healthCase.treatmentLogs[0] ?? null,
      activeSafetyWithdrawal: healthCase.safetyWithdrawals[0] ?? null,
    };
  }

  async updateHealthCase(farmId: string, id: string, dto: UpdateHealthCaseDto) {
    await this.getCaseOrThrow(farmId, id);
    const updated = await this.prisma.healthCase.update({
      where: { id },
      data: {
        note: dto.note,
        condition: dto.condition,
        careType: dto.careType,
        priority: dto.priority,
        status: dto.status,
        assignedVet: dto.assignedVet,
        expectedRecoveryDate: dto.expectedRecoveryDate
          ? new Date(dto.expectedRecoveryDate)
          : undefined,
        symptoms: dto.symptoms,
        notes: dto.notes,
      },
      include: this.caseInclude(),
    });
    this.log.info('Health case updated', { healthCaseId: id, farmId });
    return updated;
  }

  async applyHealthPlanToCase(
    farmId: string,
    id: string,
    dto: ApplyHealthPlanDto,
  ) {
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id: dto.healthPlanId, farmId, deletedAt: null },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Health plan not found');
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    await this.protocolStock?.assertInStock(farmId, plan.steps, 1);
    const dueOf = await this.dueResolver(farmId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.healthTask.deleteMany({
        where: { healthCaseId: id, status: HealthTaskStatus.PENDING },
      });
      const tasks = await Promise.all(
        plan.steps.map((step, index) => {
          const dueDateTime = dueOf(
            this.addDays(startDate, Math.max(0, step.dayNumber - 1)),
            step,
          );
          return tx.healthTask.create({
            data: {
              farmId: healthCase.farmId,
              cattleId: healthCase.cattleId,
              healthCaseId: id,
              healthPlanId: plan.id,
              taskCode: `${healthCase.caseCode}-T${String(index + 1).padStart(2, '0')}`,
              taskDate: dueDateTime,
              dueDateTime,
              taskType: step.actionType,
              title: step.title,
              instruction: step.instruction,
              stepNumber: index + 1,
              totalSteps: plan.steps.length,
              medicineId: step.medicineId,
              medicineName: step.medicineName,
              doseAmount: step.doseAmount,
              doseUnit: step.doseUnit,
              doseUnitId: step.doseUnitId,
              timeOfDay: step.timeOfDay,
              route: step.route,
            },
          });
        }),
      );
      const updatedCase = await tx.healthCase.update({
        where: { id },
        data: {
          healthPlanId: plan.id,
          totalSteps: plan.steps.length,
          currentStep: 0,
          progressPercentage: 0,
        },
        include: this.caseInclude(),
      });
      return { healthCase: updatedCase, tasks };
    });
    this.log.info('Health plan applied to case', {
      healthCaseId: id,
      healthPlanId: plan.id,
    });
    return result;
  }

  /**
   * `POST /health/plans/:id/apply` (RAKHAL-414) — applies one plan to many animals in a single
   * transaction. **RAKHAL-415**: which model that write lands in now depends on the plan's own
   * category. A curative plan (`TREATMENT`) still gives each animal its own new `HealthCase` +
   * tasks, unchanged from RAKHAL-414. A preventive plan (`PREVENTION`/`VACCINATION`/`DEWORMING`/
   * `ROUTINE`/`BREEDING`) instead writes one `PlanApplication` "round" + one `PlanEnrollment` per
   * animal and **no `HealthCase` at all** — this is the fix for routine vaccination/deworming
   * rounds rendering as N new "sick" animals in Sick Bay. A bad `cattleId` fails the whole call
   * before anything is written; a partial failure inside the transaction rolls the whole batch
   * back. Split into two private helpers below rather than one method with a mid-body branch, since
   * the two paths write to entirely different tables and share almost no logic beyond validation.
   */
  async applyPlanToAnimals(
    farmId: string,
    userId: string,
    id: string,
    dto: ApplyPlanToAnimalsDto,
  ) {
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id, farmId, deletedAt: null },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Health plan not found');
    if (plan.steps.length === 0) {
      throw new BadRequestException('Health plan has no steps to apply');
    }

    const cattleIds = dto.cattleIds;
    if (cattleIds.length === 0) {
      throw new BadRequestException('cattleIds must not be empty');
    }

    // Validate every animal belongs to this farm before writing anything —
    // one bad id must fail the whole call with nothing written.
    const cattleRows = await this.prisma.cattle.findMany({
      where: { id: { in: cattleIds }, farmId, deletedAt: null },
      select: { id: true, tagNumber: true, shedId: true },
    });
    const foundIds = new Set(cattleRows.map((c) => c.id));
    const missing = cattleIds.filter((cattleId) => !foundIds.has(cattleId));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Cattle not found in this farm: ${missing.join(', ')}`,
      );
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const careType = careTypeForPlanCategory(plan.category);

    return careType === HealthCareType.CURATIVE
      ? this.applyCurativePlanToAnimals(farmId, plan, cattleRows, startDate)
      : this.applyPreventivePlanToAnimals(
          farmId,
          userId,
          plan,
          cattleRows,
          startDate,
        );
  }

  /**
   * RAKHAL-473 — add animals to a round that already exists (`HealthRoundsService.addAnimals` resolves the round and the
   * protocol; this does the writes with the same helpers a normal apply uses). A preventive / breeding round gets new
   * `PlanEnrollment`s on its `PlanApplication`; a treatment round gets new `HealthCase`s stamped with the round's day.
   * Animals already on the protocol are skipped, never duplicated. A bad cattle id fails the whole call.
   */
  async addAnimalsToRound(
    farmId: string,
    userId: string,
    input: {
      plan: HealthPlan & { steps: HealthPlanStep[] };
      cattleIds: string[];
      /** The round's start: the application's start date, or an instant inside the treatment round's farm day. */
      startDate: Date;
      /** Present for a preventive / breeding round. */
      applicationId?: string;
    },
  ) {
    const { plan, cattleIds, startDate, applicationId } = input;
    if (plan.steps.length === 0) {
      throw new BadRequestException('Health plan has no steps to apply');
    }
    const uniqueIds = [...new Set(cattleIds)];
    const cattleRows = await this.prisma.cattle.findMany({
      where: { id: { in: uniqueIds }, farmId, deletedAt: null },
      select: { id: true, tagNumber: true, shedId: true },
    });
    const found = new Set(cattleRows.map((c) => c.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Cattle not found in this farm: ${missing.join(', ')}`,
      );
    }
    const minDue = new Date();
    return applicationId
      ? this.applyPreventivePlanToAnimals(
          farmId,
          userId,
          plan,
          cattleRows,
          startDate,
          { applicationId, minDue },
        )
      : this.applyCurativePlanToAnimals(farmId, plan, cattleRows, startDate, {
          minDue,
          createdAt: startDate,
        });
  }

  /** RAKHAL-414's original bulk-apply body, unchanged — one new `HealthCase` per animal. Only
   * reached for a curative (`TREATMENT`-category) plan now; see `applyPlanToAnimals` above. */
  private async applyCurativePlanToAnimals(
    farmId: string,
    plan: HealthPlan & { steps: HealthPlanStep[] },
    cattleRows: { id: string; tagNumber: string; shedId: string | null }[],
    startDate: Date,
    /** RAKHAL-473 — set when animals are added to a round that already exists: steps already past are due now instead of
     * back in time, and the steps are stamped with the round's day so the derived round (plan + the day its steps were
     * created) is the one being joined. Omitted for a normal apply, which behaves exactly as before. */
    join?: { minDue: Date; createdAt: Date },
  ) {
    // An animal already on this exact protocol is skipped, not duplicated —
    // this is what the two-request create-then-apply frontend flow could not
    // express (it always created a fresh case, every time).
    const existing = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        cattleId: { in: cattleRows.map((c) => c.id) },
        healthPlanId: plan.id,
        status: { in: ACTIVE_CASE_STATUSES },
      },
      select: { cattleId: true },
    });
    const alreadyOnPlan = new Set(existing.map((c) => c.cattleId));

    const toApply = cattleRows.filter((c) => !alreadyOnPlan.has(c.id));
    const skipped = cattleRows
      .filter((c) => alreadyOnPlan.has(c.id))
      .map((c) => ({
        cattleId: c.id,
        status: 'skipped' as const,
        reason: 'Animal already has an active case for this protocol',
      }));

    const applied: {
      cattleId: string;
      healthCaseId: string;
      status: 'applied';
    }[] = [];

    if (toApply.length > 0) {
      await this.protocolStock?.assertInStock(
        farmId,
        plan.steps,
        toApply.length,
      );
      const dueOf = await this.dueResolver(farmId);
      await this.prisma.$transaction(async (tx) => {
        for (const cattle of toApply) {
          const caseCode = await this.nextCaseCode(farmId, tx);
          const healthCase = await tx.healthCase.create({
            data: {
              farmId,
              cattleId: cattle.id,
              caseCode,
              note: plan.diagnosis ?? plan.name,
              careType: HealthCareType.CURATIVE,
              priority: HealthPriority.LOW,
              shedId: cattle.shedId,
              startDate,
              healthPlanId: plan.id,
              totalSteps: plan.steps.length,
              currentStep: 0,
              progressPercentage: 0,
            },
          });
          await Promise.all(
            plan.steps.map((step, index) => {
              const dueDateTime = this.dueNoEarlierThan(
                dueOf(
                  this.addDays(startDate, Math.max(0, step.dayNumber - 1)),
                  step,
                ),
                join?.minDue,
              );
              return tx.healthTask.create({
                data: {
                  ...(join ? { createdAt: join.createdAt } : {}),
                  farmId,
                  cattleId: cattle.id,
                  healthCaseId: healthCase.id,
                  healthPlanId: plan.id,
                  taskCode: `${caseCode}-T${String(index + 1).padStart(2, '0')}`,
                  taskDate: dueDateTime,
                  dueDateTime,
                  taskType: step.actionType,
                  title: step.title,
                  instruction: step.instruction,
                  stepNumber: index + 1,
                  totalSteps: plan.steps.length,
                  medicineId: step.medicineId,
                  medicineName: step.medicineName,
                  doseAmount: step.doseAmount,
                  doseUnit: step.doseUnit,
                  doseUnitId: step.doseUnitId,
                  timeOfDay: step.timeOfDay,
                  route: step.route,
                },
              });
            }),
          );
          applied.push({
            cattleId: cattle.id,
            healthCaseId: healthCase.id,
            status: 'applied',
          });
        }
      });
    }

    this.log.info('Health plan bulk-applied', {
      farmId,
      healthPlanId: plan.id,
      appliedCount: applied.length,
      skippedCount: skipped.length,
    });

    return {
      healthPlanId: plan.id,
      appliedCount: applied.length,
      skippedCount: skipped.length,
      results: [...applied, ...skipped],
    };
  }

  /** RAKHAL-415 — the preventive counterpart of `applyCurativePlanToAnimals`: one `PlanApplication`
   * round + one `PlanEnrollment` per newly-enrolled animal, no `HealthCase`. An animal already
   * `ACTIVE`-enrolled in this exact plan is skipped, mirroring the curative path's own rule.
   * `taskCode` is keyed off `applicationId`+`cattleId` (both globally-unique cuids) rather than the
   * curative path's `caseCode` sequence, since there is no case here to mint one from. */
  private async applyPreventivePlanToAnimals(
    farmId: string,
    userId: string,
    plan: HealthPlan & { steps: HealthPlanStep[] },
    cattleRows: { id: string; tagNumber: string; shedId: string | null }[],
    startDate: Date,
    /** RAKHAL-473 — enroll into this existing `PlanApplication` (a round) instead of creating a new one; steps already
     * past are due now. Omitted for a normal apply. */
    join?: { applicationId: string; minDue: Date },
    /** Protocols v2 auto-repeat — set by `applyCycleRepeat` so the successor enrollment links back. */
    cycle?: { cycleNumber: number; repeatedFromId: string },
  ) {
    const existing = await this.prisma.planEnrollment.findMany({
      where: {
        farmId,
        cattleId: { in: cattleRows.map((c) => c.id) },
        healthPlanId: plan.id,
        status: PlanEnrollmentStatus.ACTIVE,
        deletedAt: null,
      },
      select: { cattleId: true },
    });
    const alreadyEnrolled = new Set(existing.map((e) => e.cattleId));

    const toApply = cattleRows.filter((c) => !alreadyEnrolled.has(c.id));
    const skipped = cattleRows
      .filter((c) => alreadyEnrolled.has(c.id))
      .map((c) => ({
        cattleId: c.id,
        status: 'skipped' as const,
        reason: 'Animal already has an active enrollment for this protocol',
      }));

    const applied: {
      cattleId: string;
      planEnrollmentId: string;
      status: 'applied';
    }[] = [];
    let planApplicationId: string | null = null;

    if (toApply.length > 0) {
      await this.protocolStock?.assertInStock(
        farmId,
        plan.steps,
        toApply.length,
      );
      const dueOf = await this.dueResolver(farmId);
      planApplicationId = await this.prisma.$transaction(async (tx) => {
        const application = join
          ? await tx.planApplication.update({
              where: { id: join.applicationId },
              data: { animalCount: { increment: toApply.length } },
            })
          : await tx.planApplication.create({
              data: {
                farmId,
                healthPlanId: plan.id,
                startDate,
                appliedBy: userId,
                animalCount: toApply.length,
              },
            });
        for (const cattle of toApply) {
          const enrollment = await tx.planEnrollment.create({
            data: {
              farmId,
              cattleId: cattle.id,
              healthPlanId: plan.id,
              planApplicationId: application.id,
              startDate,
              totalSteps: plan.steps.length,
              currentStep: 0,
              progressPercentage: 0,
              ...(cycle ?? {}),
            },
          });
          await Promise.all(
            plan.steps.map((step, index) => {
              const dueDateTime = this.dueNoEarlierThan(
                dueOf(
                  this.addDays(startDate, Math.max(0, step.dayNumber - 1)),
                  step,
                ),
                join?.minDue,
              );
              return tx.healthTask.create({
                data: {
                  farmId,
                  cattleId: cattle.id,
                  planEnrollmentId: enrollment.id,
                  healthPlanId: plan.id,
                  taskCode: `${application.id}-${cattle.id}-T${String(index + 1).padStart(2, '0')}`,
                  taskDate: dueDateTime,
                  dueDateTime,
                  taskType: step.actionType,
                  title: step.title,
                  instruction: step.instruction,
                  stepNumber: index + 1,
                  totalSteps: plan.steps.length,
                  medicineId: step.medicineId,
                  medicineName: step.medicineName,
                  doseAmount: step.doseAmount,
                  doseUnit: step.doseUnit,
                  doseUnitId: step.doseUnitId,
                  timeOfDay: step.timeOfDay,
                  route: step.route,
                },
              });
            }),
          );
          applied.push({
            cattleId: cattle.id,
            planEnrollmentId: enrollment.id,
            status: 'applied',
          });
        }
        return application.id;
      });
    }

    this.log.info('Preventive plan bulk-applied', {
      farmId,
      healthPlanId: plan.id,
      planApplicationId,
      appliedCount: applied.length,
      skippedCount: skipped.length,
    });

    return {
      healthPlanId: plan.id,
      planApplicationId,
      appliedCount: applied.length,
      skippedCount: skipped.length,
      results: [...applied, ...skipped],
    };
  }

  /**
   * `POST /health/treatments/:id/void` (protocols v2 undo) — a dose recorded by mistake. Gives the stock back to the exact
   * batch(es) it was drawn from, reverses the Finance expense (journal reversal + `Expense.voidedAt`), cancels the safety
   * withdrawal it created, marks the log voided (kept for the audit trail, excluded from costs / counts / reports) and puts
   * its step back to PENDING so it can be recorded again correctly. Every step is idempotent, so a failed void can simply be
   * retried. `opts.resetTask: false` / `skipProgress` are for the cancel flows, which delete the step right after.
   */
  async voidTreatmentLog(
    farmId: string,
    userId: string,
    logId: string,
    reason?: string,
    opts: { resetTask?: boolean; skipProgress?: boolean } = {},
  ) {
    const log = await this.prisma.treatmentLog.findFirst({
      where: { id: logId, farmId },
    });
    if (!log) throw new NotFoundException('Treatment not found');
    if (log.voidedAt) {
      throw new BadRequestException('This treatment was already voided');
    }
    const note = reason ? `Voided: ${reason}` : 'Voided';

    await this.medicineService.restoreForTreatmentVoid(farmId, userId, {
      treatmentLogId: log.id,
      fallbackMedicineId: log.stockDeducted ? log.medicineId : null,
      fallbackQuantity: log.stockDeducted
        ? Number(log.stockDeductionQuantity ?? 0)
        : null,
      notes: `${note} (treatment ${log.id})`,
    });
    if (log.financeTransactionId) {
      await this.expenseService.voidInventoryConsumption(
        farmId,
        log.financeTransactionId,
        userId,
      );
    }
    if (log.vetExpenseId) {
      await this.expenseService.voidInventoryConsumption(
        farmId,
        log.vetExpenseId,
        userId,
      );
    }

    const taskId = log.healthTaskId;
    await this.prisma.$transaction(async (tx) => {
      await tx.safetyWithdrawal.updateMany({
        where: {
          farmId,
          treatmentLogId: log.id,
          status: {
            in: [
              SafetyWithdrawalStatus.ACTIVE,
              SafetyWithdrawalStatus.READY_FOR_RELEASE,
            ],
          },
        },
        data: { status: SafetyWithdrawalStatus.CANCELLED },
      });
      await tx.treatmentLog.update({
        where: { id: log.id },
        data: { voidedAt: new Date(), voidedBy: userId, voidReason: reason },
      });
      if (taskId && opts.resetTask !== false) {
        await tx.healthTask.update({
          where: { id: taskId },
          data: {
            status: HealthTaskStatus.PENDING,
            completedAt: null,
            completedBy: null,
          },
        });
      }
    });

    if (taskId && opts.resetTask !== false && !opts.skipProgress) {
      const task = await this.prisma.healthTask.findUnique({
        where: { id: taskId },
        select: { healthCaseId: true, planEnrollmentId: true },
      });
      if (task?.healthCaseId) {
        await this.updateCaseProgress(this.prisma, task.healthCaseId);
      } else if (task?.planEnrollmentId) {
        await this.updateEnrollmentProgress(this.prisma, task.planEnrollmentId);
      }
    }
    // The "Treatment Completed" (+3) the dose earned goes back too, and the
    // void itself lands in the immutable Activity Log (before this, a voided
    // dose kept its score and left no trace).
    await this.reverseAqrNear(
      farmId,
      log.cattleId,
      'Treatment Completed',
      log.createdAt,
      userId,
      `Treatment ${log.id} voided${reason ? ` — ${reason}` : ''}.`,
    );
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.HEALTH_SAFETY,
      eventTitle: 'Voided: Treatment',
      actionDetails: `Treatment ${log.id} voided${reason ? ` — ${reason}` : ''} (stock restored, cost reversed).`,
      actorId: userId,
      relatedCattleId: log.cattleId,
    });
    this.log.info('Treatment voided', { farmId, treatmentLogId: log.id });
    return { id: log.id, voided: true };
  }

  /**
   * Reverses the AQR event an action earned (found by title, cow and the few
   * seconds after the action's row was created — the event is applied right
   * after commit). Relative, so later score changes survive. Best-effort: a
   * missing event (action never scored) is a no-op, never an error.
   */
  private async reverseAqrNear(
    farmId: string,
    cattleId: string,
    eventTitle: string,
    since: Date,
    userId: string,
    actionDetails: string,
  ) {
    const source = await this.prisma.activityLog.findFirst({
      where: {
        farmId,
        relatedCattleId: cattleId,
        eventTitle,
        aqrImpact: { not: null },
        timestamp: { gte: since, lte: new Date(since.getTime() + 60_000) },
      },
      orderBy: { timestamp: 'asc' },
      select: { id: true },
    });
    if (!source) return;
    await this.aqrService.reverseEvent(farmId, cattleId, source.id, {
      actorId: userId,
      actionDetails,
      relative: true,
    });
  }

  /** Voids every live dose of the given plan steps, then deletes the steps. Returns how many of each. */
  private async cancelPlanTasks(
    farmId: string,
    userId: string,
    taskWhere: Prisma.HealthTaskWhereInput,
    reason?: string,
  ) {
    const tasks = await this.prisma.healthTask.findMany({
      where: { farmId, deletedAt: null, ...taskWhere },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);
    const logs = taskIds.length
      ? await this.prisma.treatmentLog.findMany({
          where: { farmId, healthTaskId: { in: taskIds }, voidedAt: null },
          select: { id: true },
        })
      : [];
    for (const log of logs) {
      await this.voidTreatmentLog(
        farmId,
        userId,
        log.id,
        reason ?? 'Protocol cancelled',
        {
          resetTask: false,
          skipProgress: true,
        },
      );
    }
    if (taskIds.length) {
      await this.prisma.healthTask.updateMany({
        where: { id: { in: taskIds } },
        data: {
          deletedAt: new Date(),
          notes: reason
            ? `Protocol cancelled: ${reason}`
            : 'Protocol cancelled',
        },
      });
    }
    return { stepsRemoved: taskIds.length, dosesReversed: logs.length };
  }

  /**
   * Cancel a preventive application on one animal as a mistake — in one call: every recorded dose is reversed (stock back,
   * expense reversed, withdrawal cancelled), every step is deleted, the enrollment is archived and, when it was the last
   * animal, the whole round disappears. Unlike `stopCattleProtocol` (keeps what happened, skips what is left), nothing of
   * this remains in progress, costs or counts.
   */
  async cancelEnrollment(
    farmId: string,
    userId: string,
    enrollmentId: string,
    reason?: string,
  ) {
    const enrollment = await this.prisma.planEnrollment.findFirst({
      where: { id: enrollmentId, farmId, deletedAt: null },
      select: { id: true, planApplicationId: true },
    });
    if (!enrollment) {
      throw new NotFoundException('That animal is not on this protocol');
    }
    const result = await this.cancelPlanTasks(
      farmId,
      userId,
      { planEnrollmentId: enrollment.id },
      reason,
    );
    await this.prisma.planEnrollment.update({
      where: { id: enrollment.id },
      data: {
        deletedAt: new Date(),
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
    const live = await this.prisma.planEnrollment.count({
      where: {
        planApplicationId: enrollment.planApplicationId,
        deletedAt: null,
      },
    });
    await this.prisma.planApplication.update({
      where: { id: enrollment.planApplicationId },
      data:
        live === 0
          ? { deletedAt: new Date(), animalCount: 0 }
          : { animalCount: live },
    });
    this.log.info('Protocol cancelled on enrollment', {
      farmId,
      enrollmentId,
      ...result,
    });
    return {
      planEnrollmentId: enrollment.id,
      healthCaseId: null,
      ...result,
      caseRemoved: false,
    };
  }

  /**
   * Cancel a treatment protocol on one case as a mistake, in one call. The plan's steps and doses are reversed and deleted.
   * A case that existed only because the protocol was applied (no other open step, no other dose) is deleted with it — the
   * animal stops showing as sick; a case that has its own history just loses the protocol link.
   */
  async cancelCaseProtocol(
    farmId: string,
    userId: string,
    caseId: string,
    reason?: string,
  ) {
    const healthCase = await this.prisma.healthCase.findFirst({
      where: {
        id: caseId,
        farmId,
        deletedAt: null,
        healthPlanId: { not: null },
      },
      select: { id: true },
    });
    if (!healthCase) {
      throw new NotFoundException('That animal is not on this protocol');
    }
    const result = await this.cancelPlanTasks(
      farmId,
      userId,
      { healthCaseId: healthCase.id, healthPlanId: { not: null } },
      reason,
    );
    const [otherSteps, otherDoses] = await Promise.all([
      this.prisma.healthTask.count({
        where: { farmId, healthCaseId: healthCase.id, deletedAt: null },
      }),
      this.prisma.treatmentLog.count({
        where: { farmId, healthCaseId: healthCase.id, voidedAt: null },
      }),
    ]);
    const caseRemoved = otherSteps === 0 && otherDoses === 0;
    await this.prisma.healthCase.update({
      where: { id: healthCase.id },
      data: caseRemoved
        ? {
            deletedAt: new Date(),
            healthPlanId: null,
            totalSteps: 0,
            currentStep: 0,
            progressPercentage: 0,
          }
        : {
            healthPlanId: null,
            totalSteps: 0,
            currentStep: 0,
            progressPercentage: 0,
          },
    });
    this.log.info('Protocol cancelled on case', {
      farmId,
      caseId,
      caseRemoved,
      ...result,
    });
    return {
      planEnrollmentId: null,
      healthCaseId: healthCase.id,
      ...result,
      caseRemoved,
    };
  }

  /** `POST /cattle/:id/protocols/cancel` — exactly one of `healthCaseId` / `planEnrollmentId`. */
  async cancelAnimalProtocol(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: StopCattleProtocolDto,
  ) {
    if (Boolean(dto.healthCaseId) === Boolean(dto.planEnrollmentId)) {
      throw new BadRequestException(
        'Send exactly one of healthCaseId or planEnrollmentId',
      );
    }
    await this.assertCattleInFarm(farmId, cattleId);
    if (dto.healthCaseId) {
      const owns = await this.prisma.healthCase.count({
        where: { id: dto.healthCaseId, farmId, cattleId },
      });
      if (!owns)
        throw new NotFoundException('That animal is not on this protocol');
      return this.cancelCaseProtocol(
        farmId,
        userId,
        dto.healthCaseId,
        dto.reason,
      );
    }
    const owns = await this.prisma.planEnrollment.count({
      where: { id: dto.planEnrollmentId, farmId, cattleId },
    });
    if (!owns)
      throw new NotFoundException('That animal is not on this protocol');
    return this.cancelEnrollment(
      farmId,
      userId,
      dto.planEnrollmentId!,
      dto.reason,
    );
  }

  /** `GET /health/plans/:id/stock-check` — would applying this protocol to `animals` animals run short of usable stock? */
  async stockCheck(farmId: string, planId: string, animals: number) {
    const plan = await this.getPlan(farmId, planId);
    const shortfalls =
      (await this.protocolStock?.check(
        farmId,
        plan.steps,
        Math.max(1, animals),
      )) ?? [];
    return { ok: shortfalls.length === 0, shortfalls };
  }

  /** Protocols v2 auto-repeat: re-enroll one animal in the next cycle of a preventive protocol (same stock gate as a normal apply). */
  async applyCycleRepeat(
    farmId: string,
    userId: string,
    plan: HealthPlan & { steps: HealthPlanStep[] },
    cattle: { id: string; tagNumber: string; shedId: string | null },
    startDate: Date,
    cycle: { cycleNumber: number; repeatedFromId: string },
  ) {
    return this.applyPreventivePlanToAnimals(
      farmId,
      userId,
      plan,
      [cattle],
      startDate,
      undefined,
      cycle,
    );
  }

  async logTreatment(
    farmId: string,
    userId: string,
    id: string,
    dto: LogTreatmentDto,
  ) {
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const task = dto.healthTaskId
      ? await this.prisma.healthTask.findFirst({
          where: { id: dto.healthTaskId, healthCaseId: id, deletedAt: null },
        })
      : null;
    if (dto.healthTaskId && !task)
      throw new BadRequestException('Health task must belong to case');
    if (dto.outsideInventory && !dto.medicineName?.trim()) {
      throw new BadRequestException(
        'medicineName is required when the medicine is not in inventory',
      );
    }
    const vetCost = dto.vetCost && dto.vetCost > 0 ? dto.vetCost : undefined;

    // Inventory decrement (HLT-07): consume medicine stock before logging the
    // treatment, so an expired batch (HLT-02) or insufficient stock (INV-02)
    // aborts the whole action. Only runs when a medicine + quantity is given.
    // A hand-typed medicine (`outsideInventory`) never touches stock or cost.
    const medicineId = dto.outsideInventory
      ? undefined
      : (dto.medicineId ?? task?.medicineId ?? undefined);
    const medicineName = dto.medicineName ?? task?.medicineName ?? undefined;
    // Protocols v2: with no typed dose, the plan step's own dose (in its own unit) is what is given.
    const typedQuantity = dto.stockDeductionQuantity ?? dto.doseAmount;
    const quantity =
      typedQuantity ??
      (!dto.medicineId && task?.doseAmount
        ? Number(task.doseAmount)
        : undefined);
    // A typed dose carries its own unit (`dto.doseUnitId`) unless the caller gave the stock quantity directly.
    const doseUnitId =
      typedQuantity === undefined
        ? (task?.doseUnitId ?? undefined)
        : dto.stockDeductionQuantity === undefined
          ? dto.doseUnitId
          : undefined;

    // RAKHAL-419/RAKHAL-437 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`): cost is
    // priced from the actual batch(es) `decrementForTreatment` draws from —
    // accurate even when a dose splits across two differently-priced lots —
    // rather than a pre-read guess off the product-level `Medicine.
    // costPerUnit`, which silently mispriced any split. `decrementForTreatment`
    // is atomic (throws before writing anything on insufficient/expired
    // stock), so resolving cost from its own return, after it settles, carries
    // none of the "rejected call already consumed stock" risk RD-095 was
    // guarding against — there's no DB read left here that could fail.
    // RD-084: no `financialAccountId` guard here anymore — consumption never
    // touches cash (see `recordInventoryConsumption`'s own doc comment).
    const deduction =
      !dto.outsideInventory &&
      quantity &&
      quantity > 0 &&
      (medicineId || medicineName)
        ? await this.medicineService.decrementForTreatment(farmId, userId, {
            medicineId,
            medicineName,
            quantity,
            doseUnitId,
            notes: `Treatment for case ${healthCase.caseCode}`,
          })
        : null;
    const resolvedCost = deduction?.totalCost ?? 0;

    const log = await this.prisma.$transaction(async (tx) => {
      const treatmentLog = await tx.treatmentLog.create({
        data: {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          healthCaseId: id,
          healthTaskId: dto.healthTaskId,
          medicineId: deduction?.medicineId ?? medicineId,
          medicineName: dto.medicineName ?? task?.medicineName,
          doseAmount: dto.doseAmount ?? task?.doseAmount,
          doseUnit: dto.doseUnit ?? task?.doseUnit,
          route: dto.route ?? task?.route,
          administeredAt: dto.administeredAt
            ? new Date(dto.administeredAt)
            : new Date(),
          administeredBy: dto.administeredBy ?? userId,
          stockDeducted: Boolean(deduction),
          stockDeductionQuantity: deduction
            ? quantity
            : dto.stockDeductionQuantity,
          batchNo: deduction?.batchId ?? dto.batchNo,
          notes: dto.notes,
          vetCost,
        },
      });
      if (task) {
        await tx.healthTask.update({
          where: { id: task.id },
          data: {
            status: HealthTaskStatus.COMPLETED,
            completedAt: treatmentLog.administeredAt,
            completedBy: dto.administeredBy ?? userId,
          },
        });
      }
      await this.stampMovements(tx, deduction?.movementIds, treatmentLog.id);
      const withdrawal = await this.createSafetyWithdrawalIfNeeded(
        tx,
        healthCase,
        treatmentLog,
        dto,
      );
      const autoClosed = await this.updateCaseProgress(tx, id);
      return { treatmentLog, withdrawal, autoClosed };
    });

    // RAKHAL-419: post the treatment's cost to Finance after the log commits
    // (same after-commit convention the AQR/notification calls below already
    // use) — needs the real treatmentLog.id for `financeTransactionId`.
    // Re-fetches the row onto `log.treatmentLog` rather than trusting the
    // pre-update object, the exact stale-response class RAKHAL-330 found.
    if (resolvedCost > 0) {
      const posted = await this.expenseService.recordInventoryConsumption(
        farmId,
        userId,
        {
          category: ExpenseCategory.HEALTH,
          description: `Medicine — Case ${healthCase.caseCode}`,
          amount: resolvedCost,
          expenseDate: log.treatmentLog.administeredAt.toISOString(),
          cattleId: healthCase.cattleId,
        },
      );
      log.treatmentLog = await this.prisma.treatmentLog.update({
        where: { id: log.treatmentLog.id },
        data: { financeTransactionId: posted.id },
      });
    }

    // Vet fee: a real cash cost (unlike the inventory consumption above), paid
    // from the chosen account. Posted after the log commits, same convention.
    if (vetCost) {
      const vetExpense = await this.expenseService.recordExpense(
        farmId,
        userId,
        {
          category: ExpenseCategory.HEALTH,
          description: `Vet fee — Case ${healthCase.caseCode}`,
          amount: vetCost,
          expenseDate: log.treatmentLog.administeredAt.toISOString(),
          financialAccountId: await this.expenseService.resolveAccountId(
            farmId,
            userId,
            dto.financialAccountId,
          ),
          cattleId: healthCase.cattleId,
        },
      );
      log.treatmentLog = await this.prisma.treatmentLog.update({
        where: { id: log.treatmentLog.id },
        data: { vetExpenseId: vetExpense.id },
      });
    }

    await this.notifyCaseAutoClosed(log.autoClosed, userId);

    // AQR: a completed, scheduled dose counts as a treatment completed (+3).
    if (task) {
      await this.aqrService.applyEvent(
        farmId,
        healthCase.cattleId,
        'treatment_completed',
        {
          actorId: userId,
          actionDetails: `Treatment administered for case [${healthCase.caseCode}].`,
        },
      );
    }

    // Notify Owner + Manager (PRD §20.2 `withholding_active`) — instant, fired
    // from the treatment-logging path rather than a sweep, since the trigger is
    // "treatment logged with withdrawal days" not a time boundary. PRD says
    // "milkers for that shed", but no shed→milker roster model exists yet, so
    // this falls back to Owner+Manager (same as every other sweep) pending a
    // future ticket for shed-scoped recipients.
    if (log.withdrawal) {
      const cattle = await this.prisma.cattle.findUnique({
        where: { id: healthCase.cattleId },
        select: { name: true, tagNumber: true },
      });
      const label = cattle?.name ?? cattle?.tagNumber ?? 'Animal';
      const milkUntil = log.withdrawal.milkWithdrawalUntil
        ?.toISOString()
        .slice(0, 10);
      const meatUntil = log.withdrawal.meatWithdrawalUntil
        ?.toISOString()
        .slice(0, 10);
      await this.notificationService.notifyOwnersAndManagers({
        farmId,
        eventKey: 'withholding_active',
        title: 'Withholding Period Active',
        message: `${label}${cattle?.tagNumber ? ` (${cattle.tagNumber})` : ''} is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
        params: {
          name: label,
          tagNumber: cattle?.tagNumber ?? '',
          milkUntil: milkUntil ?? '',
          meatUntil: meatUntil ?? '',
        },
        link: `/healthcare/cases/${id}`,
        dedupeKey: `withholding_active:${log.withdrawal.id}`,
      });
    }

    this.log.info('Treatment logged', {
      healthCaseId: id,
      treatmentLogId: log.treatmentLog.id,
    });
    return log;
  }

  /**
   * `POST /health/treatments` (RAKHAL-416) — records a treatment against one or more animals with
   * no case id, Herdwatch-style (remedy -> date -> dose -> animals -> save). `HealthCase` stops
   * being a concept the caller has to know about: an existing open case for the animal is reused,
   * otherwise a minimal one is opened silently from `dto.reason`. Withdrawal is derived from the
   * medicine's own `milkWithdrawalDays`/`meatWithdrawalDays` rather than typed by the caller — a
   * medicine with `0`/`0` produces no hold. Stock decrements once per treated animal through the
   * existing `MedicineService.decrementForTreatment` path.
   *
   * Deliberately does **not** fire the sickness AQR penalty / "review reported sickness" task /
   * owner-manager alert that `createHealthCase` fires for a real Report Sickness — that live parity
   * belongs to the heavier report-sickness flow; Quick Treat's whole point is a lighter one. It does
   * fire the same `treatment_completed` AQR (+3) and `withholding_active` notification `logTreatment`
   * already fires per treatment, since a real dose was administered either way.
   */
  async recordTreatment(
    farmId: string,
    userId: string,
    dto: RecordTreatmentDto,
  ) {
    const cattleIds = dto.cattleIds;
    if (cattleIds.length === 0) {
      throw new BadRequestException('cattleIds must not be empty');
    }

    const manual = Boolean(dto.outsideInventory);
    if (manual && !dto.medicineName?.trim()) {
      throw new BadRequestException(
        'medicineName is required when the medicine is not in inventory',
      );
    }
    if (!manual && !dto.medicineId) {
      throw new BadRequestException('medicineId is required');
    }
    const vetCost = dto.vetCost && dto.vetCost > 0 ? dto.vetCost : undefined;

    const medicine = manual
      ? null
      : await this.prisma.medicine.findFirst({
          where: { id: dto.medicineId, farmId, deletedAt: null },
          select: {
            id: true,
            name: true,
            costPerUnit: true,
            milkWithdrawalDays: true,
            meatWithdrawalDays: true,
          },
        });
    if (!manual && !medicine) throw new NotFoundException('Medicine not found');
    const medicineLabel = manual ? dto.medicineName!.trim() : medicine!.name;
    let vetPosted = false;

    // Validate every animal belongs to this farm before writing anything —
    // same all-or-nothing rule RAKHAL-414's bulk apply uses.
    const cattleRows = await this.prisma.cattle.findMany({
      where: { id: { in: cattleIds }, farmId, deletedAt: null },
      select: { id: true, tagNumber: true, name: true, shedId: true },
    });
    const foundIds = new Set(cattleRows.map((c) => c.id));
    const missing = cattleIds.filter((cattleId) => !foundIds.has(cattleId));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Cattle not found in this farm: ${missing.join(', ')}`,
      );
    }

    const treatedAt = new Date(dto.treatedAt);
    const careType = dto.careType ?? HealthCareType.CURATIVE;
    const isPreventive = careType === HealthCareType.PREVENTIVE;
    const results: {
      cattleId: string;
      healthCaseId: string;
      treatmentLogId: string;
      safetyWithdrawalId: string | null;
      reusedExistingCase: boolean;
    }[] = [];

    for (const cattle of cattleRows) {
      const openCase = isPreventive
        ? null
        : await this.prisma.healthCase.findFirst({
            where: {
              farmId,
              cattleId: cattle.id,
              status: { in: ACTIVE_CASE_STATUSES },
            },
            orderBy: { startDate: 'desc' },
          });
      const reusedExistingCase = Boolean(openCase);

      // Stock decrement happens once per animal, outside the record-writing
      // transaction — same convention `logTreatment` already uses (a batch
      // pick / insufficient-stock failure must abort before any log row for
      // that animal is written, not roll back a shared multi-animal tx).
      const deduction = manual
        ? null
        : await this.medicineService.decrementForTreatment(farmId, userId, {
            medicineId: dto.medicineId,
            quantity: dto.doseAmount,
            doseUnitId: dto.doseUnitId,
            notes: `Quick treatment for ${cattle.tagNumber}`,
          });
      // RAKHAL-437: priced from this animal's own actual draw (batches
      // deplete across animals in the loop, so different animals can draw
      // from different-cost lots) rather than one shared product-level guess.
      const resolvedCost = deduction?.totalCost ?? 0;

      const { healthCaseId, treatmentLog, withdrawal, autoClosed } =
        await this.prisma.$transaction(async (tx) => {
          const targetCase =
            openCase ??
            (await tx.healthCase.create({
              data: {
                farmId,
                cattleId: cattle.id,
                caseCode: await this.nextCaseCode(farmId, tx),
                note:
                  dto.reason?.trim() ||
                  (isPreventive
                    ? `Preventive / Wellness — ${medicineLabel}`
                    : `Quick treatment — ${medicineLabel}`),
                careType,
                ...(dto.condition ? { condition: dto.condition } : {}),
                priority: HealthPriority.LOW,
                status: isPreventive
                  ? HealthCaseStatus.CLOSED
                  : HealthCaseStatus.ACTIVE,
                closedDate: isPreventive ? treatedAt : undefined,
                closeReason: isPreventive ? 'preventive_routine' : undefined,
                totalSteps: isPreventive ? 1 : 0,
                currentStep: isPreventive ? 1 : 0,
                progressPercentage: isPreventive ? 100 : 0,
                shedId: cattle.shedId,
                startDate: treatedAt,
              },
            }));

          const treatmentLog = await tx.treatmentLog.create({
            data: {
              farmId,
              cattleId: cattle.id,
              healthCaseId: targetCase.id,
              medicineId: deduction?.medicineId,
              medicineName: medicineLabel,
              doseAmount: dto.doseAmount,
              doseUnit: dto.doseUnit,
              route: dto.route,
              administeredAt: treatedAt,
              administeredBy: userId,
              stockDeducted: Boolean(deduction),
              stockDeductionQuantity: deduction ? dto.doseAmount : undefined,
              batchNo: deduction?.batchId,
              notes: dto.notes,
              vetCost: vetCost && !vetPosted ? vetCost : undefined,
            },
          });

          await this.stampMovements(
            tx,
            deduction?.movementIds,
            treatmentLog.id,
          );
          const withdrawal = await this.createSafetyWithdrawalIfNeeded(
            tx,
            targetCase,
            treatmentLog,
            {
              milkWithdrawalDays: medicine?.milkWithdrawalDays || undefined,
              meatWithdrawalDays: medicine?.meatWithdrawalDays || undefined,
            },
          );

          const autoClosed = isPreventive
            ? null
            : await this.updateCaseProgress(tx, targetCase.id);

          return {
            healthCaseId: targetCase.id,
            treatmentLog,
            withdrawal,
            autoClosed,
          };
        });

      // RAKHAL-419: post this animal's share of the cost after its own
      // transaction commits (same after-commit convention `logTreatment`
      // uses) — one Expense per animal, matching "stock decrements once per
      // treated animal" already established for this route.
      if (resolvedCost > 0) {
        const posted = await this.expenseService.recordInventoryConsumption(
          farmId,
          userId,
          {
            category: ExpenseCategory.HEALTH,
            description: `${medicineLabel} — Quick treatment for [${cattle.tagNumber}]`,
            amount: resolvedCost,
            expenseDate: treatedAt.toISOString(),
            cattleId: cattle.id,
          },
        );
        await this.prisma.treatmentLog.update({
          where: { id: treatmentLog.id },
          data: { financeTransactionId: posted.id },
        });
      }

      // One vet fee for the visit, carried by the first animal's log.
      if (vetCost && !vetPosted) {
        vetPosted = true;
        const vetExpense = await this.expenseService.recordExpense(
          farmId,
          userId,
          {
            category: ExpenseCategory.HEALTH,
            description: `Vet fee — Quick treatment (${medicineLabel})`,
            amount: vetCost,
            expenseDate: treatedAt.toISOString(),
            financialAccountId: await this.expenseService.resolveAccountId(
              farmId,
              userId,
              dto.financialAccountId,
            ),
            cattleId: cattle.id,
          },
        );
        await this.prisma.treatmentLog.update({
          where: { id: treatmentLog.id },
          data: { vetExpenseId: vetExpense.id },
        });
      }

      await this.notifyCaseAutoClosed(autoClosed, userId);

      await this.aqrService.applyEvent(
        farmId,
        cattle.id,
        'treatment_completed',
        {
          actorId: userId,
          actionDetails: `${isPreventive ? 'Preventive / Wellness' : 'Quick treatment'} administered for [${cattle.tagNumber}] — ${medicineLabel}.`,
        },
      );

      if (withdrawal) {
        const label = cattle.name ?? cattle.tagNumber;
        const milkUntil = withdrawal.milkWithdrawalUntil
          ?.toISOString()
          .slice(0, 10);
        const meatUntil = withdrawal.meatWithdrawalUntil
          ?.toISOString()
          .slice(0, 10);
        await this.notificationService.notifyOwnersAndManagers({
          farmId,
          eventKey: 'withholding_active',
          title: 'Withholding Period Active',
          message: `${label} (${cattle.tagNumber}) is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
          params: {
            name: label,
            tagNumber: cattle.tagNumber,
            milkUntil: milkUntil ?? '',
            meatUntil: meatUntil ?? '',
          },
          link: `/healthcare/cases/${healthCaseId}`,
          dedupeKey: `withholding_active:${withdrawal.id}`,
        });
      }

      results.push({
        cattleId: cattle.id,
        healthCaseId,
        treatmentLogId: treatmentLog.id,
        safetyWithdrawalId: withdrawal?.id ?? null,
        reusedExistingCase,
      });
    }

    this.log.info('Quick treatment recorded', {
      farmId,
      medicineId: dto.medicineId,
      animalCount: results.length,
    });

    return {
      medicineId: dto.medicineId,
      appliedCount: results.length,
      results,
    };
  }

  async createHealthUpdate(
    farmId: string,
    userId: string,
    id: string,
    dto: CreateHealthUpdateDto,
  ) {
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const statusMap = {
      [ClinicalProgress.IMPROVING]: HealthCaseStatus.IMPROVING,
      [ClinicalProgress.WORSENING]: HealthCaseStatus.WORSENING,
      [ClinicalProgress.STABLE]: HealthCaseStatus.STABLE,
    };
    const update = await this.prisma.$transaction(async (tx) => {
      const created = await tx.healthUpdate.create({
        data: {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          healthCaseId: id,
          clinicalProgress: dto.clinicalProgress,
          symptoms: dto.symptoms ?? [],
          temperature: dto.temperature,
          appetite: dto.appetite,
          appearance: dto.appearance,
          observation: dto.observation,
          recordedBy: dto.recordedBy ?? userId,
          recordedAt: new Date(),
        },
      });
      await tx.healthCase.update({
        where: { id },
        data: {
          status: statusMap[dto.clinicalProgress],
          symptoms: dto.symptoms ?? healthCase.symptoms,
        },
      });
      return created;
    });
    return update;
  }

  async closeCase(
    farmId: string,
    userId: string,
    id: string,
    dto: CloseHealthCaseDto,
  ) {
    if (dto.outcome === HealthCloseOutcome.MORTALITY) {
      if (!dto.mortality)
        throw new BadRequestException('Mortality details are required');
      return this.logMortality(farmId, userId, id, dto.mortality);
    }
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const closed = await this.prisma.healthCase.update({
      where: { id },
      data: {
        status: HealthCaseStatus.RECOVERED,
        closedDate: new Date(),
        closeReason: dto.observation ?? 'Recovered',
        deletedAt: new Date(),
      },
    });

    // AQR: Animal Recovered (+5) + immutable Activity Log entry.
    await this.aqrService.applyEvent(farmId, healthCase.cattleId, 'recovered', {
      actorId: userId,
      actionDetails: `Case [${healthCase.caseCode}] closed — animal recovered.`,
    });

    this.log.info('Health case closed as recovered', {
      healthCaseId: id,
      farmId,
    });
    return closed;
  }

  async logMortality(
    farmId: string,
    userId: string,
    id: string,
    dto: MortalityDto,
  ) {
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const disposalCost =
      dto.disposalCost && dto.disposalCost > 0 ? dto.disposalCost : undefined;
    const result = await this.prisma.$transaction(async (tx) => {
      const mortality = await tx.mortalityRecord.create({
        data: {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          healthCaseId: id,
          deathDate: new Date(dto.deathDate),
          primaryCauseOfDeath: dto.primaryCauseOfDeath,
          vetSignOff: dto.vetSignOff,
          symptoms: dto.symptoms ?? [],
          postMortemPerformed: dto.postMortemPerformed ?? false,
          disposalMethod: dto.disposalMethod,
          disposalCost: dto.disposalCost,
          disposalLocation: dto.disposalLocation,
          additionalNotes: dto.additionalNotes,
          recordedBy: dto.recordedBy ?? userId,
        },
      });
      const closedCase = await tx.healthCase.update({
        where: { id },
        data: {
          status: HealthCaseStatus.MORTALITY,
          closedDate: new Date(dto.deathDate),
          closeReason: dto.primaryCauseOfDeath,
          mortalityId: mortality.id,
          deletedAt: new Date(),
        },
      });
      // RAKHAL-399: goes through the same consolidated disposition path every
      // other herd exit uses — creates the `CattleDisposition` row (was
      // previously never created for a mortality) and flips `herdStatus` via
      // the shared method, inside this same transaction.
      await this.cattleService.recordDispositionWithClient(
        tx,
        healthCase.farmId,
        userId,
        healthCase.cattleId,
        {
          type: CattleDispositionType.DEATH,
          date: new Date(dto.deathDate),
          reason: dto.primaryCauseOfDeath,
        },
      );
      return { mortality, healthCase: closedCase };
    });

    // RAKHAL-399: same post-commit herd-exit cleanup every other disposition
    // path runs (cancel open tasks, release open holds) — see
    // `CattleService.recordDisposition`'s own call to this same method.
    await this.cattleService.cleanupOnDisposition(
      farmId,
      healthCase.cattleId,
      userId,
      CattleDispositionType.DEATH,
    );

    // Carcass disposal is a real cash cost: post it to Finance (it was stored
    // on the MortalityRecord but never reached the books).
    if (disposalCost) {
      await this.expenseService.recordExpense(farmId, userId, {
        category: ExpenseCategory.HEALTH,
        description: `Carcass disposal — Case ${healthCase.caseCode}`,
        amount: disposalCost,
        expenseDate: new Date(dto.deathDate).toISOString(),
        financialAccountId: await this.expenseService.resolveAccountId(
          farmId,
          userId,
          dto.financialAccountId,
        ),
        cattleId: healthCase.cattleId,
      });
    }

    // AQR: Animal Mortality — removes the animal from the herd mean (nullify).
    await this.aqrService.applyEvent(farmId, healthCase.cattleId, 'mortality', {
      actorId: userId,
      actionDetails: `Mortality recorded for case [${healthCase.caseCode}] — ${dto.primaryCauseOfDeath}.`,
    });

    this.log.info('Mortality logged', {
      healthCaseId: id,
      cattleId: healthCase.cattleId,
    });
    return result;
  }

  async getPlans(farmId: string, query: HealthPlanQueryDto) {
    // RAKHAL-470: protocols with a run right now. Archived ones are kept in the list on purpose — a protocol someone
    // deleted while animals are still on it must not vanish from the list of what is running.
    const runningNow: Prisma.HealthPlanWhereInput[] = [
      {
        cases: {
          some: { status: { in: ACTIVE_CASE_STATUSES }, deletedAt: null },
        },
      },
      {
        planEnrollments: {
          some: { status: PlanEnrollmentStatus.ACTIVE, deletedAt: null },
        },
      },
    ];
    const where: Prisma.HealthPlanWhereInput = {
      farmId,
      // `inUse=true` is strictly "running now" (kept for API compatibility). Without it the list is every protocol that
      // is not archived, plus any archived one that animals are still on — the UI no longer has an In use | All switch.
      OR: query.inUse ? runningNow : [{ deletedAt: null }, ...runningNow],
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      // RFE-142: the derived kind (mirrors `planKind`): treatment and breeding are their own category, everything else
      // is preventive care. An AND clause so it composes with an explicit `category`.
      ...(query.kind
        ? {
            AND: [
              query.kind === 'PREVENTION'
                ? {
                    category: {
                      notIn: [
                        HealthPlanCategory.TREATMENT,
                        HealthPlanCategory.BREEDING,
                      ],
                    },
                  }
                : { category: HealthPlanCategory[query.kind] },
            ],
          }
        : {}),
      ...(query.planType ? { planType: query.planType } : {}),
      // RAKHAL-468: protocols for one structured condition (Report Sickness "suggested protocols")
      ...(query.condition ? { condition: query.condition } : {}),
    };
    const rows = await this.prisma.healthPlan.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    return toCursorPage(rows, query);
  }

  /** RAKHAL-415 — replaces `getAppliedPlans` (removed, not aliased; `GET /health/cases/applied` is
   * gone). Reads the new `PlanApplication`/`PlanEnrollment` tables directly: one row per round
   * (plan, start date, animal count), each carrying its own enrolled animals + their progress —
   * grouped by round rather than the old one-row-per-cow shape, since a round is now a real object,
   * not an inference over N `HealthCase` rows that happened to share a `healthPlanId`. Only
   * `healthPlanId` filtering carries over from the old DTO's fields for this first pass; `search`/
   * `cattleId`/date-range narrowing is intentionally not wired here (a real, scoped gap, not
   * silently dropped) — "find the round containing this animal" is a reasonable v2 for whichever
   * frontend ticket (RFE-107) ends up consuming this route, not something RAKHAL-415's own AC asks
   * for. */
  async getPlanApplications(farmId: string, query: AppliedPlansQueryDto) {
    const where: Prisma.PlanApplicationWhereInput = {
      farmId,
      deletedAt: null,
      ...(query.healthPlanId ? { healthPlanId: query.healthPlanId } : {}),
    };
    const rows = await this.prisma.planApplication.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      ...getCursorArgs(query),
      include: {
        healthPlan: { select: { id: true, name: true, category: true } },
        enrollments: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            currentStep: true,
            totalSteps: true,
            progressPercentage: true,
            cattle: {
              select: { id: true, name: true, tagNumber: true, image: true },
            },
          },
        },
      },
    });
    return toCursorPage(rows, query);
  }

  async createPlan(farmId: string, userId: string, dto: CreateHealthPlanDto) {
    const steps =
      (await this.protocolStock?.validateAndNormalizeSteps(
        farmId,
        dto.steps,
      )) ?? dto.steps;
    return this.prisma.healthPlan.create({
      data: {
        farmId,
        name: dto.name,
        category: dto.category,
        planType: dto.planType,
        description: dto.description,
        diagnosis: dto.diagnosis,
        condition: dto.condition,
        cycleLengthDays: dto.cycleLengthDays,
        totalActionSteps: steps.length,
        isTemplate: dto.isTemplate ?? false,
        createdBy: userId,
        steps: { create: steps },
      },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
  }

  /**
   * Read-only view of one protocol for the round sheet (MILESTONE 29d): unlike `getPlan` (which update / delete use as
   * an "is it still there" guard) this also returns an archived protocol, because a round of it can still be running
   * and its steps and results must stay readable.
   */
  async getPlanForView(farmId: string, id: string) {
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id, farmId },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Health plan not found');
    return plan;
  }

  async getPlan(farmId: string, id: string) {
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id, farmId, deletedAt: null },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Health plan not found');
    return plan;
  }

  async updatePlan(farmId: string, id: string, dto: UpdateHealthPlanDto) {
    await this.getPlan(farmId, id);
    const steps = dto.steps
      ? ((await this.protocolStock?.validateAndNormalizeSteps(
          farmId,
          dto.steps,
        )) ?? dto.steps)
      : undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (steps) {
        await tx.healthPlanStep.deleteMany({ where: { healthPlanId: id } });
      }
      return tx.healthPlan.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          planType: dto.planType,
          description: dto.description,
          diagnosis: dto.diagnosis,
          condition: dto.condition,
          cycleLengthDays: dto.cycleLengthDays,
          isTemplate: dto.isTemplate,
          totalActionSteps: steps?.length,
          ...(steps ? { steps: { create: steps } } : {}),
        },
        include: { steps: { orderBy: { dayNumber: 'asc' } } },
      });
    });
    this.log.info('Health plan updated', { healthPlanId: id, farmId });
    return updated;
  }

  async deletePlan(farmId: string, id: string) {
    await this.getPlan(farmId, id);
    const deleted = await this.prisma.healthPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.log.info('Health plan archived', { healthPlanId: id, farmId });
    return deleted;
  }

  /**
   * Deletes a case entered by mistake — and everything it caused: every live
   * dose is voided (stock back, cost reversed, withdrawal cancelled), its steps
   * are removed and the "sickness reported" score is taken back. A bare
   * soft-delete used to leave all of that behind.
   */
  async deleteCase(farmId: string, userId: string, id: string) {
    const healthCase = await this.getCaseOrThrow(farmId, id);

    const logs = await this.prisma.treatmentLog.findMany({
      where: { farmId, healthCaseId: id, voidedAt: null },
      select: { id: true },
    });
    for (const log of logs) {
      await this.voidTreatmentLog(farmId, userId, log.id, 'Case deleted', {
        resetTask: false,
        skipProgress: true,
      });
    }
    await this.prisma.healthTask.updateMany({
      where: { farmId, healthCaseId: id, deletedAt: null },
      data: { deletedAt: new Date(), notes: 'Case deleted' },
    });

    const deleted = await this.prisma.healthCase.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (healthCase.careType === HealthCareType.CURATIVE) {
      await this.reverseAqrNear(
        farmId,
        healthCase.cattleId,
        'Animal Sickness Reported',
        healthCase.createdAt,
        userId,
        `Case [${healthCase.caseCode}] deleted.`,
      );
    }
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.HEALTH_SAFETY,
      eventTitle: 'Deleted: Health case',
      actionDetails: `Case [${healthCase.caseCode}] deleted (${logs.length} dose(s) reversed).`,
      actorId: userId,
      relatedCattleId: healthCase.cattleId,
    });
    this.log.info('Health case archived', {
      healthCaseId: id,
      farmId,
      dosesReversed: logs.length,
    });
    return deleted;
  }

  /** The farm's IANA timezone, for cutting a day filter at the farm's own midnight (RAKHAL-470). */
  private async farmTimezone(farmId: string): Promise<string> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { timezone: true },
    });
    return farm?.timezone ?? DEFAULT_FARM_TIMEZONE;
  }

  async getTasks(farmId: string, query: HealthTaskQueryDto) {
    // RAKHAL-470: `dueTo` is a farm-local day, so it needs the farm's timezone; the other callers pay nothing for it.
    const dueBefore = query.dueTo
      ? farmDayEnd(query.dueTo, await this.farmTimezone(farmId))
      : undefined;
    const where: Prisma.HealthTaskWhereInput = {
      farmId,
      deletedAt: null,
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(query.healthCaseId ? { healthCaseId: query.healthCaseId } : {}),
      ...(query.statuses?.length
        ? { status: { in: query.statuses } }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.healthPlanId
        ? { healthPlanId: query.healthPlanId }
        : query.noPlan
          ? { healthPlanId: null }
          : {}),
      ...(dueBefore ? { AND: [{ dueDateTime: { lt: dueBefore } }] } : {}),
      ...(query.type ? { taskType: query.type } : {}),
      ...(query.date
        ? {
            dueDateTime: {
              gte: new Date(`${query.date}T00:00:00.000Z`),
              lte: new Date(`${query.date}T23:59:59.999Z`),
            },
          }
        : {}),
    };
    const rows = await this.prisma.healthTask.findMany({
      where,
      orderBy:
        query.sortBy === 'due'
          ? [{ dueDateTime: query.sortOrder }, { id: query.sortOrder }]
          : [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        cattle: { select: { id: true, tagNumber: true, name: true } },
        // RAKHAL-470: which protocol a step belongs to (and the case it is on), so a list needs no second lookup.
        healthPlan: { select: { id: true, name: true } },
        healthCase: { select: { id: true, caseCode: true } },
      },
    });
    return toCursorPage(rows, query);
  }

  /**
   * RAKHAL-470 — `GET /health/plans/:id/runs`: the animals running one protocol, one row each, paged. A protocol has
   * one kind of run, decided by its category: treatment → one `HealthCase` per animal, anything else → one
   * `PlanEnrollment` per animal — so this never needs a union of the two tables. Rows are normalised to one shape with
   * the animal's progress and its next open step. Reads archived protocols too: a protocol deleted while animals are
   * still on it must still show who is on it. `status=active` (default) = open cases / active enrollments only.
   */
  async getPlanRuns(farmId: string, planId: string, query: PlanRunsQueryDto) {
    const plan = await this.prisma.healthPlan.findFirst({
      where: { id: planId, farmId },
      select: { id: true, category: true },
    });
    if (!plan) throw new NotFoundException('Health plan not found');

    const animalMatch: Prisma.CattleWhereInput | undefined = query.search
      ? {
          OR: [
            { tagNumber: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const nextStep = {
      where: {
        deletedAt: null,
        status: {
          in: [
            HealthTaskStatus.PENDING,
            HealthTaskStatus.RESCHEDULED,
            HealthTaskStatus.OVERDUE,
          ],
        },
      },
      orderBy: { dueDateTime: 'asc' as const },
      take: 1,
      select: { id: true, title: true, dueDateTime: true, status: true },
    };
    const cattle = {
      select: { id: true, name: true, tagNumber: true, image: true },
    };
    const orderBy = [{ createdAt: query.sortOrder }, { id: query.sortOrder }];

    if (plan.category === HealthPlanCategory.TREATMENT) {
      const rows = await this.prisma.healthCase.findMany({
        where: {
          farmId,
          healthPlanId: planId,
          deletedAt: null,
          ...(query.status === 'active'
            ? { status: { in: ACTIVE_CASE_STATUSES } }
            : {}),
          ...(animalMatch ? { cattle: animalMatch } : {}),
        },
        orderBy,
        ...getCursorArgs(query),
        select: {
          id: true,
          caseCode: true,
          status: true,
          startDate: true,
          currentStep: true,
          totalSteps: true,
          progressPercentage: true,
          cattle,
          tasks: nextStep,
        },
      });
      return toCursorPage(
        rows.map(({ tasks, ...row }) => ({
          ...row,
          kind: 'CASE' as const,
          healthCaseId: row.id,
          planEnrollmentId: null,
          nextStep: tasks[0] ?? null,
        })),
        query,
      );
    }

    const rows = await this.prisma.planEnrollment.findMany({
      where: {
        farmId,
        healthPlanId: planId,
        deletedAt: null,
        ...(query.status === 'active'
          ? { status: PlanEnrollmentStatus.ACTIVE }
          : {}),
        ...(animalMatch ? { cattle: animalMatch } : {}),
      },
      orderBy,
      ...getCursorArgs(query),
      select: {
        id: true,
        status: true,
        startDate: true,
        currentStep: true,
        totalSteps: true,
        progressPercentage: true,
        cattle,
        tasks: nextStep,
      },
    });
    return toCursorPage(
      rows.map(({ tasks, ...row }) => ({
        ...row,
        kind: 'ENROLLMENT' as const,
        caseCode: null,
        healthCaseId: null,
        planEnrollmentId: row.id,
        nextStep: tasks[0] ?? null,
      })),
      query,
    );
  }

  async getTaskCalendar(farmId: string, query: HealthTaskCalendarQueryDto) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1));
    const end = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
    const tasks = await this.prisma.healthTask.findMany({
      where: { farmId, deletedAt: null, dueDateTime: { gte: start, lte: end } },
      select: { dueDateTime: true, status: true },
    });
    return this.groupTasksByDate(tasks);
  }

  async completeTask(farmId: string, userId: string, id: string) {
    const task = await this.getTaskOrThrow(farmId, id);
    // Protocols v2: a plan medicine step must never complete without consuming stock + posting cost.
    // If nothing has been logged for it yet, route through the treatment path (which completes it).
    if (
      task.taskType === HealthActionType.MEDICINE &&
      task.medicineId &&
      Number(task.doseAmount) > 0 &&
      task.status !== HealthTaskStatus.COMPLETED &&
      (await this.prisma.treatmentLog.count({
        where: { healthTaskId: id, voidedAt: null },
      })) === 0
    ) {
      if (task.healthCaseId) {
        await this.logTreatment(farmId, userId, task.healthCaseId, {
          healthTaskId: id,
        });
      } else {
        await this.logTaskTreatment(farmId, userId, id, {});
      }
      return this.getTaskOrThrow(farmId, id);
    }
    const updated = await this.prisma.healthTask.update({
      where: { id },
      data: {
        status: HealthTaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: userId,
      },
    });
    // RAKHAL-415: `healthCaseId` is now nullable — a task from a preventive `PlanApplication`
    // round carries `planEnrollmentId` instead and has no case to auto-close.
    if (task.healthCaseId) {
      const autoClosed = await this.updateCaseProgress(
        this.prisma,
        task.healthCaseId,
      );
      await this.notifyCaseAutoClosed(autoClosed, userId);
    } else if (task.planEnrollmentId) {
      await this.updateEnrollmentProgress(this.prisma, task.planEnrollmentId);
    }
    return updated;
  }

  /**
   * RD-093 — `POST /health/tasks/:id/log-treatment`: a caseless (`planEnrollmentId`-only)
   * `HealthTask`'s only route to a real dose used to be `completeTask` (status flip only — no
   * medicine, no stock decrement, no cost). This mirrors `logTreatment`'s own shape (resolve
   * medicine/dose from the DTO or the task's own prefilled values, decrement stock, resolve +
   * require payment for a real cost) but keyed on the task, not a case, since there is no case.
   *
   * `TreatmentLog.healthCaseId`/`SafetyWithdrawal.healthCaseId` both stay required columns (no
   * schema change here — nothing else in the codebase reads them as optional, and making them
   * nullable would cascade into how milk-tank-lock state is even computed without a case, well
   * beyond this ticket's scope). Instead this reuses **`recordTreatment`'s own established
   * pattern** for exactly this situation (RAKHAL-416's Quick Treat, which is also caseless by
   * design): reuse an existing open case for the animal if one exists, else create a lightweight
   * one. The one refinement needed here, since this animal's originating round is preventive, not
   * curative: the created case carries `careType: PREVENTIVE`, not `CURATIVE` — `cattle.service.ts
   * #healthStatusWhere`'s SICK/IN_TREATMENT filter only matches `careType: 'CURATIVE'`, so a
   * PREVENTIVE-careType backing case never makes this animal read as sick, preserving the actual
   * point of RAKHAL-415 (a preventive round must not manufacture "sick" animals) while still
   * satisfying `TreatmentLog`'s schema requirement. Reuse is scoped to an open PREVENTIVE case for
   * this cattle specifically (not any open case) so this never silently attaches a routine dose to
   * an unrelated curative case the animal happens to have open.
   *
   * The task's own `planEnrollmentId` linkage is untouched by this — the created/reused case is
   * purely a technical backing record for the `TreatmentLog`/`SafetyWithdrawal` audit trail, not a
   * new "the task belongs to this case" relationship. Progress still tracks on the `PlanEnrollment`
   * via `updateEnrollmentProgress`, exactly like `completeTask`'s caseless branch already does.
   */
  async logTaskTreatment(
    farmId: string,
    userId: string,
    taskId: string,
    dto: LogTaskTreatmentDto,
  ) {
    const task = await this.getTaskOrThrow(farmId, taskId);
    if (task.healthCaseId) {
      throw new BadRequestException(
        'This task belongs to a case — use POST /health/cases/:id/log-treatment instead',
      );
    }
    if (!task.planEnrollmentId) {
      throw new BadRequestException(
        'Task has neither a case nor a plan enrollment to log a treatment against',
      );
    }

    const cattle = await this.prisma.cattle.findFirst({
      where: { id: task.cattleId, farmId, deletedAt: null },
      select: { id: true, tagNumber: true, name: true, shedId: true },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');

    const medicineId = dto.medicineId ?? task.medicineId ?? undefined;
    const medicineName = dto.medicineName ?? task.medicineName ?? undefined;
    // Protocols v2: with no typed dose, the plan step's own dose (in its own unit) is what is given.
    const typedQuantity = dto.stockDeductionQuantity ?? dto.doseAmount;
    const quantity =
      typedQuantity ??
      (!dto.medicineId && task.doseAmount
        ? Number(task.doseAmount)
        : undefined);
    const doseUnitId =
      typedQuantity === undefined ? (task.doseUnitId ?? undefined) : undefined;

    // Resolve withdrawal days from the `Medicine` record itself — mirrors
    // `recordTreatment`'s auto-derivation (Quick Treat), not `logTreatment`'s manual dto-typed
    // withdrawal days: this route is always driven by a real medicine (the plan step's own
    // `medicineId`), so there is no reason to make the caller re-type numbers the medicine
    // already carries. `dto.milkWithdrawalDays`/`meatWithdrawalDays` still work as an explicit
    // override when given. RAKHAL-437 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`): cost is no longer
    // pre-read off `Medicine.costPerUnit` here — it's resolved from
    // `decrementForTreatment`'s own `totalCost`, priced off the actual batch(es) drawn (accurate
    // under a cross-batch split, unlike a single product-level number). This also closes the gap
    // this comment used to describe (`logTreatment`'s ordering, RAKHAL-419) — `decrementForTreatment`
    // is atomic and throws before writing anything, so there was never a real "committed decrement,
    // no rollback" risk once cost resolution is just a field read off its return, not a DB call.
    let milkWithdrawalDays: number | undefined;
    let meatWithdrawalDays: number | undefined;
    if (medicineId) {
      const medicine = await this.prisma.medicine.findFirst({
        where: { id: medicineId, farmId, deletedAt: null },
        select: { milkWithdrawalDays: true, meatWithdrawalDays: true },
      });
      milkWithdrawalDays = medicine?.milkWithdrawalDays || undefined;
      meatWithdrawalDays = medicine?.meatWithdrawalDays || undefined;
    }

    const deduction =
      quantity && quantity > 0 && (medicineId || medicineName)
        ? await this.medicineService.decrementForTreatment(farmId, userId, {
            medicineId,
            medicineName,
            quantity,
            doseUnitId,
            notes: `Preventive-round treatment for task ${task.taskCode}`,
          })
        : null;
    const resolvedCost = deduction?.totalCost ?? 0;

    // Rare fallback: only `medicineName` was given (no id resolvable upfront) — the real
    // product/withdrawal-days aren't known until `decrementForTreatment` picks a batch. Never hit
    // for a plan-derived task in practice.
    if (!medicineId && deduction) {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: deduction.medicineId },
        select: { milkWithdrawalDays: true, meatWithdrawalDays: true },
      });
      milkWithdrawalDays = medicine?.milkWithdrawalDays || undefined;
      meatWithdrawalDays = medicine?.meatWithdrawalDays || undefined;
    }

    const administeredAt = dto.administeredAt
      ? new Date(dto.administeredAt)
      : new Date();

    const { treatmentLog, withdrawal } = await this.prisma.$transaction(
      async (tx) => {
        const backingCase =
          (await tx.healthCase.findFirst({
            where: {
              farmId,
              cattleId: task.cattleId,
              careType: HealthCareType.PREVENTIVE,
              status: { in: ACTIVE_CASE_STATUSES },
            },
            orderBy: { startDate: 'desc' },
          })) ??
          (await tx.healthCase.create({
            data: {
              farmId,
              cattleId: task.cattleId,
              caseCode: await this.nextCaseCode(farmId, tx),
              note: task.title || 'Preventive round treatment',
              careType: HealthCareType.PREVENTIVE,
              priority: HealthPriority.LOW,
              shedId: cattle.shedId,
              startDate: administeredAt,
            },
          }));

        const treatmentLog = await tx.treatmentLog.create({
          data: {
            farmId,
            cattleId: task.cattleId,
            healthCaseId: backingCase.id,
            healthTaskId: task.id,
            medicineId: deduction?.medicineId ?? medicineId,
            medicineName: dto.medicineName ?? task.medicineName,
            doseAmount: dto.doseAmount ?? task.doseAmount ?? undefined,
            doseUnit: dto.doseUnit ?? task.doseUnit ?? undefined,
            route: dto.route ?? task.route ?? undefined,
            administeredAt,
            administeredBy: dto.administeredBy ?? userId,
            stockDeducted: Boolean(deduction),
            stockDeductionQuantity: deduction
              ? quantity
              : dto.stockDeductionQuantity,
            batchNo: deduction?.batchId ?? dto.batchNo,
            notes: dto.notes,
          },
        });

        await this.stampMovements(tx, deduction?.movementIds, treatmentLog.id);
        await tx.healthTask.update({
          where: { id: task.id },
          data: {
            status: HealthTaskStatus.COMPLETED,
            completedAt: treatmentLog.administeredAt,
            completedBy: dto.administeredBy ?? userId,
          },
        });
        await this.updateEnrollmentProgress(tx, task.planEnrollmentId!);

        const withdrawal = await this.createSafetyWithdrawalIfNeeded(
          tx,
          backingCase,
          treatmentLog,
          {
            milkWithdrawalDays: dto.milkWithdrawalDays ?? milkWithdrawalDays,
            meatWithdrawalDays: dto.meatWithdrawalDays ?? meatWithdrawalDays,
          },
        );

        return { treatmentLog, withdrawal };
      },
    );

    if (resolvedCost > 0) {
      const posted = await this.expenseService.recordInventoryConsumption(
        farmId,
        userId,
        {
          category: ExpenseCategory.HEALTH,
          description: `Medicine — Task ${task.taskCode}`,
          amount: resolvedCost,
          expenseDate: treatmentLog.administeredAt.toISOString(),
          cattleId: task.cattleId,
        },
      );
      await this.prisma.treatmentLog.update({
        where: { id: treatmentLog.id },
        data: { financeTransactionId: posted.id },
      });
    }

    await this.aqrService.applyEvent(
      farmId,
      task.cattleId,
      'treatment_completed',
      {
        actorId: userId,
        actionDetails: `Preventive-round treatment administered for task [${task.taskCode}].`,
      },
    );

    if (withdrawal) {
      const label = cattle.name ?? cattle.tagNumber;
      const milkUntil = withdrawal.milkWithdrawalUntil
        ?.toISOString()
        .slice(0, 10);
      const meatUntil = withdrawal.meatWithdrawalUntil
        ?.toISOString()
        .slice(0, 10);
      await this.notificationService.notifyOwnersAndManagers({
        farmId,
        eventKey: 'withholding_active',
        title: 'Withholding Period Active',
        message: `${label}${cattle.tagNumber ? ` (${cattle.tagNumber})` : ''} is under withdrawal${milkUntil ? ` — milk until ${milkUntil}` : ''}${meatUntil ? `, meat until ${meatUntil}` : ''}.`,
        params: {
          name: label,
          tagNumber: cattle.tagNumber,
          milkUntil: milkUntil ?? '',
          meatUntil: meatUntil ?? '',
        },
        link: `/healthcare/cases/${treatmentLog.healthCaseId}`,
        dedupeKey: `withholding_active:${withdrawal.id}`,
      });
    }

    this.log.info('Preventive-round task treatment logged', {
      farmId,
      taskId: task.id,
      treatmentLogId: treatmentLog.id,
    });

    return { treatmentLog, withdrawal };
  }

  async rescheduleTask(
    farmId: string,
    id: string,
    dto: RescheduleHealthTaskDto,
  ) {
    const task = await this.getTaskOrThrow(farmId, id);
    return this.prisma.healthTask.update({
      where: { id },
      data: {
        status: HealthTaskStatus.RESCHEDULED,
        rescheduledFrom: task.dueDateTime,
        rescheduledTo: new Date(dto.newDueDateTime),
        dueDateTime: new Date(dto.newDueDateTime),
        taskDate: new Date(dto.newDueDateTime),
        notes: dto.reason,
      },
    });
  }

  async skipTask(farmId: string, id: string, dto: SkipHealthTaskDto) {
    await this.getTaskOrThrow(farmId, id);
    return this.prisma.healthTask.update({
      where: { id },
      data: { status: HealthTaskStatus.SKIPPED, notes: dto.reason },
    });
  }

  /**
   * Every protocol one animal is on right now (cow-side view of `getPlanRuns`): treatment protocols running on its open
   * sickness cases plus its active preventive / breeding enrollments, soonest next step first. Pure read.
   */
  async getCattleProtocols(farmId: string, cattleId: string) {
    await this.assertCattleInFarm(farmId, cattleId);
    const openSteps = {
      where: {
        deletedAt: null,
        status: {
          in: [
            HealthTaskStatus.PENDING,
            HealthTaskStatus.RESCHEDULED,
            HealthTaskStatus.OVERDUE,
          ],
        },
      },
      orderBy: { dueDateTime: 'asc' as const },
      take: 1,
      select: { id: true, title: true, dueDateTime: true, status: true },
    };
    const plan = { select: { id: true, name: true, category: true } };
    const [cases, enrollments] = await Promise.all([
      this.prisma.healthCase.findMany({
        where: {
          farmId,
          cattleId,
          deletedAt: null,
          healthPlanId: { not: null },
          status: { in: ACTIVE_CASE_STATUSES },
        },
        select: {
          id: true,
          caseCode: true,
          startDate: true,
          currentStep: true,
          totalSteps: true,
          progressPercentage: true,
          healthPlan: plan,
          tasks: openSteps,
        },
      }),
      this.prisma.planEnrollment.findMany({
        where: {
          farmId,
          cattleId,
          deletedAt: null,
          status: PlanEnrollmentStatus.ACTIVE,
        },
        select: {
          id: true,
          startDate: true,
          currentStep: true,
          totalSteps: true,
          progressPercentage: true,
          healthPlan: plan,
          tasks: openSteps,
        },
      }),
    ]);
    const items = [
      ...cases.map((c) => ({
        runType: 'CASE' as const,
        id: c.id,
        healthCaseId: c.id,
        planEnrollmentId: null,
        caseCode: c.caseCode,
        healthPlan: c.healthPlan,
        startDate: c.startDate,
        currentStep: c.currentStep,
        totalSteps: c.totalSteps,
        progressPercentage: c.progressPercentage,
        nextStep: c.tasks[0] ?? null,
      })),
      ...enrollments.map((e) => ({
        runType: 'ENROLLMENT' as const,
        id: e.id,
        healthCaseId: null,
        planEnrollmentId: e.id,
        caseCode: null,
        healthPlan: e.healthPlan,
        startDate: e.startDate,
        currentStep: e.currentStep,
        totalSteps: e.totalSteps,
        progressPercentage: e.progressPercentage,
        nextStep: e.tasks[0] ?? null,
      })),
    ].filter((r) => r.healthPlan !== null);
    items.sort((a, b) => {
      if (!a.nextStep && !b.nextStep) return 0;
      if (!a.nextStep) return 1;
      if (!b.nextStep) return -1;
      return (
        a.nextStep.dueDateTime.getTime() - b.nextStep.dueDateTime.getTime()
      );
    });
    return { items };
  }

  /**
   * Take one animal off one protocol: its remaining open steps are skipped (never silently deleted — they stay in the
   * history as SKIPPED with the reason), then
   *  - a case run keeps the case open but loses its protocol (`healthPlanId` cleared, progress reset), so the sick
   *    animal stays in Sick Bay for manual care;
   *  - an enrollment is soft-deleted (the animal leaves the round).
   * Exactly one of `healthCaseId` / `planEnrollmentId`.
   */
  async stopCattleProtocol(
    farmId: string,
    cattleId: string,
    dto: StopCattleProtocolDto,
  ) {
    if (Boolean(dto.healthCaseId) === Boolean(dto.planEnrollmentId)) {
      throw new BadRequestException(
        'Send exactly one of healthCaseId or planEnrollmentId',
      );
    }
    await this.assertCattleInFarm(farmId, cattleId);
    const note = dto.reason
      ? `Protocol stopped: ${dto.reason}`
      : 'Protocol stopped';
    const openStatuses = [
      HealthTaskStatus.PENDING,
      HealthTaskStatus.RESCHEDULED,
      HealthTaskStatus.OVERDUE,
    ];

    if (dto.healthCaseId) {
      const healthCase = await this.prisma.healthCase.findFirst({
        where: {
          id: dto.healthCaseId,
          farmId,
          cattleId,
          deletedAt: null,
          healthPlanId: { not: null },
        },
        select: { id: true },
      });
      if (!healthCase) {
        throw new NotFoundException('That animal is not on this protocol');
      }
      await this.prisma.$transaction([
        this.prisma.healthTask.updateMany({
          where: {
            farmId,
            healthCaseId: healthCase.id,
            healthPlanId: { not: null },
            deletedAt: null,
            status: { in: openStatuses },
          },
          data: { status: HealthTaskStatus.SKIPPED, notes: note },
        }),
        this.prisma.healthCase.update({
          where: { id: healthCase.id },
          data: {
            healthPlanId: null,
            currentStep: 0,
            totalSteps: 0,
            progressPercentage: 0,
          },
        }),
      ]);
      this.log.info('Protocol stopped on case', {
        cattleId,
        healthCaseId: healthCase.id,
      });
      return { healthCaseId: healthCase.id, planEnrollmentId: null };
    }

    const enrollment = await this.prisma.planEnrollment.findFirst({
      where: {
        id: dto.planEnrollmentId,
        farmId,
        cattleId,
        deletedAt: null,
        status: PlanEnrollmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new NotFoundException('That animal is not on this protocol');
    }
    await this.prisma.$transaction([
      this.prisma.healthTask.updateMany({
        where: {
          farmId,
          planEnrollmentId: enrollment.id,
          deletedAt: null,
          status: { in: openStatuses },
        },
        data: { status: HealthTaskStatus.SKIPPED, notes: note },
      }),
      this.prisma.planEnrollment.update({
        where: { id: enrollment.id },
        data: { deletedAt: new Date() },
      }),
    ]);
    this.log.info('Protocol stopped on enrollment', {
      cattleId,
      planEnrollmentId: enrollment.id,
    });
    return { healthCaseId: null, planEnrollmentId: enrollment.id };
  }

  async getCattleHealthSummary(farmId: string, cattleId: string) {
    await this.assertCattleInFarm(farmId, cattleId);
    const [activeCases, treatmentHistory, activeWithdrawals, mortality] =
      await Promise.all([
        this.prisma.healthCase.findMany({
          where: {
            cattleId,
            farmId,
            deletedAt: null,
            status: { in: ACTIVE_CASE_STATUSES },
          },
          include: {
            // RFE-136: the cow's Health tab shows which protocol each case is on.
            healthPlan: { select: { id: true, name: true } },
            tasks: {
              where: { status: HealthTaskStatus.PENDING },
              orderBy: { dueDateTime: 'asc' },
              take: 1,
            },
          },
        }),
        this.prisma.treatmentLog.findMany({
          where: { cattleId, farmId, voidedAt: null },
          orderBy: { administeredAt: 'desc' },
          take: 20,
        }),
        this.prisma.safetyWithdrawal.findMany({
          where: {
            cattleId,
            farmId,
            status: {
              in: [
                SafetyWithdrawalStatus.ACTIVE,
                SafetyWithdrawalStatus.READY_FOR_RELEASE,
              ],
            },
          },
        }),
        this.prisma.mortalityRecord.findFirst({
          where: { cattleId, farmId },
          orderBy: { deathDate: 'desc' },
        }),
      ]);
    return {
      activeCases,
      ongoingTreatment: activeCases.some(
        (c) => c.careType === HealthCareType.CURATIVE,
      ),
      treatmentProgress: activeCases.map((healthCase) => ({
        healthCaseId: healthCase.id,
        progressPercentage: healthCase.progressPercentage,
      })),
      treatmentHistory,
      safetyWithdrawalWarning: activeWithdrawals.length > 0,
      activeWithdrawals,
      vaccinationHistory: treatmentHistory.filter((log) =>
        log.notes?.toLowerCase().includes('vaccin'),
      ),
      dewormingHistory: treatmentHistory.filter((log) =>
        log.notes?.toLowerCase().includes('deworm'),
      ),
      mortalityStatus: mortality,
    };
  }

  /**
   * Single source of truth for "is this cow's milk currently withheld" — shared
   * across modules so the rule can't drift (previously the Milk module
   * duplicated this exact query independently).
   *
   * RAKHAL-276 (v2 correction): this is a **pure read** — it must never call
   * `.update()`/`.updateMany()` on `SafetyWithdrawal`. v1's design had this
   * method silently flip an expired-but-unconfirmed withdrawal's status as a
   * query side effect (mutate-on-read), which is exactly the bug this ticket
   * exists to fix — see `SchedulerService.runDailySweeps`'s
   * `sweepSafetyWithdrawalsReadyForRelease` for where that transition
   * actually belongs. A cow counts as withholding if it has a withdrawal
   * that's `ACTIVE`/`READY_FOR_RELEASE` (status hasn't reached `RELEASED`
   * yet, however it got there), OR is `ACTIVE` and past its `until` date but
   * the daily sweep hasn't caught up to flip it to `READY_FOR_RELEASE` yet —
   * "past-due but not yet swept" must still block milk sale.
   *
   * RAKHAL-290 (verified): this is the single source `MilkService.saveLog()`
   * calls to gate `disposition`/`tankType` on every write — there is no
   * second, looser withholding check anywhere else in the milk write path
   * for a caller to fall through to.
   */
  async activeMilkWithholdingCattleIds(
    farmId: string,
    cattleIds: string[],
  ): Promise<Set<string>> {
    if (cattleIds.length === 0) return new Set();
    const now = new Date();
    const rows = await this.prisma.safetyWithdrawal.findMany({
      where: {
        farmId,
        cattleId: { in: cattleIds },
        // Only rows that actually restrict milk (a meat-only withdrawal has
        // milkWithdrawalUntil: null and shouldn't block milk sale).
        milkWithdrawalUntil: { not: null },
        OR: [
          // Still within its window, or confirmed-past-due-but-unreleased —
          // either way, status alone says "still withholding".
          {
            status: {
              in: [
                SafetyWithdrawalStatus.ACTIVE,
                SafetyWithdrawalStatus.READY_FOR_RELEASE,
              ],
            },
          },
          // Past-due but the daily sweep hasn't run/caught up yet — must
          // still count, not silently drop off just because `until` elapsed.
          {
            status: SafetyWithdrawalStatus.ACTIVE,
            milkWithdrawalUntil: { lte: now },
          },
        ],
      },
      select: { cattleId: true },
    });
    return new Set(rows.map((r) => r.cattleId));
  }

  /** RAKHAL-420: whole days remaining until `until`, clamped to 0 once past — never negative, so
   * the milk room reads "0 days" rather than "-2 days" once a hold has expired. `null` when the
   * row never carried this kind of withdrawal at all (e.g. a milk-only medicine's meat side). */
  private daysRemaining(until: Date | null): number | null {
    if (!until) return null;
    const ms = until.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  async getSafetyWithdrawals(farmId: string, query: SafetyWithdrawalQueryDto) {
    const where: Prisma.SafetyWithdrawalWhereInput = {
      farmId,
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.activeOnly
        ? {
            status: {
              in: [
                SafetyWithdrawalStatus.ACTIVE,
                SafetyWithdrawalStatus.READY_FOR_RELEASE,
              ],
            },
          }
        : {}),
    };
    const rows = await this.prisma.safetyWithdrawal.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        cattle: {
          select: { id: true, name: true, tagNumber: true, image: true },
        },
        healthCase: { select: { caseCode: true } },
        // Resolved through the treatment's own snapshot, not a live Medicine join — a medicine
        // archived after the treatment must still show the name it was actually given under.
        treatmentLog: { select: { medicineName: true } },
      },
    });
    const projected = rows.map((row) => ({
      ...row,
      medicineName: row.treatmentLog?.medicineName ?? null,
      caseCode: row.healthCase.caseCode,
      milkDaysRemaining: this.daysRemaining(row.milkWithdrawalUntil),
      meatDaysRemaining: this.daysRemaining(row.meatWithdrawalUntil),
    }));
    return toCursorPage(projected, query);
  }

  /**
   * Farm-scoped wrapper for the explicit `POST
   * /health/safety-withdrawals/refresh` route — an explicit, user-triggered
   * action, not a read-path side effect, so mutating here is fine.
   */
  async refreshSafetyWithdrawals(farmId: string) {
    return this.sweepWithdrawalsReadyForRelease(farmId);
  }

  /**
   * RAKHAL-276: the *only* place `ACTIVE` -> `READY_FOR_RELEASE` happens.
   * Called with no `farmId` from `SchedulerService.runDailySweeps()` (every
   * farm, once a day) and with a `farmId` from the manual refresh route
   * above. Never called from a read path (see `activeMilkWithholdingCattleIds`'s
   * doc comment for the bug this replaced).
   */
  async sweepWithdrawalsReadyForRelease(
    farmId?: string,
  ): Promise<{ updated: number }> {
    const now = new Date();
    const result = await this.prisma.safetyWithdrawal.updateMany({
      where: {
        ...(farmId ? { farmId } : {}),
        status: SafetyWithdrawalStatus.ACTIVE,
        OR: [
          { milkWithdrawalUntil: { lte: now } },
          { meatWithdrawalUntil: { lte: now } },
        ],
      },
      data: { status: SafetyWithdrawalStatus.READY_FOR_RELEASE },
    });
    return { updated: result.count };
  }

  /**
   * RAKHAL-276: the *only* path to `RELEASED` — an explicit, audited action
   * (never a side effect of a read or of the daily sweep). Idempotent: an
   * already-`RELEASED` withdrawal is returned as-is rather than erroring
   * (mirrors the `AnimalHoldService.releaseHold` precedent); an already-
   * `CANCELLED` one 400s, since releasing something voided doesn't make sense.
   *
   * Audited via `ActivityLogService` (not `AuditService`), same call this
   * repo already made for `AnimalHoldService.releaseHold` (RAKHAL-280):
   * `AuditService`'s backing `AuditAction` enum
   * (`prisma/schemas/audit/audit-enums.prisma`) is a closed set of
   * auth/billing/admin-account events with no generic farm-domain-event
   * member, and that schema file is out of this ticket's Lane. `ActivityLogService`
   * is this repo's cross-cutting engine for exactly this kind of farm-domain
   * event (free-text `eventTitle`/`actionDetails`, no schema change needed).
   */
  async releaseWithdrawal(farmId: string, id: string, releasedBy: string) {
    const withdrawal = await this.prisma.safetyWithdrawal.findFirst({
      where: { id, farmId },
    });
    if (!withdrawal) {
      throw new NotFoundException('Safety withdrawal not found');
    }
    if (withdrawal.status === SafetyWithdrawalStatus.RELEASED) {
      return withdrawal;
    }
    if (withdrawal.status === SafetyWithdrawalStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot release a cancelled safety withdrawal',
      );
    }

    const updated = await this.prisma.safetyWithdrawal.update({
      where: { id },
      data: { status: SafetyWithdrawalStatus.RELEASED },
    });

    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.HEALTH_SAFETY,
      eventTitle: 'Safety withdrawal released',
      actionDetails: `Milk/meat withholding released for safety withdrawal ${id} (was ${withdrawal.status}).`,
      actorId: releasedBy,
      relatedCattleId: withdrawal.cattleId,
    });

    return updated;
  }

  private async createSafetyWithdrawalIfNeeded(
    tx: Prisma.TransactionClient,
    healthCase: { id: string; cattleId: string; farmId: string },
    treatmentLog: {
      id: string;
      medicineId: string | null;
      administeredAt: Date;
    },
    dto: LogTreatmentDto,
  ) {
    if (!dto.milkWithdrawalDays && !dto.meatWithdrawalDays) return null;
    const milkWithdrawalUntil = dto.milkWithdrawalDays
      ? this.addDays(treatmentLog.administeredAt, dto.milkWithdrawalDays)
      : undefined;
    const meatWithdrawalUntil = dto.meatWithdrawalDays
      ? this.addDays(treatmentLog.administeredAt, dto.meatWithdrawalDays)
      : undefined;
    const withdrawal = await tx.safetyWithdrawal.create({
      data: {
        farmId: healthCase.farmId,
        cattleId: healthCase.cattleId,
        healthCaseId: healthCase.id,
        treatmentLogId: treatmentLog.id,
        medicineId: treatmentLog.medicineId,
        milkWithdrawalUntil,
        meatWithdrawalUntil,
        safeMilkDate: milkWithdrawalUntil,
        safeMeatDate: meatWithdrawalUntil,
      },
    });
    await tx.healthCase.update({
      where: { id: healthCase.id },
      data: {
        isSafetyWithholdingActive: true,
        milkWithdrawalUntil,
        meatWithdrawalUntil,
      },
    });
    return withdrawal;
  }

  /**
   * RAKHAL-417: also auto-closes the case when its protocol finishes. `total` counts
   * non-`SKIPPED` tasks only — a skipped step must not permanently cap progress below
   * 100 % (the old query counted every task regardless of status, so a single skipped
   * step meant the case could never read "done"). Only a case that got its tasks from
   * a plan auto-closes: `totalSteps === 0` (a hand-opened case with no protocol) must
   * never be misread as "all done", and neither `total`/`completed` being `0` (nothing
   * to do yet) qualifies.
   *
   * Deliberately does **not** fire the AQR event itself: this runs with whatever
   * client the caller passed (often a still-open `$transaction` callback's `tx`),
   * and `AqrService` always writes through its own injected `PrismaService` — firing
   * from inside an uncommitted outer transaction would run on a second connection
   * against not-yet-committed rows. Returns the auto-close outcome instead, so each
   * caller fires the AQR event itself after its own transaction has committed, the
   * same place `logTreatment`/`recordTreatment` already fire their own AQR events.
   */
  private async updateCaseProgress(
    tx: Prisma.TransactionClient | PrismaService,
    healthCaseId: string,
  ): Promise<{
    farmId: string;
    cattleId: string;
    caseCode: string;
  } | null> {
    const [healthCase, total, completed] = await Promise.all([
      tx.healthCase.findUniqueOrThrow({
        where: { id: healthCaseId },
        select: {
          farmId: true,
          cattleId: true,
          caseCode: true,
          healthPlanId: true,
          status: true,
        },
      }),
      tx.healthTask.count({
        where: {
          healthCaseId,
          deletedAt: null,
          status: { not: HealthTaskStatus.SKIPPED },
        },
      }),
      tx.healthTask.count({
        where: {
          healthCaseId,
          status: HealthTaskStatus.COMPLETED,
          deletedAt: null,
        },
      }),
    ]);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const shouldAutoClose =
      total > 0 &&
      completed === total &&
      healthCase.healthPlanId !== null &&
      (ACTIVE_CASE_STATUSES as HealthCaseStatus[]).includes(healthCase.status);

    await tx.healthCase.update({
      where: { id: healthCaseId },
      data: shouldAutoClose
        ? {
            totalSteps: total,
            currentStep: completed,
            progressPercentage: 100,
            status: HealthCaseStatus.CLOSED,
            closedDate: new Date(),
            closeReason: 'protocol_completed',
            deletedAt: new Date(),
          }
        : {
            totalSteps: total,
            currentStep: completed,
            progressPercentage: progress,
          },
    });

    return shouldAutoClose
      ? {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          caseCode: healthCase.caseCode,
        }
      : null;
  }

  /** RAKHAL-415's caseless counterpart of `updateCaseProgress` — a `PlanEnrollment` has no
   * diagnosis/close-reason to set, so this only recomputes step counts and flips ACTIVE→COMPLETED
   * once every non-skipped task is done. Deliberately no AQR/auto-close notification: that trail is
   * specific to a `HealthCase` closing, and finishing a preventive round isn't the same event —
   * not a gap, a different event that doesn't need one. */
  private async updateEnrollmentProgress(
    tx: Prisma.TransactionClient | PrismaService,
    planEnrollmentId: string,
  ): Promise<void> {
    const [total, completed] = await Promise.all([
      tx.healthTask.count({
        where: {
          planEnrollmentId,
          deletedAt: null,
          status: { not: HealthTaskStatus.SKIPPED },
        },
      }),
      tx.healthTask.count({
        where: {
          planEnrollmentId,
          status: HealthTaskStatus.COMPLETED,
          deletedAt: null,
        },
      }),
    ]);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    await tx.planEnrollment.update({
      where: { id: planEnrollmentId },
      data: {
        totalSteps: total,
        currentStep: completed,
        progressPercentage: progress,
        status:
          total > 0 && completed === total
            ? PlanEnrollmentStatus.COMPLETED
            : PlanEnrollmentStatus.ACTIVE,
      },
    });
  }

  /**
   * Fires once a case has actually auto-closed (see `updateCaseProgress`'s return),
   * always after the caller's own transaction has committed. Same AQR/Activity trail
   * a manual "Recovered" close fires (`closeCase`) — an active `SafetyWithdrawal` is
   * untouched by this (it lives on its own table, not gated by the case's
   * `deletedAt`), so a completed protocol's withholding hold keeps showing on Safety
   * Withdrawals as required.
   */
  private async notifyCaseAutoClosed(
    autoClosed: { farmId: string; cattleId: string; caseCode: string } | null,
    actorId: string,
  ) {
    if (!autoClosed) return;
    await this.aqrService.applyEvent(
      autoClosed.farmId,
      autoClosed.cattleId,
      'recovered',
      {
        actorId,
        actionDetails: `Case [${autoClosed.caseCode}] auto-closed — protocol completed.`,
      },
    );
    this.log.info('Health case auto-closed on protocol completion', {
      caseCode: autoClosed.caseCode,
      farmId: autoClosed.farmId,
    });
  }

  // Mutation entry point only (update/apply-plan/log-treatment/close/mortality) —
  // deletedAt:null so no path can act on an already-closed/archived case.
  private async getCaseOrThrow(farmId: string, id: string) {
    const healthCase = await this.prisma.healthCase.findFirst({
      where: { id, farmId, deletedAt: null },
    });
    if (!healthCase) throw new NotFoundException('Health case not found');
    return healthCase;
  }

  private async getTaskOrThrow(farmId: string, id: string) {
    const task = await this.prisma.healthTask.findFirst({
      where: { id, farmId, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Health task not found');
    return task;
  }

  private async assertCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
    });
    if (!cattle) throw new BadRequestException('Cattle must belong to Farm');
    return cattle;
  }

  private async assertShedInFarm(farmId: string, shedId: string) {
    const shed = await this.prisma.shed.findFirst({
      where: { id: shedId, farmId, deletedAt: null },
    });
    if (!shed) throw new BadRequestException('Shed must belong to Farm');
    return shed;
  }

  private caseInclude() {
    return {
      cattle: {
        select: {
          id: true,
          name: true,
          tagNumber: true,
          image: true,
          herdStatus: true,
        },
      },
      healthPlan: { select: { id: true, name: true } },
    } satisfies Prisma.HealthCaseInclude;
  }

  private calculateHerdHealthScore(healthy: number, total: number) {
    if (total === 0) return 100;
    return Math.round((healthy / total) * 100);
  }

  /**
   * RAKHAL-419: the dashboard's `medicineExpense` tile — an all-time sum,
   * matching every other metric on this dashboard (none of them are
   * period-scoped; the route has no date-range query param). Excludes a
   * reversed expense (`ExpenseService.reverseExpense`, fired on treatment
   * edit/void) the same way `cattle-finance-aggregation.ts#
   * sumUnreversedExpense` does for the per-animal breakdown — duplicated
   * rather than cross-imported from the `cattle` module, matching this
   * codebase's existing precedent of small per-module reversal checks
   * rather than a shared cross-domain util.
   */
  private async sumHealthExpense(farmId: string): Promise<number> {
    const rows = await this.prisma.expense.findMany({
      where: { farmId, category: ExpenseCategory.HEALTH },
      select: { id: true, amount: true },
    });
    if (rows.length === 0) return 0;

    const journalTxns = await this.prisma.journalTransaction.findMany({
      where: {
        farmId,
        sourceType: 'EXPENSE',
        sourceId: { in: rows.map((r) => r.id) },
        reversalOfId: null,
      },
      select: { id: true, sourceId: true },
    });
    const journalIdByExpenseId = new Map(
      journalTxns.map((j) => [j.sourceId, j.id]),
    );
    const reversals = await this.prisma.journalTransaction.findMany({
      where: { farmId, reversalOfId: { in: journalTxns.map((j) => j.id) } },
      select: { reversalOfId: true },
    });
    const reversedJournalIds = new Set(
      reversals.map((r) => r.reversalOfId as string),
    );
    const unreversed = rows.filter((r) => {
      const journalId = journalIdByExpenseId.get(r.id);
      return !journalId || !reversedJournalIds.has(journalId);
    });
    return unreversed.reduce((sum, r) => sum + Number(r.amount), 0);
  }

  private groupByDay(dates: Date[]) {
    const grouped = new Map<string, number>();
    for (const date of dates) {
      const key = date.toISOString().slice(0, 10);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return [...grouped.entries()].map(([date, count]) => ({ date, count }));
  }

  private groupTasksByDate(
    tasks: Array<{ dueDateTime: Date; status: HealthTaskStatus }>,
  ) {
    const grouped = new Map<string, Record<string, number>>();
    for (const task of tasks) {
      const key = task.dueDateTime.toISOString().slice(0, 10);
      const row = grouped.get(key) ?? {};
      row[task.status] = (row[task.status] ?? 0) + 1;
      grouped.set(key, row);
    }
    return [...grouped.entries()].map(([date, counts]) => ({ date, counts }));
  }

  /** A step that would already be past is due at `floor` instead (joining a round late must not back-date history). */
  private dueNoEarlierThan(due: Date, floor?: Date): Date {
    return floor && due < floor ? floor : due;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
