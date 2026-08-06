import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreedingMethod,
  BreedingStatus,
  Cattle,
  CattleGender,
  CattleSourceType,
  CattleStatus,
  FarmModuleSettings,
  FinanceTxnType,
  HealthCaseStatus,
  LactationStartReason,
  LactationStatus,
  MilkSession,
  PregnancyStatus,
  Prisma,
  ProductionStatus,
  ReproductionState,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import {
  MediaService,
  type MediaUrls,
} from 'src/modules/media/application/services/media.service';
import { MediaCategory, MediaUsage } from '@prisma/client';
import { VWP_DEFAULT_DAYS } from '../../domain/cattle.constants';
import { deriveHealthStatus } from '../../domain/health-status';
import {
  buildAnimalCategoryWhere,
  deriveAnimalCategory,
  type AnimalCategoryGender,
} from '../../domain/animal-category';
// RAKHAL-279: reuse the reproduction module's already-exported PURE domain
// functions/types directly (deliberately not `ReproductionService` itself —
// see the `composeStatus()` doc comment below for why). These files have no
// Prisma/framework imports, so pulling them in here creates no NestJS module
// dependency at all (only `@Module({ imports })` graphs can cycle), let alone
// the real one that would form if `CattleModule` tried to import
// `ReproductionModule` (which already imports `CattleModule` for
// `AnimalHoldService` — see `reproduction.module.ts`'s own comment).
import {
  deriveReproductionAlerts,
  type ReproductionAlert,
} from 'src/modules/reproduction/domain/reproduction-alerts';
import {
  deriveLactationStage,
  type LactationStage,
} from 'src/modules/reproduction/domain/lactation-stage';
import {
  derivePregnancyStage,
  type PregnancyStage,
} from 'src/modules/reproduction/domain/pregnancy-stage';
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

/** Standard bovine gestation length, in days — mirrors the same fallback
 * constant in `reproduction.service.ts` (`derivePregnancyStage`'s close-up
 * projection). Duplicated rather than imported since it's a plain literal,
 * not a function/type worth cross-module coupling for. */
const DEFAULT_GESTATION_DAYS = 280;

/** Bundle of already-fetched reproduction context (RAKHAL-279) shared across
 * every row `composeStatus()` enriches in a single request — the farm's
 * `FarmModuleSettings` (one row, one query) and the set of cattle IDs with an
 * active `REPRODUCTIVE` `AnimalHold` (one bulk query for the whole page).
 * `undefined` opts a caller out of reproduction enrichment entirely (used by
 * the non-list/detail call sites — create/update/archive/restore/bulk-export
 * — which the ticket's acceptance criteria don't ask to enrich, keeping their
 * existing query cost unchanged). */
interface ReproductionContext {
  settings: FarmModuleSettings;
  reproductiveHoldCattleIds: Set<string>;
}

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
    private readonly media: MediaService,
    private readonly farmSettings: FarmSettingsService,
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

    // RAKHAL-291: registering straight into MILKING needs the same guarantee
    // `updateStatus()` enforces — a fresh cattle row never has a prior
    // `Lactation`, so a caller-supplied `lactationStartDate` is the only way
    // to satisfy it here (e.g. a purchased already-milking cow with no
    // calving history in this system).
    if (dto.productionStatus === ProductionStatus.MILKING) {
      // Invariant guard (mirrors `updateStatus()`'s own MILKING branch): a
      // fresh cattle row has no `ReproductionProfile` yet, so the only way
      // its effective `totalCalvings` can be non-zero here is a caller-
      // supplied `priorCalvings` (e.g. a purchased already-calved cow). A
      // heifer (0 calvings) can never be registered straight into Milking.
      if (!dto.priorCalvings) {
        throw new BadRequestException(
          'A heifer (no calving history) cannot be set to Milking. Record a calving event, or if she was purchased already-calved, supply priorCalvings.',
        );
      }
      if (!dto.lactationStartDate) {
        throw new BadRequestException(
          'lactationStartDate is required when registering a cow with productionStatus MILKING (e.g. a purchased already-milking cow with no calving history in this system).',
        );
      }
    }

    try {
      const cattle = await this.prisma.$transaction(async (tx) => {
        const created = await tx.cattle.create({
          data: {
            farmId,
            name: dto.name,
            tagNumber: dto.tagNumber,
            image: dto.image,
            breedId: dto.breedId,
            gender: dto.gender,
            dateOfBirth: dto.dateOfBirth
              ? new Date(dto.dateOfBirth)
              : undefined,
            purpose: dto.purpose,
            status: dto.status ?? CattleStatus.ACTIVE,
            productionStatus: dto.productionStatus,
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
            // Seed a reproduction profile when an initial reproductive status
            // and/or real prior calving history (`priorCalvings`) is supplied
            // so the status dimension — and the MILKING/HEIFER invariant —
            // has a home (PRD §8.1/§8.4).
            ...(dto.reproductiveStatus || dto.priorCalvings
              ? {
                  reproductionProfile: {
                    create: {
                      ...(dto.reproductiveStatus
                        ? { reproductiveStatus: dto.reproductiveStatus }
                        : {}),
                      ...(dto.priorCalvings
                        ? { totalCalvings: dto.priorCalvings }
                        : {}),
                    },
                  },
                }
              : {}),
          },
        });

        // RAKHAL-291: purchase-intake Lactation, same shape/`startReason` as
        // `updateStatus()`'s own branch — a brand-new cattle row has no prior
        // Lactation, so this is always lactationNumber 1.
        if (
          dto.productionStatus === ProductionStatus.MILKING &&
          dto.lactationStartDate
        ) {
          await tx.lactation.create({
            data: {
              cattleId: created.id,
              lactationNumber: 1,
              startDate: new Date(dto.lactationStartDate),
              status: LactationStatus.ACTIVE,
              startReason: LactationStartReason.PURCHASE_IMPORT,
            },
          });
        }

        // Re-fetch with the full include so a just-created Lactation (and its
        // derived `dim`) is reflected in this response, not just on the next
        // GET — `defaultInclude()`'s `lactations` snapshot was taken before
        // the row above existed.
        return tx.cattle.findUniqueOrThrow({
          where: { id: created.id },
          include: this.defaultInclude(),
        });
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
      ...(query.animalCategory
        ? buildAnimalCategoryWhere(query.animalCategory, new Date())
        : {}),
    };

    const rows = await this.prisma.cattle.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.defaultInclude(),
    });

    // RAKHAL-279: one settings row + one bulk hold query for the whole page,
    // reused across every row's composeStatus() call (never per-row).
    const reproCtx = await this.buildReproductionContext(
      farmId,
      rows.map((row) => row.id),
    );

    const page = toCursorPage(
      rows.map((row) => this.composeStatus(row, reproCtx)),
      query,
    );
    // List view carries only the thumbnail (RAKHAL-009) — cheap payload.
    const items = await this.attachListPhotos(farmId, page.items);
    return { ...page, items };
  }

  async findOne(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(
      farmId,
      id,
      this.defaultInclude(),
    );
    const reproCtx = await this.buildReproductionContext(farmId, [id]);
    return this.attachDetailPhoto(this.composeStatus(cattle, reproCtx));
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
      // v2 correction (RAKHAL-269/271): `Cattle.lactationStartDate` is gone —
      // lactation start now lives solely on `Lactation.startDate`. Moving to
      // MILKING requires an active `Lactation` row to already exist (created
      // by `createCalvingEvent`, or — RAKHAL-291 — a purchase-intake flow
      // right here). This is still a stub check — richer "does the newest
      // Lactation actually belong to this cow's current cycle" logic is a
      // later ticket's job.
      if (dto.productionStatus === ProductionStatus.MILKING) {
        const [activeLactation, reproductionProfile] = await Promise.all([
          this.prisma.lactation.findFirst({
            where: { cattleId: id, status: LactationStatus.ACTIVE },
            select: { id: true },
          }),
          this.prisma.reproductionProfile.findUnique({
            where: { cattleId: id },
            select: { totalCalvings: true },
          }),
        ]);

        // Invariant guard: a heifer (no calving history) can never be set to
        // Milking. An existing profile's own `totalCalvings` always wins; a
        // profile-less cow (e.g. never assessed) falls back to a caller-
        // supplied `priorCalvings` for this purchase-intake path.
        const effectiveTotalCalvings = reproductionProfile
          ? reproductionProfile.totalCalvings
          : (dto.priorCalvings ?? 0);
        if (effectiveTotalCalvings === 0) {
          throw new BadRequestException(
            'A heifer (no calving history) cannot be set to Milking. Record a calving event, or if she was purchased already-calved, supply priorCalvings.',
          );
        }

        if (!activeLactation) {
          // RAKHAL-291: no auto-stamped Lactation from a calving means either
          // this cow has never calved in this system (e.g. purchased already
          // milking) or her lactation genuinely ended — either way, without a
          // caller-supplied start date there is nothing safe to create.
          if (!dto.lactationStartDate) {
            throw new BadRequestException(
              'No active lactation on record. Provide lactationStartDate to record this cow as milking (e.g. for a purchased cow with no calving history in this system).',
            );
          }

          const lactationCount = await this.prisma.lactation.count({
            where: { cattleId: id },
          });
          const lactationStartDate = dto.lactationStartDate;

          // Create the purchase-intake Lactation and flip productionStatus in
          // the same transaction so the two never drift apart. A profile-less
          // cow with a supplied `priorCalvings` also gets its
          // `ReproductionProfile` created here — one write, not two.
          await this.prisma.$transaction(async (tx) => {
            await tx.lactation.create({
              data: {
                cattleId: id,
                lactationNumber: lactationCount + 1,
                startDate: new Date(lactationStartDate),
                status: LactationStatus.ACTIVE,
                startReason: LactationStartReason.PURCHASE_IMPORT,
              },
            });
            if (!reproductionProfile && dto.priorCalvings) {
              await tx.reproductionProfile.create({
                data: { cattleId: id, totalCalvings: dto.priorCalvings },
              });
            }
            await tx.cattle.update({
              where: { id },
              data: { productionStatus: dto.productionStatus },
            });
          });
        } else {
          await this.prisma.cattle.update({
            where: { id },
            data: { productionStatus: dto.productionStatus },
          });
        }
      } else {
        await this.prisma.cattle.update({
          where: { id },
          data: { productionStatus: dto.productionStatus },
        });
      }
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

    // productionStatus can no longer hold lifecycle states (RAKHAL-269) — any
    // archive path nulls it out, the lifecycle itself is recorded on `status`.
    const data: Prisma.CattleUpdateInput = {
      isActive: false,
      productionStatus: null,
    };
    if (dto.reason === 'sold') {
      data.status = CattleStatus.SOLD;
    } else if (dto.reason === 'deceased') {
      data.status = CattleStatus.DEAD;
    } else if (dto.reason === 'culled') {
      data.status = CattleStatus.CULLED;
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
            is: { reproductiveStatus: ReproductionState.OPEN },
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
            productionStatus: null,
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

  // ---- RAKHAL-009: Profile photo ------------------------------------------

  /**
   * Set (or replace) the cattle profile photo. The image is validated + Sharp-
   * processed + stored first; only once it's READY do we point the cattle at it
   * and soft-delete the previous photo (so a failed upload never blanks the
   * existing one). Gated by `cattle.update` at the controller.
   */
  async setProfilePhoto(
    farmId: string,
    userId: string,
    id: string,
    file: { buffer: Buffer; originalname?: string; size?: number },
  ): Promise<MediaUrls> {
    const cattle = await this.getCattleOrThrow(farmId, id);
    const asset = await this.media.uploadImage({
      farmId,
      uploadedByUserId: userId,
      category: MediaCategory.CATTLE,
      usage: MediaUsage.PROFILE_PHOTO,
      file,
    });

    const previousId = cattle.profilePhotoAssetId;
    await this.prisma.cattle.update({
      where: { id },
      data: { profilePhotoAssetId: asset.id },
    });
    if (previousId && previousId !== asset.id) {
      await this.media
        .softDeleteById(farmId, previousId, userId)
        .catch(() => undefined);
    }
    this.log.info('Cattle profile photo set', {
      cattleId: id,
      farmId,
      assetId: asset.id,
    });
    return this.media.signUrls(asset, true);
  }

  async removeProfilePhoto(farmId: string, userId: string, id: string) {
    const cattle = await this.getCattleOrThrow(farmId, id);
    if (cattle.profilePhotoAssetId) {
      const previousId = cattle.profilePhotoAssetId;
      await this.prisma.cattle.update({
        where: { id },
        data: { profilePhotoAssetId: null },
      });
      await this.media
        .softDeleteById(farmId, previousId, userId)
        .catch(() => undefined);
    }
    return { removed: true };
  }

  async getProfilePhoto(farmId: string, id: string): Promise<MediaUrls> {
    const cattle = await this.getCattleOrThrow(farmId, id);
    if (!cattle.profilePhotoAssetId) {
      throw new NotFoundException('No profile photo for this cattle');
    }
    return this.media.presentUrls(farmId, cattle.profilePhotoAssetId, true);
  }

  /** Enrich a list of composed cattle with their thumbnail URLs (batched). */
  private async attachListPhotos<
    T extends { profilePhotoAssetId: string | null },
  >(
    farmId: string,
    items: T[],
  ): Promise<(T & { profile_photo: MediaUrls | null })[]> {
    const ids = items
      .map((i) => i.profilePhotoAssetId)
      .filter((x): x is string => Boolean(x));
    const signed = await this.media.signThumbs(farmId, ids);
    return items.map((i) => ({
      ...i,
      profile_photo: i.profilePhotoAssetId
        ? (signed.get(i.profilePhotoAssetId) ?? null)
        : null,
    }));
  }

  /** Enrich a single composed cattle with full + thumb URLs (detail view). */
  private async attachDetailPhoto<
    T extends { profilePhotoAssetId: string | null; farmId: string },
  >(item: T): Promise<T & { profile_photo: MediaUrls | null }> {
    const photo = item.profilePhotoAssetId
      ? await this.media
          .presentUrls(item.farmId, item.profilePhotoAssetId, true)
          .catch(() => null)
      : null;
    return { ...item, profile_photo: photo };
  }

  // ---- status composition -------------------------------------------------

  /**
   * Augment a cattle row with the derived status dimensions (PRD §8.1,
   * extended RAKHAL-279): reproductive status + reproduction alerts +
   * lactation/pregnancy stage (sourced from `ReproductionProfile` plus the
   * pure reproduction-domain derive functions), health status derived from
   * active Healthcare records, and DIM from the active lactation.
   *
   * **Design note (RAKHAL-279)**: this deliberately does NOT call
   * `ReproductionService.summary()` even though that method already returns
   * all four reproduction fields together. Two independent reasons:
   *   1. **Circular module dependency**: `ReproductionModule` already imports
   *      `CattleModule` (for `AnimalHoldService`, RAKHAL-280/272). Injecting
   *      `ReproductionService` into `CattleService` (or `CattleController`)
   *      would require `CattleModule` to import `ReproductionModule` back —
   *      a genuine cycle, only fixable with `forwardRef()` on both sides
   *      (touching `reproduction.module.ts`, outside this ticket's Lane).
   *   2. **`summary()` isn't a pure read**: it calls `refreshProfile()`
   *      first, which *writes* `ReproductionProfile` as a side effect. Doing
   *      that once for a `GET /cattle/:id` is already borderline; doing it
   *      once per row for a paginated `GET /cattle` would mean every list
   *      page load silently mutates every cow's reproduction row — exactly
   *      the "read method with a hidden write side-effect" anti-pattern the
   *      v1→v2 adjudication flagged and fixed for `activeMilkWithholdingCattleIds()`.
   *      Reintroducing it here at the Cattle layer would be a regression.
   *
   * Instead, this reuses the actual canonical derivation logic — the
   * exported pure functions `deriveReproductionAlerts`/`deriveLactationStage`/
   * `derivePregnancyStage` (no Prisma/framework imports, the same functions
   * `ReproductionService.summary()` itself calls) — fed by data pulled
   * through `defaultInclude()`'s relation fan-out (a handful of extra
   * `include`s, batched by Prisma into flat `WHERE cattleId IN (...)`
   * queries regardless of page size — not a per-row round trip) plus one
   * settings row and one bulk `AnimalHold` query per request, both shared
   * across every row via `reproCtx`. No reproduction data is re-derived with
   * different logic than `summary()` uses — it's the same functions, just
   * called directly instead of through the service, which sidesteps both
   * problems above. See `docs/DECISIONS.md` for the full write-up.
   *
   * `reproCtx` is `undefined` for call sites that don't need the enrichment
   * (create/update/archive/restore/bulk-export) — only `findAll`/`findOne`
   * (the ticket's actual scope, `GET /cattle` + `GET /cattle/:id`) build and
   * pass it. Reproduction alerts/stages are only meaningful for female cattle
   * with an assessed `reproductiveStatus`; anyone else (male/calf/steer, or a
   * female whose state hasn't been assessed yet, e.g. mid-migration-backfill)
   * gets `reproductionAlerts: []`, `lactationStage: null`, `pregnancyStage: null`.
   */
  private composeStatus<
    T extends {
      id: string;
      gender: AnimalCategoryGender;
      dateOfBirth: Date | null;
      reproductionProfile?: {
        reproductiveStatus: ReproductionState | null;
        totalCalvings?: number;
        totalAbortions?: number;
        lastCalvingDate?: Date | null;
      } | null;
      healthCases?: {
        status: string;
      }[];
      lactations?: { startDate: Date }[];
      heatEvents?: { heatDateTime: Date }[];
      breedingEvents?: {
        status: BreedingStatus;
        breedingDate: Date;
        expectedPregnancyCheckDate: Date | null;
      }[];
      pregnancies?: {
        conceptionDate: Date;
        expectedCalvingDate: Date | null;
      }[];
      dryPeriods?: { id: string }[];
    },
  >(row: T, reproCtx?: ReproductionContext) {
    const now = new Date();
    const healthStatus = deriveHealthStatus(row.healthCases ?? []);

    const activeLactation = (row.lactations ?? [])[0];
    const dim = activeLactation
      ? this.daysBetween(activeLactation.startDate, now)
      : null;

    const animalCategory = deriveAnimalCategory({
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
      now,
    });

    const reproductionState =
      row.reproductionProfile?.reproductiveStatus ?? null;

    let reproductionAlerts: ReproductionAlert[] = [];
    let lactationStage: LactationStage | null = null;
    let pregnancyStage: PregnancyStage | null = null;

    if (reproCtx && row.gender === CattleGender.FEMALE && reproductionState) {
      const { settings, reproductiveHoldCattleIds } = reproCtx;
      const recentHeat = (row.heatEvents ?? [])[0] ?? null;
      const lastBreeding = (row.breedingEvents ?? [])[0] ?? null;
      const currentPregnancy = (row.pregnancies ?? [])[0] ?? null;
      const lastCalvingDate = row.reproductionProfile?.lastCalvingDate ?? null;

      const breedingsSinceLastSuccess = (row.breedingEvents ?? []).filter(
        (b) =>
          !lastCalvingDate ||
          b.breedingDate.getTime() > lastCalvingDate.getTime(),
      ).length;
      const daysOpen =
        lastCalvingDate && reproductionState !== ReproductionState.PREGNANT
          ? this.daysBetween(lastCalvingDate, now)
          : null;

      reproductionAlerts = deriveReproductionAlerts({
        now,
        reproductionState,
        recentHeat: recentHeat
          ? { heatDateTime: recentHeat.heatDateTime }
          : null,
        heatWindowDays: settings.reproHeatWindowDays,
        lastBreeding: lastBreeding
          ? {
              status: lastBreeding.status,
              expectedPregnancyCheckDate:
                lastBreeding.expectedPregnancyCheckDate,
            }
          : null,
        currentPregnancy: currentPregnancy
          ? { expectedCalvingDate: currentPregnancy.expectedCalvingDate }
          : null,
        closeUpWindowDays: settings.reproCloseUpWindowDays,
        overdueCheckDays: settings.reproOverduePregnancyCheckDays,
        calvingOverdueDays: settings.reproCalvingOverdueDays,
        breedingsSinceLastSuccess,
        repeatBreederThreshold: settings.reproRepeatBreederThreshold,
        daysOpen,
        longDaysOpenThresholdDays: settings.reproLongDaysOpenDays,
        totalAbortions: row.reproductionProfile?.totalAbortions ?? 0,
        hasReproductiveHold: reproductiveHoldCattleIds.has(row.id),
      });

      lactationStage = deriveLactationStage({
        now,
        lactationStartDate: activeLactation?.startDate ?? null,
        isInActiveDryPeriod: (row.dryPeriods ?? []).length > 0,
        farmSettings: {
          freshDays: settings.lactationFreshDays,
          earlyDays: settings.lactationEarlyDays,
          midDays: settings.lactationMidDays,
        },
      });

      pregnancyStage = derivePregnancyStage({
        now,
        conceptionDate: currentPregnancy?.conceptionDate ?? null,
        farmSettings: {
          earlyDays: settings.pregnancyEarlyDays,
          midDays: settings.pregnancyMidDays,
          closeUpWindowDays: settings.reproCloseUpWindowDays,
          gestationDays: DEFAULT_GESTATION_DAYS,
        },
      });
    }

    return {
      ...row,
      reproductiveStatus: reproductionState,
      reproductionAlerts,
      lactationStage,
      pregnancyStage,
      healthStatus,
      dim,
      animalCategory,
    };
  }

  /**
   * Fetch the shared reproduction-enrichment context for a request: the
   * farm's `FarmModuleSettings` (one row) + the set of cattle IDs among
   * `cattleIds` that currently have an active `REPRODUCTIVE` `AnimalHold`
   * (one bulk query). Computed once per `findAll`/`findOne` call and reused
   * across every row `composeStatus()` enriches — never per row. `AnimalHold`
   * has no Prisma relation to `Cattle` (plain scalar FKs, RAKHAL-280), so this
   * is a direct query rather than an `include` — still a single query for the
   * whole page/request, not one per cow.
   */
  private async buildReproductionContext(
    farmId: string,
    cattleIds: string[],
  ): Promise<ReproductionContext> {
    if (cattleIds.length === 0) {
      const settings = await this.farmSettings.getEffective(farmId);
      return { settings, reproductiveHoldCattleIds: new Set() };
    }

    const [settings, holds] = await Promise.all([
      this.farmSettings.getEffective(farmId),
      this.prisma.animalHold.findMany({
        where: {
          farmId,
          cattleId: { in: cattleIds },
          type: 'REPRODUCTIVE',
          endedAt: null,
        },
        select: { cattleId: true },
      }),
    ]);

    return {
      settings,
      reproductiveHoldCattleIds: new Set(holds.map((h) => h.cattleId)),
    };
  }

  /** Prisma `where` fragment for a derived health-status list filter (PRD §8.1).
   *
   * `WITHHOLDING` is kept as a filter value (RAKHAL-279) even though
   * `DerivedHealthStatus` no longer includes it as a *returned* value — the
   * consumer frontend's cattle filters (`features/cattle/components/cattle-filters.tsx`)
   * ship this option live today, and the underlying `where` (an active
   * `SafetyWithdrawal`) is still a real, useful query regardless of which
   * dimension conceptually "owns" the badge now. See `docs/DECISIONS.md`.
   */
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
      reproductionProfile: {
        select: {
          reproductiveStatus: true,
          totalCalvings: true,
          // RAKHAL-279: feed `deriveReproductionAlerts`'s ABORTION_HISTORY
          // check + the daysOpen/breedingsSinceLastSuccess anchor.
          totalAbortions: true,
          lastCalvingDate: true,
        },
      },
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
      // RAKHAL-279 — reproduction enrichment (`composeStatus()`). Each of
      // these is a single batched `WHERE cattleId IN (...)` query regardless
      // of how many `Cattle` rows are in the page (Prisma's nested-`include`
      // fan-out), not a per-row round trip.
      heatEvents: {
        orderBy: { heatDateTime: 'desc' as const },
        select: { heatDateTime: true },
        take: 1,
      },
      breedingEvents: {
        orderBy: { breedingDate: 'desc' as const },
        select: {
          status: true,
          breedingDate: true,
          expectedPregnancyCheckDate: true,
        },
        // Bounded history window, not "since last calving" (Prisma can't
        // express a per-row dynamic date filter declaratively) — 20 mirrors
        // `tabReproduction()`'s own existing take limit for the same relation.
        take: 20,
      },
      pregnancies: {
        where: { status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' as const },
        select: { conceptionDate: true, expectedCalvingDate: true },
        take: 1,
      },
      dryPeriods: {
        where: { actualEndDate: null },
        select: { id: true },
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
