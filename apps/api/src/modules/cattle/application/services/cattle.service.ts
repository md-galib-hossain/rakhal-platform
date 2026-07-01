import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreedingMethod,
  Cattle,
  CattleSourceType,
  CattleStatus,
  FinanceTxnType,
  HealthCaseStatus,
  LactationStatus,
  MilkSession,
  PregnancyStatus,
  Prisma,
  ProductionStatus,
  ReproductiveStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { VWP_DEFAULT_DAYS } from '../../domain/cattle.constants';
import { deriveHealthStatus } from '../../domain/health-status';
import { AncestryQueryDto } from '../../presentation/dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../../presentation/dto/archive-cattle.dto';
import { BulkCattleDto } from '../../presentation/dto/bulk-cattle.dto';
import { CreateCattleDto } from '../../presentation/dto/create-cattle.dto';
import {
  HealthStatusFilter,
  ListCattleQueryDto,
} from '../../presentation/dto/list-cattle-query.dto';
import { UpdateCattleDto } from '../../presentation/dto/update-cattle.dto';
import { UpdateCattleStatusDto } from '../../presentation/dto/update-cattle-status.dto';

type CattleSummary = Pick<Cattle, 'id' | 'name' | 'tagNumber'>;

interface AncestryNode extends CattleSummary {
  mother: AncestryNode | null;
  father: AncestryNode | null;
}

/** HealthCase statuses that count as an open/active case (not yet closed). */
const OPEN_HEALTH_CASE_STATUSES: HealthCaseStatus[] = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/** Production statuses excluded from active herd KPIs and AQR averages (CAT-08). */
const INACTIVE_PRODUCTION_STATUSES: ProductionStatus[] = [
  ProductionStatus.SOLD,
  ProductionStatus.DECEASED,
];

/**
 * Cattle service (PRD §8). Farm-scoped: `farmId` is supplied by the controller
 * from the verified token context (`FarmContextGuard`), so every query is scoped
 * to it and no cross-tenant access is possible. Registration emits the AQR
 * "Animal Registered" event (+50) + Activity Log entry.
 *
 * Status is multi-dimensional (PRD §8.1): production status is stored here,
 * reproductive status lives on `ReproductionProfile`, and health status is
 * derived from active Healthcare records — see {@link composeStatus}.
 */
@Injectable()
export class CattleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aqrService: AqrService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(CattleService.name);
  }

  async create(farmId: string, userId: string, dto: CreateCattleDto) {
    // Enforce the plan's herd ceiling before adding (RAKHAL-219, CAT limit).
    const activeCount = await this.prisma.cattle.count({
      where: { farmId, isActive: true },
    });
    await this.subscriptionAccess.assertCattleLimit(farmId, activeCount);

    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, undefined, dto);

    try {
      const cattle = await this.prisma.cattle.create({
        data: {
          farmId,
          name: dto.name,
          tagNumber: dto.tagNumber,
          image: dto.image,
          breedId: dto.breedId,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          purpose: dto.purpose,
          status: dto.status ?? CattleStatus.ACTIVE,
          productionStatus: dto.productionStatus ?? ProductionStatus.GROWING,
          shedId: dto.shedId,
          feedGroupId: dto.feedGroupId,
          lastWeightKg: dto.weightKg,
          lastBcs: dto.bcs,
          motherId: dto.motherId,
          fatherId: dto.fatherId,
          sourceType: dto.sourceType ?? CattleSourceType.UNKNOWN,
          color: dto.color,
          notes: dto.notes,
          isActive: dto.status !== CattleStatus.ARCHIVED,
          createdBy: userId,
          // Initial physical readings (PRD §8.4) — keep the denormalized
          // `lastBcs` and the BCS history in sync from the start.
          ...(dto.bcs
            ? {
                bcsRecords: {
                  create: {
                    score: dto.bcs,
                    recordedDate: new Date(),
                    recordedBy: userId,
                  },
                },
              }
            : {}),
          // Seed a reproduction profile when an initial reproductive status is
          // supplied so the status dimension has a home (PRD §8.1/§8.4).
          ...(dto.reproductiveStatus
            ? {
                reproductionProfile: {
                  create: { reproductiveStatus: dto.reproductiveStatus },
                },
              }
            : {}),
        },
        include: this.defaultInclude(),
      });

      this.log.info('Cattle created', { cattleId: cattle.id, farmId });

      // AQR: Animal Registered (+50) + immutable Activity Log entry (PRD §19.2).
      const aqr = await this.aqrService.applyEvent(
        farmId,
        cattle.id,
        'animal_registered',
        {
          actorId: userId,
          actionDetails: `New [${cattle.purpose}] [${cattle.name ?? cattle.tagNumber}] registered.`,
        },
      );

      return { ...this.composeStatus(cattle), aqrScore: aqr.aqrScore };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(farmId: string, query: ListCattleQueryDto) {
    const where: Prisma.CattleWhereInput = {
      farmId,
      ...(query.includeArchived
        ? {}
        : { isActive: true, status: { not: CattleStatus.ARCHIVED } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { tagNumber: { contains: query.search, mode: 'insensitive' } },
              { color: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.breedId ? { breedId: query.breedId } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.productionStatus
        ? { productionStatus: query.productionStatus }
        : {}),
      ...(query.shedId ? { shedId: query.shedId } : {}),
      ...(query.feedGroupId ? { feedGroupId: query.feedGroupId } : {}),
      ...(query.reproductiveStatus
        ? {
            reproductionProfile: {
              is: { reproductiveStatus: query.reproductiveStatus },
            },
          }
        : {}),
      ...(query.healthStatus ? this.healthStatusWhere(query.healthStatus) : {}),
    };

    const rows = await this.prisma.cattle.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.defaultInclude(),
    });

    return toCursorPage(
      rows.map((row) => this.composeStatus(row)),
      query,
    );
  }

  async findOne(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(
      farmId,
      id,
      this.defaultInclude(),
    );
    return this.composeStatus(cattle);
  }

  async update(farmId: string, id: string, dto: UpdateCattleDto) {
    await this.getCattleOrThrow(farmId, id);
    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, id, dto);

    try {
      const cattle = await this.prisma.cattle.update({
        where: { id },
        data: {
          name: dto.name,
          tagNumber: dto.tagNumber,
          image: dto.image,
          breedId: dto.breedId,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          purpose: dto.purpose,
          status: dto.status,
          productionStatus: dto.productionStatus,
          shedId: dto.shedId,
          feedGroupId: dto.feedGroupId,
          lastWeightKg: dto.weightKg,
          motherId: dto.motherId,
          fatherId: dto.fatherId,
          sourceType: dto.sourceType,
          color: dto.color,
          notes: dto.notes,
          ...(dto.status
            ? { isActive: dto.status !== CattleStatus.ARCHIVED }
            : {}),
        },
        include: this.defaultInclude(),
      });

      this.log.info('Cattle updated', { cattleId: id, farmId });
      return this.composeStatus(cattle);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  /**
   * Dedicated multi-dimension status update (PRD §8.1, RAKHAL-036). Sets the
   * stored production status and/or the reproductive status on the linked
   * `ReproductionProfile`. Moving production status to Sold/Deceased also
   * archives the animal so it leaves active herd KPIs (CAT-08).
   */
  async updateStatus(farmId: string, id: string, dto: UpdateCattleStatusDto) {
    await this.getCattleOrThrow(farmId, id);

    if (dto.productionStatus) {
      const lifecycle = this.lifecycleForProductionStatus(dto.productionStatus);
      await this.prisma.cattle.update({
        where: { id },
        data: { productionStatus: dto.productionStatus, ...lifecycle },
      });
    }

    if (dto.reproductiveStatus) {
      await this.prisma.reproductionProfile.upsert({
        where: { cattleId: id },
        update: { reproductiveStatus: dto.reproductiveStatus },
        create: { cattleId: id, reproductiveStatus: dto.reproductiveStatus },
      });
    }

    this.log.info('Cattle status updated', { cattleId: id, farmId });
    return this.findOne(farmId, id);
  }

  async archive(farmId: string, id: string) {
    return this.archiveWithReason(farmId, id, {});
  }

  /**
   * Soft-archive with an optional reason (PRD §8.5, RAKHAL-036). `sold` and
   * `deceased` keep production status distinct (CAT-09) and both exclude the
   * animal from active herd KPIs (CAT-08). The deceased → cancel-tasks /
   * close-cases side effects are owned by the Healthcare mortality flow
   * (RAKHAL-067) and are intentionally not done here.
   */
  async archiveWithReason(farmId: string, id: string, dto: ArchiveCattleDto) {
    await this.getCattleOrThrow(farmId, id);

    const data: Prisma.CattleUpdateInput = { isActive: false };
    if (dto.reason === 'sold') {
      data.productionStatus = ProductionStatus.SOLD;
      data.status = CattleStatus.SOLD;
    } else if (dto.reason === 'deceased') {
      data.productionStatus = ProductionStatus.DECEASED;
      data.status = CattleStatus.DEAD;
    } else {
      data.status = CattleStatus.ARCHIVED;
    }

    const cattle = await this.prisma.cattle.update({
      where: { id },
      data,
      include: this.defaultInclude(),
    });
    this.log.info('Cattle archived', {
      cattleId: id,
      farmId,
      reason: dto.reason,
    });
    return this.composeStatus(cattle);
  }

  async restore(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: { status: CattleStatus.ACTIVE, isActive: true },
      include: this.defaultInclude(),
    });
    this.log.info('Cattle restored', { cattleId: id, farmId });
    return this.composeStatus(cattle);
  }

  async remove(farmId: string, id: string, dto: ArchiveCattleDto = {}) {
    return this.archiveWithReason(farmId, id, dto);
  }

  /**
   * Cattle highlights bar (PRD §8.2, RAKHAL-037): total active herd, average
   * herd AQR, breeding-ready count, and today's yield — each with a trend.
   */
  async highlights(farmId: string) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const vwpCutoff = new Date(now);
    vwpCutoff.setDate(vwpCutoff.getDate() - VWP_DEFAULT_DAYS);

    const activeWhere: Prisma.CattleWhereInput = {
      farmId,
      isActive: true,
      productionStatus: { notIn: INACTIVE_PRODUCTION_STATUSES },
    };

    const [totalActive, prevActive, aqrAgg, breedingReady] = await Promise.all([
      this.prisma.cattle.count({ where: activeWhere }),
      this.prisma.cattle.count({
        where: { ...activeWhere, createdAt: { lte: monthAgo } },
      }),
      this.prisma.cattle.aggregate({
        where: { ...activeWhere, aqrScore: { not: null } },
        _avg: { aqrScore: true },
      }),
      this.prisma.cattle.count({
        where: {
          ...activeWhere,
          productionStatus: ProductionStatus.MILKING,
          reproductionProfile: {
            is: { reproductiveStatus: ReproductiveStatus.OPEN },
          },
          lactations: {
            some: {
              status: LactationStatus.ACTIVE,
              startDate: { lte: vwpCutoff },
            },
          },
        },
      }),
    ]);

    const { todayL, yesterdayL } = await this.dailyYield(farmId, now);

    return {
      total_active: totalActive,
      total_change_pct: this.pctChange(totalActive, prevActive),
      avg_herd_aqr: this.round(aqrAgg._avg.aqrScore ?? 0),
      // No historical AQR snapshots yet — trend deferred (TECH_DEBT).
      aqr_change_pct: null as number | null,
      breeding_ready_count: breedingReady,
      todays_yield_l: this.round(todayL),
      yield_change_pct: this.pctChange(todayL, yesterdayL),
    };
  }

  /**
   * Bulk operations on a selection of cattle (PRD §8.3, RAKHAL-037).
   * Farm-scoped: only rows belonging to `farmId` are affected; the rest count
   * as `failed`.
   */
  async bulk(farmId: string, dto: BulkCattleDto) {
    const { cattleIds, action, payload } = dto;
    const scope: Prisma.CattleWhereInput = { id: { in: cattleIds }, farmId };

    switch (action) {
      case 'change_shed': {
        if (!payload?.shedId) {
          throw new BadRequestException('shedId is required for change_shed');
        }
        await this.assertShedInFarm(farmId, payload.shedId);
        const { count } = await this.prisma.cattle.updateMany({
          where: scope,
          data: { shedId: payload.shedId },
        });
        return this.bulkResult(action, count, cattleIds.length);
      }
      case 'change_feed_group': {
        const { count } = await this.prisma.cattle.updateMany({
          where: scope,
          data: { feedGroupId: payload?.feedGroupId ?? null },
        });
        return this.bulkResult(action, count, cattleIds.length);
      }
      case 'mark_sold': {
        const { count } = await this.prisma.cattle.updateMany({
          where: { ...scope, isActive: true },
          data: {
            productionStatus: ProductionStatus.SOLD,
            status: CattleStatus.SOLD,
            isActive: false,
          },
        });
        return this.bulkResult(action, count, cattleIds.length);
      }
      case 'export': {
        const rows = await this.prisma.cattle.findMany({
          where: scope,
          orderBy: { tagNumber: 'asc' },
          include: this.defaultInclude(),
        });
        return {
          action,
          updated: 0,
          failed: cattleIds.length - rows.length,
          items: rows.map((row) => this.composeStatus(row)),
        };
      }
    }
  }

  async profile(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(
      farmId,
      id,
      this.defaultInclude(),
    );

    const childrenCount = await this.prisma.cattle.count({
      where: { farmId, OR: [{ motherId: id }, { fatherId: id }] },
    });
    const currentPregnancy = await this.prisma.pregnancy.findFirst({
      where: { cattleId: id, status: PregnancyStatus.ACTIVE },
      orderBy: { conceptionDate: 'desc' },
    });

    return {
      ...this.composeStatus(cattle),
      age: this.calculateAge(cattle.dateOfBirth),
      childrenCount,
      pregnancyStatus: currentPregnancy
        ? currentPregnancy.status
        : 'NOT_RECORDED',
    };
  }

  async ancestry(farmId: string, id: string, query: AncestryQueryDto) {
    await this.getCattleOrThrow(farmId, id);
    return this.buildAncestry(id, query.depth, new Set<string>());
  }

  async children(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    return this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        OR: [{ motherId: id }, { fatherId: id }],
      },
      orderBy: { tagNumber: 'asc' },
      select: this.summarySelect(),
    });
  }

  // ---- RAKHAL-039: Weight Recording -------------------------------------------

  async recordWeight(
    farmId: string,
    userId: string,
    id: string,
    dto: { weightKg: number; date: string; notes?: string },
  ) {
    await this.getCattleOrThrow(farmId, id);
    const record = await this.prisma.weightRecord.create({
      data: {
        cattleId: id,
        weightKg: dto.weightKg,
        recordedDate: new Date(dto.date),
        recordedBy: userId,
        notes: dto.notes,
      },
    });
    await this.prisma.cattle.update({
      where: { id },
      data: { lastWeightKg: dto.weightKg },
    });
    this.log.info('Weight recorded', {
      cattleId: id,
      farmId,
      kg: dto.weightKg,
    });
    return record;
  }

  async weightHistory(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    return this.prisma.weightRecord.findMany({
      where: { cattleId: id },
      orderBy: { recordedDate: 'desc' },
      take: 50,
    });
  }

  // ---- RAKHAL-040: Cattle Detail Tabs -----------------------------------------

  async tabOverview(farmId: string, id: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id, farmId },
      include: {
        bcsRecords: { orderBy: { recordedDate: 'desc' as const }, take: 10 },
        weightRecords: { orderBy: { recordedDate: 'desc' as const }, take: 20 },
        lactations: {
          where: { status: LactationStatus.ACTIVE },
          orderBy: { startDate: 'desc' as const },
          take: 1,
        },
      },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 7-day avg yield for this animal
    const yieldAgg = await this.prisma.milkLogEntry.aggregate({
      where: { cattleId: id, logDate: { gte: sevenDaysAgo } },
      _avg: { yieldL: true },
    });

    // Lactation curve: yield by DIM bucket (up to 120d of records)
    const lactationStart = cattle.lactations[0]?.startDate ?? null;
    const lactationCurve: { dim: number; yield_l: number }[] = [];
    if (lactationStart) {
      const entries = await this.prisma.milkLogEntry.findMany({
        where: { cattleId: id, logDate: { gte: lactationStart } },
        orderBy: { logDate: 'asc' },
        take: 200,
        select: { logDate: true, yieldL: true },
      });
      for (const e of entries) {
        const dim = this.daysBetween(lactationStart, e.logDate);
        const existing = lactationCurve.find((c) => c.dim === dim);
        if (existing) {
          existing.yield_l = this.round(existing.yield_l + e.yieldL);
        } else {
          lactationCurve.push({ dim, yield_l: this.round(e.yieldL) });
        }
      }
    }

    // Lifetime yield by year
    const allEntries = await this.prisma.milkLogEntry.findMany({
      where: { cattleId: id },
      select: { logDate: true, yieldL: true },
    });
    const byYear: Record<number, number> = {};
    for (const e of allEntries) {
      const yr = e.logDate.getFullYear();
      byYear[yr] = this.round((byYear[yr] ?? 0) + e.yieldL);
    }
    const lifetimeYield = Object.entries(byYear).map(([year, total_l]) => ({
      year: Number(year),
      total_l,
    }));

    // Recent milk records (last 7 days, summed per date)
    const recent = await this.prisma.milkLogEntry.findMany({
      where: { cattleId: id, logDate: { gte: sevenDaysAgo } },
      orderBy: { logDate: 'desc' },
      select: { logDate: true, yieldL: true, session: true },
    });
    const recentByDate: Record<
      string,
      { morning_l: number; noon_l: number; evening_l: number; total_l: number }
    > = {};
    for (const r of recent) {
      const key = r.logDate.toISOString().slice(0, 10);
      if (!recentByDate[key]) {
        recentByDate[key] = {
          morning_l: 0,
          noon_l: 0,
          evening_l: 0,
          total_l: 0,
        };
      }
      if (r.session === MilkSession.NOON) recentByDate[key].noon_l += r.yieldL;
      else if (r.session === MilkSession.EVENING)
        recentByDate[key].evening_l += r.yieldL;
      else recentByDate[key].morning_l += r.yieldL;
      recentByDate[key].total_l = this.round(
        recentByDate[key].morning_l +
          recentByDate[key].noon_l +
          recentByDate[key].evening_l,
      );
    }

    const prevWeight =
      cattle.weightRecords.length > 1 ? cattle.weightRecords[1].weightKg : null;

    return {
      aqr_score: cattle.aqrScore,
      aqr_change_pct: null as number | null,
      avg_daily_yield_7d: this.round(yieldAgg._avg.yieldL ?? 0),
      yield_change_pct: null as number | null,
      last_weight_kg: cattle.lastWeightKg,
      weight_change_pct:
        cattle.lastWeightKg && prevWeight
          ? this.pctChange(cattle.lastWeightKg, prevWeight)
          : null,
      bcs_records: cattle.bcsRecords.map((b) => ({
        date: b.recordedDate.toISOString().slice(0, 10),
        score: b.score,
      })),
      weight_history: cattle.weightRecords.map((w) => ({
        date: w.recordedDate.toISOString().slice(0, 10),
        weight_kg: w.weightKg,
      })),
      lactation_curve: lactationCurve,
      lifetime_yield: lifetimeYield,
      recent_milk_records: Object.entries(recentByDate).map(([date, v]) => ({
        date,
        ...v,
        status: 'normal',
      })),
    };
  }

  async tabReproduction(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);

    const [profile, heats, breedings, calvings] = await Promise.all([
      this.prisma.reproductionProfile.findUnique({ where: { cattleId: id } }),
      this.prisma.heatEvent.findMany({
        where: { cattleId: id },
        orderBy: { heatDateTime: 'desc' },
        take: 20,
      }),
      this.prisma.breedingEvent.findMany({
        where: { cattleId: id },
        orderBy: { breedingDate: 'desc' },
        take: 20,
        include: {
          pregnancies: { select: { status: true, conceptionDate: true } },
        },
      }),
      this.prisma.calvingEvent.findMany({
        where: { cattleId: id },
        orderBy: { calvingDate: 'desc' },
        take: 20,
        include: {
          calfBirths: {
            take: 1,
            include: {
              calf: {
                select: {
                  id: true,
                  name: true,
                  tagNumber: true,
                  gender: true,
                  dateOfBirth: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const activeLactation = await this.prisma.lactation.findFirst({
      where: { cattleId: id, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });

    return {
      total_calvings: profile?.totalCalvings ?? 0,
      avg_calving_interval_days: null as number | null,
      conception_rate_pct:
        profile && profile.totalBreedings > 0
          ? this.round(
              (profile.totalPregnancies / profile.totalBreedings) * 100,
            )
          : null,
      services_per_conception:
        profile && profile.totalPregnancies > 0
          ? this.round(profile.totalBreedings / profile.totalPregnancies)
          : null,
      current_dim: activeLactation
        ? this.daysBetween(activeLactation.startDate, new Date())
        : null,
      vwp_end_date: activeLactation
        ? new Date(
            activeLactation.startDate.getTime() + VWP_DEFAULT_DAYS * 86400_000,
          )
            .toISOString()
            .slice(0, 10)
        : null,
      reproductive_status: profile?.reproductiveStatus ?? null,
      heat_history: heats.map((h) => ({
        id: h.id,
        date: h.heatDateTime.toISOString().slice(0, 10),
        type: h.standingHeat ? 'standing_heat' : 'observed',
        detection_method: h.detectionMethod,
      })),
      ai_history: breedings
        .filter((b) => b.breedingMethod === BreedingMethod.AI)
        .map((b) => ({
          id: b.id,
          date: b.breedingDate.toISOString().slice(0, 10),
          inseminator: b.inseminator,
          outcome: b.status,
          pregnancy_confirmed_on:
            b.pregnancies[0]?.conceptionDate?.toISOString().slice(0, 10) ??
            null,
        })),
      calving_history: calvings.map((c) => {
        const firstCalf = c.calfBirths[0]?.calf ?? null;
        return {
          id: c.id,
          date: c.calvingDate.toISOString().slice(0, 10),
          ease_score: c.calvingEase,
          calf: firstCalf
            ? {
                id: firstCalf.id,
                tag: firstCalf.tagNumber,
                name: firstCalf.name,
                gender: firstCalf.gender,
                birth_date:
                  firstCalf.dateOfBirth?.toISOString().slice(0, 10) ?? null,
              }
            : null,
        };
      }),
    };
  }

  async tabHealth(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);

    const [activeCases, closedCases, bcsRecords] = await Promise.all([
      this.prisma.healthCase.findMany({
        where: {
          cattleId: id,
          farmId,
          status: { in: OPEN_HEALTH_CASE_STATUSES },
        },
        orderBy: { startDate: 'desc' },
        include: {
          treatmentLogs: {
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.healthCase.findMany({
        where: {
          cattleId: id,
          farmId,
          status: { notIn: OPEN_HEALTH_CASE_STATUSES },
        },
        orderBy: { closedDate: 'desc' },
        take: 10,
      }),
      this.prisma.bodyConditionScore.findMany({
        where: { cattleId: id },
        orderBy: { recordedDate: 'desc' },
        take: 10,
      }),
    ]);

    return {
      active_cases: activeCases.map((c) => ({
        id: c.id,
        diagnosis: c.diagnosis,
        priority: c.priority,
        status: c.status,
        opened_at: c.startDate.toISOString().slice(0, 10),
        withholding_active: c.isSafetyWithholdingActive,
        withholding_end_date:
          c.milkWithdrawalUntil?.toISOString().slice(0, 10) ?? null,
      })),
      treatment_history: closedCases.map((c) => ({
        id: c.id,
        diagnosis: c.diagnosis,
        status: c.status,
        opened_at: c.startDate.toISOString().slice(0, 10),
        closed_at: c.closedDate?.toISOString().slice(0, 10) ?? null,
      })),
      vaccination_history: [] as unknown[],
      bcs_trend: bcsRecords.map((b) => ({
        date: b.recordedDate.toISOString().slice(0, 10),
        score: b.score,
        alert: null as string | null,
      })),
    };
  }

  async tabFinance(farmId: string, id: string, period?: string) {
    await this.getCattleOrThrow(farmId, id);

    const now = new Date();
    const p =
      period ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = p.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const txns = await this.prisma.financeTransaction.findMany({
      where: {
        farmId,
        cattleId: id,
        date: { gte: start, lt: end },
        ...NON_VOID_TXN,
      },
      orderBy: { date: 'asc' },
    });

    let total_income = 0;
    let total_cost = 0;
    const expense_breakdown = { feed: 0, health: 0, breeding: 0, others: 0 };
    const income_breakdown = { milk_sales: 0, calf_sales: 0 };

    const EXPENSE_TYPES: FinanceTxnType[] = [
      FinanceTxnType.OPERATING_EXPENSE,
      FinanceTxnType.INVENTORY_PURCHASE,
    ];
    for (const t of txns) {
      if (t.type === FinanceTxnType.REVENUE) {
        total_income += t.amount;
        if (t.subType === 'milk') income_breakdown.milk_sales += t.amount;
        else if (t.subType === 'animal')
          income_breakdown.calf_sales += t.amount;
      } else if (EXPENSE_TYPES.includes(t.type)) {
        total_cost += t.amount;
        const sub = t.subType ?? '';
        if (sub === 'feed') expense_breakdown.feed += t.amount;
        else if (sub === 'health') expense_breakdown.health += t.amount;
        else if (sub === 'breeding') expense_breakdown.breeding += t.amount;
        else expense_breakdown.others += t.amount;
      }
    }

    // Monthly chart: last 6 months
    const sixMonthsAgo = new Date(year, month - 7, 1);
    const allTxns = await this.prisma.financeTransaction.findMany({
      where: {
        farmId,
        cattleId: id,
        date: { gte: sixMonthsAgo, lt: end },
        ...NON_VOID_TXN,
      },
      select: { date: true, type: true, amount: true },
    });
    const monthlyMap: Record<string, { income: number; cost: number }> = {};
    for (const t of allTxns) {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { income: 0, cost: 0 };
      if (t.type === FinanceTxnType.REVENUE) monthlyMap[key].income += t.amount;
      else if (EXPENSE_TYPES.includes(t.type)) monthlyMap[key].cost += t.amount;
    }
    const monthly_chart = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        income: this.round(v.income),
        cost: this.round(v.cost),
      }));

    return {
      period: p,
      total_income: this.round(total_income),
      total_cost: this.round(total_cost),
      net_profit: this.round(total_income - total_cost),
      expense_breakdown: {
        feed: this.round(expense_breakdown.feed),
        health: this.round(expense_breakdown.health),
        breeding: this.round(expense_breakdown.breeding),
        others: this.round(expense_breakdown.others),
      },
      income_breakdown: {
        milk_sales: this.round(income_breakdown.milk_sales),
        calf_sales: this.round(income_breakdown.calf_sales),
      },
      monthly_chart,
    };
  }

  async siblings(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(farmId, id);
    if (!cattle.motherId && !cattle.fatherId) {
      return [];
    }

    return this.prisma.cattle.findMany({
      where: {
        farmId,
        id: { not: id },
        isActive: true,
        OR: [
          ...(cattle.motherId ? [{ motherId: cattle.motherId }] : []),
          ...(cattle.fatherId ? [{ fatherId: cattle.fatherId }] : []),
        ],
      },
      orderBy: { tagNumber: 'asc' },
      select: this.summarySelect(),
    });
  }

  // ---- status composition -------------------------------------------------

  /**
   * Augment a cattle row with the derived status dimensions (PRD §8.1):
   * reproductive status from `ReproductionProfile`, health status derived from
   * active Healthcare records, and DIM from the active lactation.
   */
  private composeStatus<
    T extends {
      productionStatus: ProductionStatus;
      reproductionProfile?: { reproductiveStatus: ReproductiveStatus } | null;
      healthCases?: {
        status: string;
        isSafetyWithholdingActive: boolean;
        milkWithdrawalUntil: Date | null;
      }[];
      safetyWithdrawals?: {
        milkWithdrawalUntil: Date | null;
        meatWithdrawalUntil: Date | null;
      }[];
      lactations?: { startDate: Date }[];
    },
  >(row: T) {
    const now = new Date();
    const healthStatus = deriveHealthStatus(
      row.healthCases ?? [],
      row.safetyWithdrawals ?? [],
      now,
    );

    const activeLactation = (row.lactations ?? [])[0];
    const dim = activeLactation
      ? this.daysBetween(activeLactation.startDate, now)
      : null;

    return {
      ...row,
      reproductiveStatus: row.reproductionProfile?.reproductiveStatus ?? null,
      healthStatus,
      dim,
    };
  }

  /** Prisma `where` fragment for a derived health-status list filter (PRD §8.1). */
  private healthStatusWhere(
    filter: HealthStatusFilter,
  ): Prisma.CattleWhereInput {
    switch (filter) {
      case 'WITHHOLDING':
        return {
          safetyWithdrawals: { some: { status: 'ACTIVE' } },
        };
      case 'SICK':
      case 'IN_TREATMENT':
        return {
          healthCases: { some: { status: { in: OPEN_HEALTH_CASE_STATUSES } } },
        };
      case 'HEALTHY':
        return {
          healthCases: { none: { status: { in: OPEN_HEALTH_CASE_STATUSES } } },
          safetyWithdrawals: { none: { status: 'ACTIVE' } },
        };
      case 'QUARANTINE':
      default:
        // Quarantine is not tracked yet (deferred to Healthcare) — match none.
        return { id: '__none__' };
    }
  }

  /** Lifecycle (`status`/`isActive`) implied by a production-status change. */
  private lifecycleForProductionStatus(
    productionStatus: ProductionStatus,
  ): Pick<Prisma.CattleUpdateInput, 'status' | 'isActive'> {
    if (productionStatus === ProductionStatus.SOLD) {
      return { status: CattleStatus.SOLD, isActive: false };
    }
    if (productionStatus === ProductionStatus.DECEASED) {
      return { status: CattleStatus.DEAD, isActive: false };
    }
    return {};
  }

  /** Today's and yesterday's total logged yield (litres) for the farm. */
  private async dailyYield(farmId: string, now: Date) {
    const todayStart = this.utcMidnight(now);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

    const [today, yesterday] = await Promise.all([
      this.prisma.milkLogEntry.aggregate({
        where: { farmId, logDate: { gte: todayStart, lt: tomorrowStart } },
        _sum: { yieldL: true },
      }),
      this.prisma.milkLogEntry.aggregate({
        where: { farmId, logDate: { gte: yesterdayStart, lt: todayStart } },
        _sum: { yieldL: true },
      }),
    ]);

    return {
      todayL: today._sum.yieldL ?? 0,
      yesterdayL: yesterday._sum.yieldL ?? 0,
    };
  }

  private bulkResult(action: string, updated: number, requested: number) {
    return { action, updated, failed: requested - updated };
  }

  private async assertShedInFarm(farmId: string, shedId: string) {
    const shed = await this.prisma.shed.findFirst({
      where: { id: shedId, farmId, isActive: true },
      select: { id: true },
    });
    if (!shed) {
      throw new BadRequestException('Shed must belong to the same farm');
    }
  }

  private utcMidnight(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private pctChange(current: number, previous: number): number | null {
    if (!previous) {
      return current ? 100 : 0;
    }
    return this.round(((current - previous) / previous) * 100);
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  // ---- existing helpers ---------------------------------------------------

  private async validateReferences(
    farmId: string,
    dto: Partial<CreateCattleDto>,
  ) {
    if (dto.breedId) {
      const breed = await this.prisma.breed.findFirst({
        where: { id: dto.breedId, farmId, isActive: true },
        select: { id: true },
      });
      if (!breed) {
        throw new BadRequestException('Breed must belong to the same farm');
      }
    }

    if (dto.shedId) {
      await this.assertShedInFarm(farmId, dto.shedId);
    }
  }

  private async validateParentRules(
    farmId: string,
    cattleId: string | undefined,
    dto: Partial<CreateCattleDto>,
  ) {
    const parentIds = [dto.motherId, dto.fatherId].filter(
      (parentId): parentId is string => Boolean(parentId),
    );

    if (cattleId && parentIds.includes(cattleId)) {
      throw new BadRequestException('A cattle cannot be its own parent');
    }

    if (parentIds.length === 0) {
      return;
    }

    const parents = await this.prisma.cattle.findMany({
      where: { id: { in: parentIds }, farmId },
      select: { id: true },
    });

    if (parents.length !== new Set(parentIds).size) {
      throw new BadRequestException(
        'Mother and father must belong to the same farm',
      );
    }

    if (cattleId) {
      for (const parentId of parentIds) {
        const createsCycle = await this.isDescendant(parentId, cattleId);
        if (createsCycle) {
          throw new BadRequestException('Circular ancestry is not allowed');
        }
      }
    }
  }

  private async isDescendant(startId: string, targetId: string) {
    const queue = [startId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      if (currentId === targetId) return true;

      visited.add(currentId);
      const children = await this.prisma.cattle.findMany({
        where: { OR: [{ motherId: currentId }, { fatherId: currentId }] },
        select: { id: true },
      });

      queue.push(...children.map((child) => child.id));
    }

    return false;
  }

  private async buildAncestry(
    id: string,
    depth: number,
    visited: Set<string>,
  ): Promise<AncestryNode | null> {
    if (depth < 1 || visited.has(id)) {
      return null;
    }

    visited.add(id);

    const cattle = await this.prisma.cattle.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tagNumber: true,
        motherId: true,
        fatherId: true,
      },
    });

    if (!cattle) {
      return null;
    }

    return {
      id: cattle.id,
      name: cattle.name,
      tagNumber: cattle.tagNumber,
      mother: cattle.motherId
        ? await this.buildAncestry(cattle.motherId, depth - 1, new Set(visited))
        : null,
      father: cattle.fatherId
        ? await this.buildAncestry(cattle.fatherId, depth - 1, new Set(visited))
        : null,
    };
  }

  private async getCattleOrThrow<T extends Prisma.CattleInclude | undefined>(
    farmId: string,
    id: string,
    include?: T,
  ) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id, farmId },
      include,
    });

    if (!cattle) {
      this.log.warn('Cattle not found', { cattleId: id, farmId });
      throw new NotFoundException('Cattle not found');
    }

    return cattle;
  }

  private defaultInclude() {
    return {
      breed: true,
      shed: true,
      mother: { select: this.summarySelect() },
      father: { select: this.summarySelect() },
      reproductionProfile: { select: { reproductiveStatus: true } },
      healthCases: {
        where: { status: { in: OPEN_HEALTH_CASE_STATUSES } },
        select: {
          status: true,
          isSafetyWithholdingActive: true,
          milkWithdrawalUntil: true,
        },
        take: 5,
      },
      safetyWithdrawals: {
        where: { status: 'ACTIVE' as const },
        select: { milkWithdrawalUntil: true, meatWithdrawalUntil: true },
        take: 1,
      },
      lactations: {
        where: { status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' as const },
        select: { startDate: true },
        take: 1,
      },
    } satisfies Prisma.CattleInclude;
  }

  private summarySelect() {
    return {
      id: true,
      name: true,
      tagNumber: true,
    } satisfies Prisma.CattleSelect;
  }

  private calculateAge(dateOfBirth: Date | null) {
    if (!dateOfBirth) {
      return null;
    }

    const now = new Date();
    let years = now.getFullYear() - dateOfBirth.getFullYear();
    let months = now.getMonth() - dateOfBirth.getMonth();
    const days = now.getDate() - dateOfBirth.getDate();

    if (days < 0) {
      months -= 1;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months };
  }

  private daysBetween(start: Date, end: Date) {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
