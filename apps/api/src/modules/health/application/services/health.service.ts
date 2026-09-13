import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattleDispositionType,
  ClinicalProgress,
  ExpenseCategory,
  HealthCaseStatus,
  HealthCloseOutcome,
  HealthDiagnosisType,
  HealthPlanCategory,
  HealthPriority,
  HealthTaskStatus,
  Prisma,
  SafetyWithdrawalStatus,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { MedicineService } from 'src/modules/inventory/application/services/medicine.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { CattleService } from 'src/modules/cattle/application/services/cattle.service';
import { ExpenseService } from 'src/modules/purchasing/application/expense.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import {
  PREVENTIVE_DIAGNOSIS_TYPES,
  isPreventiveDiagnosisType,
} from 'src/modules/cattle/domain/health-status';
import {
  ApplyHealthPlanDto,
  CloseHealthCaseDto,
  CreateHealthUpdateDto,
  LogTreatmentDto,
  MortalityDto,
  RecordTreatmentDto,
  RescheduleHealthTaskDto,
  SkipHealthTaskDto,
} from '../../presentation/dto/case-actions.dto';
import { CreateHealthCaseDto } from '../../presentation/dto/create-health-case.dto';
import {
  AppliedPlansQueryDto,
  HealthPlanQueryDto,
  HealthTaskCalendarQueryDto,
  HealthTaskQueryDto,
  SafetyWithdrawalQueryDto,
  SickBayQueryDto,
} from '../../presentation/dto/health-query.dto';
import {
  ApplyPlanToAnimalsDto,
  CreateHealthPlanDto,
  UpdateHealthPlanDto,
} from '../../presentation/dto/health-plan.dto';
import { UpdateHealthCaseDto } from '../../presentation/dto/update-health-case.dto';

const ACTIVE_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/** Mirrors the frontend's `CATEGORY_TO_DIAGNOSIS_TYPE` (`apply-health-plan-dialog.tsx`) — the
 * bulk-apply case (RAKHAL-414) needs the same mapping server-side instead of trusting a
 * client-supplied `diagnosisType` for a case it creates on the caller's behalf. */
const PLAN_CATEGORY_TO_DIAGNOSIS_TYPE: Record<
  HealthPlanCategory,
  HealthDiagnosisType
> = {
  TREATMENT: HealthDiagnosisType.DISEASE,
  PREVENTION: HealthDiagnosisType.PREVENTIVE,
  BREEDING: HealthDiagnosisType.BREEDING_RELATED,
  VACCINATION: HealthDiagnosisType.VACCINATION,
  DEWORMING: HealthDiagnosisType.DEWORMING,
  ROUTINE: HealthDiagnosisType.ROUTINE_CHECKUP,
};

/**
 * Healthcare service (PRD §13). Farm-scoped: `farmId` is supplied by the
 * controller from the verified token context (`FarmContextGuard`), so every
 * query is scoped to it and no cross-tenant access is possible. Domain events
 * feed the live AQR/Activity engines: reporting sickness emits −10, recovery
 * +5, and mortality nullifies the score (PRD §19.2).
 */
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
  ) {
    this.log = this.logger.setContext(HealthService.name);
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
          diagnosisType: {
            notIn:
              PREVENTIVE_DIAGNOSIS_TYPES as unknown as HealthDiagnosisType[],
          },
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
      this.prisma.healthCase.groupBy({
        by: ['diagnosis'],
        where: {
          farmId,
          deletedAt: null,
          diagnosisType: {
            notIn:
              PREVENTIVE_DIAGNOSIS_TYPES as unknown as HealthDiagnosisType[],
          },
        },
        _count: { diagnosis: true },
      }),
      this.prisma.healthCase.groupBy({
        by: ['shedName'],
        where: {
          farmId,
          deletedAt: null,
          diagnosisType: {
            notIn:
              PREVENTIVE_DIAGNOSIS_TYPES as unknown as HealthDiagnosisType[],
          },
        },
        _count: { shedName: true },
      }),
      this.prisma.healthCase.findMany({
        where: {
          farmId,
          deletedAt: null,
          diagnosisType: {
            notIn:
              PREVENTIVE_DIAGNOSIS_TYPES as unknown as HealthDiagnosisType[],
          },
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
        diagnosis: row.diagnosis,
        count: row._count.diagnosis,
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
    const where: Prisma.HealthCaseWhereInput = {
      farmId,
      deletedAt: null,
      status: query.status ?? { in: ACTIVE_CASE_STATUSES },
      diagnosisType: {
        notIn: PREVENTIVE_DIAGNOSIS_TYPES as unknown as HealthDiagnosisType[],
      },
      ...(query.search
        ? {
            OR: [
              { diagnosis: { contains: query.search, mode: 'insensitive' } },
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
          }
        : {}),
      ...(query.shed
        ? { shedName: { contains: query.shed, mode: 'insensitive' } }
        : {}),
      ...(query.diagnosis
        ? { diagnosis: { contains: query.diagnosis, mode: 'insensitive' } }
        : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
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

    const duplicate = await this.prisma.healthCase.findFirst({
      where: {
        farmId,
        cattleId: dto.cattleId,
        diagnosis: { equals: dto.diagnosis, mode: 'insensitive' },
        status: { in: ACTIVE_CASE_STATUSES },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Active health case already exists for this diagnosis',
      );
    }

    const healthCase = await this.createCaseWithCode(farmId, (caseCode) => ({
      data: {
        farmId,
        cattleId: dto.cattleId,
        caseCode,
        diagnosis: dto.diagnosis,
        condition: dto.condition,
        diagnosisType: dto.diagnosisType,
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

    if (!isPreventiveDiagnosisType(dto.diagnosisType)) {
      // AQR: Animal Sickness Reported (−10) + immutable Activity Log entry.
      await this.aqrService.applyEvent(
        farmId,
        dto.cattleId,
        'sickness_reported',
        {
          actorId: userId,
          actionDetails: `Sickness reported for [${cattle.tagNumber}] — ${dto.diagnosis}.`,
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
        details: `Sickness reported for [${cattle.name ?? cattle.tagNumber}] (${cattle.tagNumber}) — ${dto.diagnosis}. Priority: ${dto.priority}.`,
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
        message: `${cattle.name ?? cattle.tagNumber} (${cattle.tagNumber}) — ${dto.diagnosis} reported (priority: ${dto.priority}).`,
        params: {
          name: cattle.name ?? cattle.tagNumber,
          tagNumber: cattle.tagNumber,
          diagnosis: dto.diagnosis,
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
          actionDetails: `Preventive care logged for [${cattle.tagNumber}] — ${dto.diagnosis}.`,
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
        treatmentLogs: { orderBy: { administeredAt: 'desc' } },
        healthUpdates: { orderBy: { recordedAt: 'desc' } },
        tasks: { orderBy: { dueDateTime: 'asc' } },
        mortalityRecord: true,
        safetyWithdrawals: { where: { status: SafetyWithdrawalStatus.ACTIVE } },
      },
    });
    if (!healthCase) throw new NotFoundException('Health case not found');
    return {
      ...healthCase,
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
        diagnosis: dto.diagnosis,
        condition: dto.condition,
        diagnosisType: dto.diagnosisType,
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

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.healthTask.deleteMany({
        where: { healthCaseId: id, status: HealthTaskStatus.PENDING },
      });
      const tasks = await Promise.all(
        plan.steps.map((step, index) => {
          const dueDateTime = this.addDays(
            startDate,
            Math.max(0, step.dayNumber - 1),
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
   * transaction, each getting its own new `HealthCase` + tasks. Replaces the frontend's old
   * create-case-then-apply-plan loop (2N sequential requests, no partial-failure handling).
   * An animal that already has an active case for this plan is **skipped, not duplicated** — the
   * defect this ticket exists to close. A bad `cattleId` fails the whole call before anything is
   * written; a partial failure inside the transaction rolls the whole batch back.
   */
  async applyPlanToAnimals(
    farmId: string,
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
    const diagnosisType = PLAN_CATEGORY_TO_DIAGNOSIS_TYPE[plan.category];

    // An animal already on this exact protocol is skipped, not duplicated —
    // this is what the two-request create-then-apply frontend flow could not
    // express (it always created a fresh case, every time).
    const existing = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        cattleId: { in: cattleIds },
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
      await this.prisma.$transaction(async (tx) => {
        for (const cattle of toApply) {
          const caseCode = await this.nextCaseCode(farmId, tx);
          const healthCase = await tx.healthCase.create({
            data: {
              farmId,
              cattleId: cattle.id,
              caseCode,
              diagnosis: plan.diagnosis ?? plan.name,
              diagnosisType,
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
              const dueDateTime = this.addDays(
                startDate,
                Math.max(0, step.dayNumber - 1),
              );
              return tx.healthTask.create({
                data: {
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

    // Inventory decrement (HLT-07): consume medicine stock before logging the
    // treatment, so an expired batch (HLT-02) or insufficient stock (INV-02)
    // aborts the whole action. Only runs when a medicine + quantity is given.
    const medicineId = dto.medicineId ?? task?.medicineId ?? undefined;
    const medicineName = dto.medicineName ?? task?.medicineName ?? undefined;
    const quantity = dto.stockDeductionQuantity ?? dto.doseAmount ?? undefined;
    const deduction =
      quantity && quantity > 0 && (medicineId || medicineName)
        ? await this.medicineService.decrementForTreatment(farmId, userId, {
            medicineId,
            medicineName,
            quantity,
            notes: `Treatment for case ${healthCase.caseCode}`,
          })
        : null;

    // RAKHAL-419: resolve the treatment's cost from the medicine's own
    // costPerUnit — a treatment with no medicine, or a free one, posts
    // nothing to Finance and needs no financialAccountId.
    let resolvedCost = 0;
    if (deduction) {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: deduction.medicineId },
        select: { costPerUnit: true },
      });
      resolvedCost = medicine?.costPerUnit
        ? medicine.costPerUnit * quantity!
        : 0;
    }
    if (resolvedCost > 0 && !dto.financialAccountId) {
      throw new BadRequestException(
        'financialAccountId is required when a treatment cost is being recorded',
      );
    }

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
      const posted = await this.expenseService.recordExpense(farmId, userId, {
        category: ExpenseCategory.HEALTH,
        description: `Medicine — Case ${healthCase.caseCode}`,
        amount: resolvedCost,
        expenseDate: log.treatmentLog.administeredAt.toISOString(),
        financialAccountId: dto.financialAccountId!,
        cattleId: healthCase.cattleId,
      });
      log.treatmentLog = await this.prisma.treatmentLog.update({
        where: { id: log.treatmentLog.id },
        data: { financeTransactionId: posted.id },
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

    const medicine = await this.prisma.medicine.findFirst({
      where: { id: dto.medicineId, farmId, deletedAt: null },
      select: {
        id: true,
        name: true,
        costPerUnit: true,
        milkWithdrawalDays: true,
        meatWithdrawalDays: true,
      },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');

    // Validate every animal belongs to this farm before writing anything —
    // same all-or-nothing rule RAKHAL-414's bulk apply uses. Checked before
    // the cost/financialAccountId guard below: a request naming an animal
    // that doesn't exist should 404 on that, not demand a payment account
    // for a treatment that can never be recorded anyway.
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

    // RAKHAL-419: same cost basis per animal (same medicine, same dose) —
    // resolved once rather than re-derived N times in the loop below.
    const resolvedCost = medicine.costPerUnit
      ? medicine.costPerUnit * dto.doseAmount
      : 0;
    if (resolvedCost > 0 && !dto.financialAccountId) {
      throw new BadRequestException(
        'financialAccountId is required when a treatment cost is being recorded',
      );
    }

    const treatedAt = new Date(dto.treatedAt);
    const results: {
      cattleId: string;
      healthCaseId: string;
      treatmentLogId: string;
      safetyWithdrawalId: string | null;
      reusedExistingCase: boolean;
    }[] = [];

    for (const cattle of cattleRows) {
      const openCase = await this.prisma.healthCase.findFirst({
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
      const deduction = await this.medicineService.decrementForTreatment(
        farmId,
        userId,
        {
          medicineId: dto.medicineId,
          quantity: dto.doseAmount,
          notes: `Quick treatment for ${cattle.tagNumber}`,
        },
      );

      const { healthCaseId, treatmentLog, withdrawal, autoClosed } =
        await this.prisma.$transaction(async (tx) => {
          const targetCase =
            openCase ??
            (await tx.healthCase.create({
              data: {
                farmId,
                cattleId: cattle.id,
                caseCode: await this.nextCaseCode(farmId, tx),
                diagnosis:
                  dto.reason?.trim() || `Quick treatment — ${medicine.name}`,
                diagnosisType: HealthDiagnosisType.OTHER,
                priority: HealthPriority.LOW,
                shedId: cattle.shedId,
                startDate: treatedAt,
              },
            }));

          const treatmentLog = await tx.treatmentLog.create({
            data: {
              farmId,
              cattleId: cattle.id,
              healthCaseId: targetCase.id,
              medicineId: deduction.medicineId,
              medicineName: medicine.name,
              doseAmount: dto.doseAmount,
              doseUnit: dto.doseUnit,
              route: dto.route,
              administeredAt: treatedAt,
              administeredBy: userId,
              stockDeducted: true,
              stockDeductionQuantity: dto.doseAmount,
              batchNo: deduction.batchId,
              notes: dto.notes,
            },
          });

          const withdrawal = await this.createSafetyWithdrawalIfNeeded(
            tx,
            targetCase,
            treatmentLog,
            {
              milkWithdrawalDays: medicine.milkWithdrawalDays || undefined,
              meatWithdrawalDays: medicine.meatWithdrawalDays || undefined,
            },
          );

          const autoClosed = await this.updateCaseProgress(tx, targetCase.id);

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
        const posted = await this.expenseService.recordExpense(farmId, userId, {
          category: ExpenseCategory.HEALTH,
          description: `${medicine.name} — Quick treatment for [${cattle.tagNumber}]`,
          amount: resolvedCost,
          expenseDate: treatedAt.toISOString(),
          financialAccountId: dto.financialAccountId!,
          cattleId: cattle.id,
        });
        await this.prisma.treatmentLog.update({
          where: { id: treatmentLog.id },
          data: { financeTransactionId: posted.id },
        });
      }

      await this.notifyCaseAutoClosed(autoClosed, userId);

      await this.aqrService.applyEvent(
        farmId,
        cattle.id,
        'treatment_completed',
        {
          actorId: userId,
          actionDetails: `Quick treatment administered for [${cattle.tagNumber}] — ${medicine.name}.`,
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
    const where: Prisma.HealthPlanWhereInput = {
      farmId,
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.planType ? { planType: query.planType } : {}),
    };
    const rows = await this.prisma.healthPlan.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    return toCursorPage(rows, query);
  }

  async getAppliedPlans(farmId: string, query: AppliedPlansQueryDto) {
    const where: Prisma.HealthCaseWhereInput = {
      farmId,
      deletedAt: null,
      healthPlanId: { not: null },
      status: { in: ACTIVE_CASE_STATUSES },
      ...(query.healthPlanId ? { healthPlanId: query.healthPlanId } : {}),
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                healthPlan: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
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
          }
        : {}),
    };
    const rows = await this.prisma.healthCase.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      ...getCursorArgs(query),
      include: {
        cattle: {
          select: { id: true, name: true, tagNumber: true, image: true },
        },
        healthPlan: { select: { id: true, name: true, category: true } },
      },
    });
    return toCursorPage(rows, query);
  }

  async createPlan(farmId: string, userId: string, dto: CreateHealthPlanDto) {
    return this.prisma.healthPlan.create({
      data: {
        farmId,
        name: dto.name,
        category: dto.category,
        planType: dto.planType,
        description: dto.description,
        diagnosis: dto.diagnosis,
        cycleLengthDays: dto.cycleLengthDays,
        totalActionSteps: dto.steps.length,
        isTemplate: dto.isTemplate ?? false,
        createdBy: userId,
        steps: { create: dto.steps },
      },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
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
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.steps) {
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
          cycleLengthDays: dto.cycleLengthDays,
          isTemplate: dto.isTemplate,
          totalActionSteps: dto.steps?.length,
          ...(dto.steps ? { steps: { create: dto.steps } } : {}),
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

  async deleteCase(farmId: string, id: string) {
    await this.getCaseOrThrow(farmId, id);
    const deleted = await this.prisma.healthCase.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.log.info('Health case archived', { healthCaseId: id, farmId });
    return deleted;
  }

  async getTasks(farmId: string, query: HealthTaskQueryDto) {
    const where: Prisma.HealthTaskWhereInput = {
      farmId,
      deletedAt: null,
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(query.healthCaseId ? { healthCaseId: query.healthCaseId } : {}),
      ...(query.status ? { status: query.status } : {}),
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
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        cattle: { select: { id: true, tagNumber: true, name: true } },
      },
    });
    return toCursorPage(rows, query);
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
    const updated = await this.prisma.healthTask.update({
      where: { id },
      data: {
        status: HealthTaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: userId,
      },
    });
    const autoClosed = await this.updateCaseProgress(
      this.prisma,
      task.healthCaseId,
    );
    await this.notifyCaseAutoClosed(autoClosed, userId);
    return updated;
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
            tasks: {
              where: { status: HealthTaskStatus.PENDING },
              orderBy: { dueDateTime: 'asc' },
              take: 1,
            },
          },
        }),
        this.prisma.treatmentLog.findMany({
          where: { cattleId, farmId },
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
        (c) => !isPreventiveDiagnosisType(c.diagnosisType),
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

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
