import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalProgress,
  CattleStatus,
  HealthCaseStatus,
  HealthCloseOutcome,
  HealthTaskStatus,
  Prisma,
  SafetyWithdrawalStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import {
  ApplyHealthPlanDto,
  CloseHealthCaseDto,
  CreateHealthUpdateDto,
  LogTreatmentDto,
  MortalityDto,
  RescheduleHealthTaskDto,
  SkipHealthTaskDto,
} from '../../presentation/dto/case-actions.dto';
import { CreateHealthCaseDto } from '../../presentation/dto/create-health-case.dto';
import {
  HealthPlanQueryDto,
  HealthTaskCalendarQueryDto,
  HealthTaskQueryDto,
  SafetyWithdrawalQueryDto,
  SickBayQueryDto,
} from '../../presentation/dto/health-query.dto';
import {
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
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(HealthService.name);
  }

  async getHealthDashboard(farmId: string) {
    await this.refreshSafetyWithdrawalsForFarm(farmId);
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
    ] = await Promise.all([
      this.prisma.cattle.count({
        where: { farmId, isActive: true },
      }),
      this.prisma.healthCase.count({
        where: { farmId, status: { in: ACTIVE_CASE_STATUSES }, isActive: true },
      }),
      this.prisma.safetyWithdrawal.count({
        where: { farmId, status: SafetyWithdrawalStatus.ACTIVE },
      }),
      this.prisma.healthTask.count({
        where: {
          farmId,
          status: HealthTaskStatus.PENDING,
          dueDateTime: { gte: now },
        },
      }),
      this.prisma.healthTask.count({
        where: {
          farmId,
          status: { in: [HealthTaskStatus.PENDING, HealthTaskStatus.OVERDUE] },
          dueDateTime: { lt: now },
        },
      }),
      this.prisma.healthCase.groupBy({
        by: ['diagnosis'],
        where: { farmId },
        _count: { diagnosis: true },
      }),
      this.prisma.healthCase.groupBy({
        by: ['shedName'],
        where: { farmId },
        _count: { shedName: true },
      }),
      this.prisma.healthCase.findMany({
        where: { farmId },
        select: { startDate: true },
        orderBy: { startDate: 'asc' },
      }),
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
      medicineExpense: 0,
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
      isActive: true,
      status: query.status ?? { in: ACTIVE_CASE_STATUSES },
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

    const count = await this.prisma.healthCase.count({ where: { farmId } });
    const caseCode = `HC-${String(count + 1).padStart(5, '0')}`;
    const healthCase = await this.prisma.healthCase.create({
      data: {
        farmId,
        cattleId: dto.cattleId,
        caseCode,
        diagnosis: dto.diagnosis,
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
      },
      include: this.caseInclude(),
    });

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

    this.log.info('Health case created', {
      healthCaseId: healthCase.id,
      farmId,
      cattleId: dto.cattleId,
    });
    return healthCase;
  }

  async getHealthCase(farmId: string, id: string) {
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
      where: { id: dto.healthPlanId, farmId, isActive: true },
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
          const dueDateTime = this.addDays(startDate, step.dayNumber);
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

  async logTreatment(
    farmId: string,
    userId: string,
    id: string,
    dto: LogTreatmentDto,
  ) {
    const healthCase = await this.getCaseOrThrow(farmId, id);
    const task = dto.healthTaskId
      ? await this.prisma.healthTask.findFirst({
          where: { id: dto.healthTaskId, healthCaseId: id },
        })
      : null;
    if (dto.healthTaskId && !task)
      throw new BadRequestException('Health task must belong to case');

    const log = await this.prisma.$transaction(async (tx) => {
      const treatmentLog = await tx.treatmentLog.create({
        data: {
          farmId: healthCase.farmId,
          cattleId: healthCase.cattleId,
          healthCaseId: id,
          healthTaskId: dto.healthTaskId,
          medicineId: dto.medicineId ?? task?.medicineId,
          medicineName: dto.medicineName ?? task?.medicineName,
          doseAmount: dto.doseAmount ?? task?.doseAmount,
          doseUnit: dto.doseUnit ?? task?.doseUnit,
          route: dto.route ?? task?.route,
          administeredAt: dto.administeredAt
            ? new Date(dto.administeredAt)
            : new Date(),
          administeredBy: dto.administeredBy ?? userId,
          stockDeducted: false,
          stockDeductionQuantity: dto.stockDeductionQuantity,
          batchNo: dto.batchNo,
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
      await this.updateCaseProgress(tx, id);
      return { treatmentLog, withdrawal };
    });

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

    this.log.info('Treatment logged', {
      healthCaseId: id,
      treatmentLogId: log.treatmentLog.id,
    });
    return log;
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
        isActive: false,
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
          isActive: false,
        },
      });
      await tx.cattle.update({
        where: { id: healthCase.cattleId },
        data: { status: CattleStatus.DEAD, isActive: false },
      });
      return { mortality, healthCase: closedCase };
    });

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
      isActive: true,
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
      where: { id, farmId },
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
      data: { isActive: false },
    });
    this.log.info('Health plan archived', { healthPlanId: id, farmId });
    return deleted;
  }

  async getTasks(farmId: string, query: HealthTaskQueryDto) {
    const where: Prisma.HealthTaskWhereInput = {
      farmId,
      isActive: true,
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
      where: { farmId, dueDateTime: { gte: start, lte: end } },
      select: { dueDateTime: true, status: true },
    });
    return this.groupTasksByDate(tasks);
  }

  async completeTask(farmId: string, id: string) {
    const task = await this.getTaskOrThrow(farmId, id);
    const updated = await this.prisma.healthTask.update({
      where: { id },
      data: {
        status: HealthTaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    await this.updateCaseProgress(this.prisma, task.healthCaseId);
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
    await this.refreshSafetyWithdrawalsForFarm(farmId);
    const [activeCases, treatmentHistory, activeWithdrawals, mortality] =
      await Promise.all([
        this.prisma.healthCase.findMany({
          where: { cattleId, farmId, status: { in: ACTIVE_CASE_STATUSES } },
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
          where: { cattleId, farmId, status: SafetyWithdrawalStatus.ACTIVE },
        }),
        this.prisma.mortalityRecord.findFirst({
          where: { cattleId, farmId },
          orderBy: { deathDate: 'desc' },
        }),
      ]);
    return {
      activeCases,
      ongoingTreatment: activeCases.length > 0,
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

  async getSafetyWithdrawals(farmId: string, query: SafetyWithdrawalQueryDto) {
    const where: Prisma.SafetyWithdrawalWhereInput = {
      farmId,
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const rows = await this.prisma.safetyWithdrawal.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async refreshSafetyWithdrawals(farmId: string) {
    return this.refreshSafetyWithdrawalsForFarm(farmId);
  }

  private async refreshSafetyWithdrawalsForFarm(farmId: string) {
    const now = new Date();
    const result = await this.prisma.safetyWithdrawal.updateMany({
      where: {
        farmId,
        status: SafetyWithdrawalStatus.ACTIVE,
        OR: [
          { milkWithdrawalUntil: { lte: now } },
          { meatWithdrawalUntil: { lte: now } },
        ],
      },
      data: { status: SafetyWithdrawalStatus.COMPLETED },
    });
    return { updated: result.count };
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

  private async updateCaseProgress(
    tx: Prisma.TransactionClient | PrismaService,
    healthCaseId: string,
  ) {
    const [total, completed] = await Promise.all([
      tx.healthTask.count({ where: { healthCaseId, isActive: true } }),
      tx.healthTask.count({
        where: {
          healthCaseId,
          status: HealthTaskStatus.COMPLETED,
          isActive: true,
        },
      }),
    ]);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    await tx.healthCase.update({
      where: { id: healthCaseId },
      data: {
        totalSteps: total,
        currentStep: completed,
        progressPercentage: progress,
      },
    });
  }

  private async getCaseOrThrow(farmId: string, id: string) {
    const healthCase = await this.prisma.healthCase.findFirst({
      where: { id, farmId },
    });
    if (!healthCase) throw new NotFoundException('Health case not found');
    return healthCase;
  }

  private async getTaskOrThrow(farmId: string, id: string) {
    const task = await this.prisma.healthTask.findFirst({
      where: { id, farmId },
    });
    if (!task) throw new NotFoundException('Health task not found');
    return task;
  }

  private async assertCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
    });
    if (!cattle) throw new BadRequestException('Cattle must belong to Farm');
    return cattle;
  }

  private async assertShedInFarm(farmId: string, shedId: string) {
    const shed = await this.prisma.shed.findFirst({
      where: { id: shedId, farmId },
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
          status: true,
        },
      },
      healthPlan: { select: { id: true, name: true } },
    } satisfies Prisma.HealthCaseInclude;
  }

  private calculateHerdHealthScore(healthy: number, total: number) {
    if (total === 0) return 100;
    return Math.round((healthy / total) * 100);
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
