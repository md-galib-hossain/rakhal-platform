import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalfMilkType,
  CalfStarterEventType,
  Cattle,
  CattleGender,
  CattlePurpose,
  HealthCaseStatus,
  Prisma,
  ProductionStatus,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { TaskService } from 'src/modules/task/application/services/task.service';
import {
  ageInDays,
  computeAdg,
  DAY_MS,
  DEFAULT_WEANING_DAYS,
  stageDobRange,
  stageForAge,
  weaningTargetDate,
} from '../../domain/calf-stage';
import { buildCalfCareSchedule } from '../../domain/calf-care-schedule';
import { ListCalfQueryDto } from '../../presentation/dto/list-calf-query.dto';
import { RecordColostrumDto } from '../../presentation/dto/record-colostrum.dto';
import { RecordMilkFeedingDto } from '../../presentation/dto/record-milk-feeding.dto';
import { RecordStarterFeedDto } from '../../presentation/dto/record-starter-feed.dto';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';
import { WeanCalfDto } from '../../presentation/dto/wean-calf.dto';

const ACTIVE_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/** Default target weaning weight in kg (PRD §14.4 — configurable later). */
const WEANING_WEIGHT_TARGET_KG = 80;

type CalfSummary = { id: string; name: string | null; tagNumber: string };

/**
 * Calf Management service (PRD §14). A calf is a `Cattle` row with
 * `purpose = CALF`; this service hangs rearing records off it and presents the
 * dashboard/profile aggregations. Farm-scoped: `farmId` comes from the verified
 * token context (`FarmContextGuard`), so every query is scoped to it.
 */
@Injectable()
export class CalfService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(CalfService.name);
  }

  /**
   * Generate the age-based care/vaccination reminders for a newborn calf
   * (PRD §14.5, RD-009). Called by the reproduction calving flow for each
   * live-born calf. Each schedule item becomes a SYSTEM_AUTO "Calf Care" task
   * due at `birthDate + offset`; brucellosis is female-only. Returns the number
   * of tasks created so the caller can log it.
   */
  async scheduleCareReminders(input: {
    farmId: string;
    createdBy: string;
    calfId: string;
    birthDate: Date;
    gender: CattleGender;
  }): Promise<number> {
    const schedule = buildCalfCareSchedule(input.birthDate, input.gender);
    for (const item of schedule) {
      await this.taskService.createInternal({
        farmId: input.farmId,
        createdBy: input.createdBy,
        name: item.name,
        details: item.details,
        category: TaskCategory.CALF_CARE,
        priority: TaskPriority.MEDIUM,
        dueAt: item.dueAt,
        source: TaskSource.SYSTEM_AUTO,
        relatedCattleId: input.calfId,
      });
    }
    this.log.info('Calf care schedule generated', {
      calfId: input.calfId,
      farmId: input.farmId,
      tasks: schedule.length,
    });
    return schedule.length;
  }

  async list(farmId: string, query: ListCalfQueryDto) {
    const now = new Date();
    const where: Prisma.CattleWhereInput = {
      farmId,
      purpose: CattlePurpose.CALF,
      isActive: true,
      ...(query.stage ? { dateOfBirth: stageDobRange(query.stage, now) } : {}),
    };

    const rows = await this.prisma.cattle.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { mother: { select: this.summarySelect() } },
    });

    const page = toCursorPage(rows, query);
    const enriched = await this.enrichCalves(page.items, now);

    const items = query.healthStatus
      ? enriched.filter((calf) => calf.healthStatus === query.healthStatus)
      : enriched;

    const kpis = await this.dashboardKpis(farmId, now);
    return { items, meta: { ...page.meta, kpis } };
  }

  async profile(farmId: string, id: string) {
    const calf = await this.prisma.cattle.findFirst({
      where: { id, farmId },
      include: { mother: { select: this.summarySelect() } },
    });
    if (!calf) {
      throw new NotFoundException('Calf not found');
    }
    const now = new Date();
    const ageDays = calf.dateOfBirth ? ageInDays(calf.dateOfBirth, now) : null;

    const [birth, colostrum, milk, weights, starter, weaning, tasks] =
      await Promise.all([
        this.prisma.calfBirth.findFirst({
          where: { calfId: id },
          include: { calvingEvent: { select: { calvingEase: true } } },
        }),
        this.prisma.calfColostrumRecord.findMany({
          where: { calfId: id },
          orderBy: { feedNumber: 'asc' },
        }),
        this.prisma.calfMilkFeeding.findMany({
          where: { calfId: id },
          orderBy: { date: 'desc' },
        }),
        this.prisma.calfWeightRecord.findMany({
          where: { calfId: id },
          orderBy: { measuredDate: 'asc' },
        }),
        this.prisma.calfStarterFeedRecord.findMany({
          where: { calfId: id },
          orderBy: { date: 'asc' },
        }),
        this.prisma.calfWeaningRecord.findFirst({ where: { calfId: id } }),
        this.prisma.task.findMany({
          where: {
            farmId,
            relatedCattleId: id,
            status: { not: 'COMPLETED' },
          },
          orderBy: { dueAt: 'asc' },
          select: { id: true, name: true, dueAt: true, category: true },
        }),
      ]);

    const birthWeightKg = birth?.birthWeight ? Number(birth.birthWeight) : null;
    const colostrum24h = colostrum
      .filter(
        (c) =>
          calf.dateOfBirth &&
          c.fedAt.getTime() - calf.dateOfBirth.getTime() <= DAY_MS,
      )
      .reduce((sum, c) => sum + c.volumeMl, 0);

    return {
      id: calf.id,
      name: calf.name,
      tagNumber: calf.tagNumber,
      birthDate: calf.dateOfBirth,
      ageDays,
      gender: calf.gender,
      dam: calf.mother,
      birthWeightKg,
      birthEaseScore: birth?.calvingEvent?.calvingEase ?? null,
      colostrumRecords: colostrum,
      totalColostrum24hMl: colostrum24h,
      milkFeedingLog: milk.map((m) => ({
        ...m,
        totalMl: m.morningMl + m.eveningMl,
      })),
      weightRecords: weights.map((w) => ({
        date: w.measuredDate,
        weightKg: w.weightKg,
        adgToDate:
          calf.dateOfBirth && ageDays != null
            ? computeAdg(
                birthWeightKg,
                w.weightKg,
                ageInDays(calf.dateOfBirth, w.measuredDate),
              )
            : null,
      })),
      starterFeed: {
        firstOfferedDate:
          starter.find(
            (s) => s.eventType === CalfStarterEventType.FIRST_OFFERED,
          )?.date ?? null,
        firstIntakeDate:
          starter.find((s) => s.eventType === CalfStarterEventType.FIRST_INTAKE)
            ?.date ?? null,
        currentDailyIntakeG:
          [...starter]
            .reverse()
            .find((s) => s.eventType === CalfStarterEventType.DAILY_INTAKE)
            ?.amountG ?? null,
      },
      weaningTargetDate: calf.dateOfBirth
        ? weaningTargetDate(calf.dateOfBirth)
        : null,
      weaningWeightTargetKg: WEANING_WEIGHT_TARGET_KG,
      weaningStatus: weaning ? 'weaned' : 'pending',
      weaningRecord: weaning,
      upcomingTasks: tasks,
    };
  }

  async recordColostrum(farmId: string, id: string, dto: RecordColostrumDto) {
    await this.assertCalf(farmId, id);
    const record = await this.prisma.calfColostrumRecord.create({
      data: {
        calfId: id,
        feedNumber: dto.feedNumber,
        fedAt: new Date(dto.fedAt),
        volumeMl: dto.volumeMl,
        quality: dto.quality,
        fedBy: dto.fedBy,
        notes: dto.notes,
      },
    });
    this.log.info('Colostrum recorded', { calfId: id, farmId });
    return record;
  }

  async recordMilkFeeding(
    farmId: string,
    id: string,
    dto: RecordMilkFeedingDto,
  ) {
    await this.assertCalf(farmId, id);
    const morningMl = dto.morningMl ?? 0;
    const eveningMl = dto.eveningMl ?? 0;
    const record = await this.prisma.calfMilkFeeding.create({
      data: {
        calfId: id,
        date: new Date(dto.date),
        morningMl,
        eveningMl,
        type: dto.type ?? CalfMilkType.WHOLE_MILK,
        notes: dto.notes,
      },
    });
    this.log.info('Calf milk feeding recorded', { calfId: id, farmId });
    return { ...record, totalMl: morningMl + eveningMl };
  }

  async recordWeight(
    farmId: string,
    userId: string,
    id: string,
    dto: RecordWeightDto,
  ) {
    const calf = await this.assertCalf(farmId, id);
    const record = await this.prisma.calfWeightRecord.create({
      data: {
        calfId: id,
        weightKg: dto.weightKg,
        measuredDate: new Date(dto.measuredDate),
        recordedBy: userId,
        notes: dto.notes,
      },
    });

    const birthWeightKg = await this.birthWeight(id);
    const adgToDate = calf.dateOfBirth
      ? computeAdg(
          birthWeightKg,
          dto.weightKg,
          ageInDays(calf.dateOfBirth, new Date(dto.measuredDate)),
        )
      : null;

    this.log.info('Calf weight recorded', { calfId: id, farmId });
    return { ...record, adgToDate };
  }

  async recordStarterFeed(
    farmId: string,
    id: string,
    dto: RecordStarterFeedDto,
  ) {
    await this.assertCalf(farmId, id);
    const record = await this.prisma.calfStarterFeedRecord.create({
      data: {
        calfId: id,
        date: new Date(dto.date),
        eventType: dto.eventType,
        amountG: dto.amountG ?? 0,
        notes: dto.notes,
      },
    });
    this.log.info('Calf starter feed recorded', { calfId: id, farmId });
    return record;
  }

  async wean(farmId: string, id: string, dto: WeanCalfDto) {
    const calf = await this.assertCalf(farmId, id);
    const existing = await this.prisma.calfWeaningRecord.findFirst({
      where: { calfId: id },
    });
    if (existing) {
      throw new BadRequestException('Calf is already weaned');
    }

    const weaningDate = new Date(dto.weaningDate);
    const birthWeightKg = await this.birthWeight(id);
    const adgAtWeaning = calf.dateOfBirth
      ? computeAdg(
          birthWeightKg,
          dto.weaningWeightKg ?? null,
          ageInDays(calf.dateOfBirth, weaningDate),
        )
      : null;
    const newPurpose =
      dto.newPurpose ??
      (calf.gender === CattleGender.FEMALE
        ? CattlePurpose.BREEDING
        : CattlePurpose.MEAT);

    const [record] = await this.prisma.$transaction([
      this.prisma.calfWeaningRecord.create({
        data: {
          calfId: id,
          weaningDate,
          weaningWeightKg: dto.weaningWeightKg,
          adgAtWeaning,
          notes: dto.notes,
        },
      }),
      // Move the animal out of Calf Management into the main herd (PRD §14.4).
      this.prisma.cattle.update({
        where: { id },
        data: {
          purpose: newPurpose,
          productionStatus: ProductionStatus.GROWING,
        },
      }),
    ]);

    this.log.info('Calf weaned', { calfId: id, farmId, newPurpose });
    return {
      calfId: id,
      weaned: true,
      adgAtWeaning,
      productionStatusUpdatedTo: 'GROWING',
      newPurpose,
      movedToCattleModule: true,
      removedFromCalfManagement: true,
      weaningRecord: record,
    };
  }

  // ---- Helpers -------------------------------------------------------------

  private async dashboardKpis(farmId: string, now: Date) {
    const calfWhere: Prisma.CattleWhereInput = {
      farmId,
      purpose: CattlePurpose.CALF,
      isActive: true,
    };
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    // weaning target (dob + 60d) falls within the next 7 days
    const weaningFrom = new Date(now.getTime() - DEFAULT_WEANING_DAYS * DAY_MS);
    const weaningTo = new Date(
      now.getTime() - (DEFAULT_WEANING_DAYS - 7) * DAY_MS,
    );

    const [totalCalves, fedTodayGroups, healthConcern, weaningDue] =
      await Promise.all([
        this.prisma.cattle.count({ where: calfWhere }),
        this.prisma.calfMilkFeeding.groupBy({
          by: ['calfId'],
          where: { calf: calfWhere, date: { gte: dayStart, lt: dayEnd } },
        }),
        this.prisma.cattle.count({
          where: {
            ...calfWhere,
            healthCases: { some: { status: { in: ACTIVE_CASE_STATUSES } } },
          },
        }),
        this.prisma.cattle.count({
          where: {
            ...calfWhere,
            dateOfBirth: { gte: weaningFrom, lte: weaningTo },
          },
        }),
      ]);

    return {
      totalCalves,
      fedToday: fedTodayGroups.length,
      healthConcern,
      weaningDueThisWeek: weaningDue,
    };
  }

  private async enrichCalves(
    calves: Array<Cattle & { mother: CalfSummary | null }>,
    now: Date,
  ) {
    const ids = calves.map((c) => c.id);
    if (ids.length === 0) return [];

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const [births, weights, fedToday, concerns] = await Promise.all([
      this.prisma.calfBirth.findMany({
        where: { calfId: { in: ids } },
        select: { calfId: true, birthWeight: true },
      }),
      this.prisma.calfWeightRecord.findMany({
        where: { calfId: { in: ids } },
        orderBy: { measuredDate: 'desc' },
        select: { calfId: true, weightKg: true },
      }),
      this.prisma.calfMilkFeeding.groupBy({
        by: ['calfId'],
        where: { calfId: { in: ids }, date: { gte: dayStart, lt: dayEnd } },
      }),
      this.prisma.healthCase.groupBy({
        by: ['cattleId'],
        where: { cattleId: { in: ids }, status: { in: ACTIVE_CASE_STATUSES } },
      }),
    ]);

    const birthByCalf = new Map(
      births.map((b) => [
        b.calfId,
        b.birthWeight ? Number(b.birthWeight) : null,
      ]),
    );
    const latestWeight = new Map<string, number>();
    for (const w of weights) {
      if (!latestWeight.has(w.calfId)) latestWeight.set(w.calfId, w.weightKg);
    }
    const fedSet = new Set(fedToday.map((f) => f.calfId));
    const concernSet = new Set(concerns.map((c) => c.cattleId));

    return calves.map((calf) => {
      const ageDays = calf.dateOfBirth
        ? ageInDays(calf.dateOfBirth, now)
        : null;
      const birthWeightKg = birthByCalf.get(calf.id) ?? null;
      const currentWeightKg = latestWeight.get(calf.id) ?? null;
      return {
        id: calf.id,
        name: calf.name,
        tagNumber: calf.tagNumber,
        ageDays,
        gender: calf.gender,
        stage: ageDays != null ? stageForAge(ageDays) : null,
        dam: calf.mother,
        birthWeightKg,
        currentWeightKg,
        adgKgDay:
          ageDays != null
            ? computeAdg(birthWeightKg, currentWeightKg, ageDays)
            : null,
        healthStatus: concernSet.has(calf.id) ? 'concern' : 'healthy',
        fedToday: fedSet.has(calf.id),
        weaningDueDate: calf.dateOfBirth
          ? weaningTargetDate(calf.dateOfBirth)
          : null,
      };
    });
  }

  private async birthWeight(calfId: string): Promise<number | null> {
    const birth = await this.prisma.calfBirth.findFirst({
      where: { calfId },
      select: { birthWeight: true },
    });
    return birth?.birthWeight ? Number(birth.birthWeight) : null;
  }

  private async assertCalf(farmId: string, id: string) {
    const calf = await this.getCattleOrThrow(farmId, id);
    if (calf.purpose !== CattlePurpose.CALF) {
      throw new BadRequestException(
        'Animal is not an active calf (it may have been weaned)',
      );
    }
    return calf;
  }

  private async getCattleOrThrow(farmId: string, id: string): Promise<Cattle> {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id, farmId },
    });
    if (!cattle) {
      throw new NotFoundException('Calf not found');
    }
    return cattle;
  }

  private summarySelect() {
    return {
      id: true,
      name: true,
      tagNumber: true,
    } satisfies Prisma.CattleSelect;
  }
}
