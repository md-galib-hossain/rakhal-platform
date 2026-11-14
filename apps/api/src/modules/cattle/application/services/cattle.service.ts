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
  CattleDispositionType,
  CattleGender,
  CattleSourceType,
  HerdStatus,
  FarmModuleSettings,
  HealthCaseStatus,
  HeatDetectionMethod,
  LactationEndReason,
  LactationStartReason,
  LactationStatus,
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  Prisma,
  ProductionStatus,
  ReproductionState,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  DEFAULT_FARM_TIMEZONE,
  localDayStart,
} from 'src/common/farm-time/farm-time';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { AnimalHoldService } from './animal-hold.service';
import { AnimalUpcomingEventsService } from './animal-upcoming-events.service';
import { type HistoryItemDto } from '../../presentation/dto/intake.dto';
import { historyEvent } from '../../domain/history-event';
import { AnimalEventWriteService } from 'src/modules/animal-events/application/services/animal-event-write.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { EligibilityService } from 'src/modules/animal-events/application/services/eligibility.service';
import {
  MediaService,
  type MediaUrls,
} from 'src/modules/media/application/services/media.service';
import { MediaCategory, MediaUsage } from '@prisma/client';
import { activeHerd, anyRecord, notDeleted } from '../../domain/herd-scope';
import { deriveHealthStatus } from '../../domain/health-status';
import {
  buildAnimalCategoryWhere,
  deriveAnimalCategory,
  type AnimalCategoryGender,
} from '../../domain/animal-category';
import {
  deriveLifecycleSubStage,
  buildLifecycleSubStageWhere,
} from '../../domain/lifecycle-bands';
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
// RAKHAL-307: unlike the pure-domain imports above, this is a real injected
// service (writes ReproductionProfile/BreedingEvent/Pregnancy/Lactation
// derived state) — CattleModule now imports ReproductionModule via
// forwardRef() to get it (see cattle.module.ts's own comment for why).
import { ReproductionDerivationService } from 'src/modules/reproduction/application/services/reproduction-derivation.service';
// RAKHAL-319: same forwardRef() cycle as ReproductionDerivationService above
// (CattleModule already imports ReproductionModule via forwardRef) — reused
// here to call the real createBreedingEvent/createHeatEvent for intake
// instead of duplicating their logic inline.
import { ReproductionService } from 'src/modules/reproduction/application/services/reproduction.service';
import { AncestryQueryDto } from '../../presentation/dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../../presentation/dto/archive-cattle.dto';
import { BulkCattleDto } from '../../presentation/dto/bulk-cattle.dto';
import { CreateCattleDto } from '../../presentation/dto/create-cattle.dto';
import {
  HealthStatusFilter,
  ListCattleQueryDto,
} from '../../presentation/dto/list-cattle-query.dto';
import { UpcomingEventsQueryDto } from '../../presentation/dto/upcoming-events-query.dto';
import { UpdateCattleDto } from '../../presentation/dto/update-cattle.dto';
import { computeAqrScoreAsOf } from './aqr-trend';

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

/** Input to {@link CattleService.recordDisposition} (RAKHAL-344). Plain TS
 * interface, not a class-validator DTO — no controller route exposes this
 * method yet (that's for whichever ticket wires the real HTTP entry point;
 * RAKHAL-345's `SellAnimal` use case calls this directly as a service-to-
 * service call). `saleId`/`price`/`reason` are all optional: only `SALE`
 * realistically carries a `saleId` (RAKHAL-339's `Sale` document), and
 * DEATH/CULL/TRANSFER may have no price at all. */
export interface RecordCattleDispositionInput {
  type: CattleDispositionType;
  saleId?: string | null;
  date: Date;
  price?: Prisma.Decimal | number | string | null;
  reason?: string | null;
}

/** `Cattle.status` each disposition type resolves to (RAKHAL-344) — mirrors
 * `archiveWithReason`'s own `sold`/`deceased`/`culled` → `HerdStatus`
 * mapping (`:750-760` above), plus `TRANSFER` → `TRANSFERRED`, which
 * `archiveWithReason` has no reason string for. */
const DISPOSITION_CATTLE_STATUS: Record<CattleDispositionType, HerdStatus> = {
  [CattleDispositionType.SALE]: HerdStatus.SOLD,
  [CattleDispositionType.DEATH]: HerdStatus.DECEASED,
  [CattleDispositionType.CULL]: HerdStatus.CULLED,
  [CattleDispositionType.TRANSFER]: HerdStatus.SOLD, // RAKHAL-397: TRANSFERRED folded into SOLD; CattleDisposition.type keeps the real reason
};

/** Which disposition types end the animal's ACTIVE `Lactation`, and with
 * which `LactationEndReason` (RAKHAL-344 AC: "if type is SALE or DEATH or
 * CULL"). `TRANSFER` deliberately has no entry — a transferred animal is
 * leaving this farm's herd, not exiting production the way a sale/death/cull
 * does, so its lactation is left open (mirrors that `archiveWithReason` has
 * no `LactationEndReason` for a plain `archived` reason either). */
const DISPOSITION_LACTATION_END_REASON: Partial<
  Record<CattleDispositionType, LactationEndReason>
> = {
  [CattleDispositionType.SALE]: LactationEndReason.SOLD,
  [CattleDispositionType.DEATH]: LactationEndReason.DEATH,
  [CattleDispositionType.CULL]: LactationEndReason.CULLED,
};

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
    private readonly derivation: ReproductionDerivationService,
    private readonly reproductionService: ReproductionService,
    private readonly taskService: TaskService,
    private readonly animalHoldService: AnimalHoldService,
    private readonly logger: LoggerService,
    // RAKHAL-475: trailing so existing positional construction (the spec's `make()`) keeps working.
    private readonly upcomingEventsService: AnimalUpcomingEventsService,
    // RAKHAL-480: trailing for the same reason; only `findAll`'s `?category=` uses it.
    private readonly eligibility?: EligibilityService,
    // RAKHAL-483: history[] items are recorded through the event write API.
    private readonly eventWriter?: AnimalEventWriteService,
  ) {
    this.log = this.logger.setContext(CattleService.name);
  }

  async create(farmId: string, userId: string, dto: CreateCattleDto) {
    // Enforce the plan's herd ceiling before adding (RAKHAL-219, CAT limit).
    const activeCount = await this.prisma.cattle.count({
      where: activeHerd(farmId),
    });
    await this.subscriptionAccess.assertCattleLimit(farmId, activeCount);

    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, undefined, dto);

    // RAKHAL-483: lactation state in `history[]` maps onto the intake fields
    // the transaction below already backs with a real Lactation / DryPeriod.
    for (const h of dto.history ?? []) {
      if (h.kind === 'MILKING_SINCE' && h.date) {
        dto.productionStatus ??= ProductionStatus.MILKING;
        dto.priorCalvings ??= 1;
        dto.intakeLactation ??= { estimatedCalvingDate: h.date };
      }
      if (h.kind === 'DRY_SINCE' && h.date) {
        dto.productionStatus ??= ProductionStatus.DRY;
        dto.dryOffStartDate ??= h.date;
      }
    }
    // RAKHAL-319 field mapped onto history (fixes C7: an intake AI no longer needs a cost).
    const historyItems: HistoryItemDto[] = [...(dto.history ?? [])];
    if (dto.intakeBreeding) {
      historyItems.push({
        kind: 'LAST_BREEDING',
        date: dto.intakeBreeding.breedingDate,
        method: dto.intakeBreeding.breedingMethod,
      });
    }

    // RAKHAL-291/307: registering straight into MILKING needs the same
    // guarantee `updateStatus()` enforces — a fresh cattle row never has a
    // prior `Lactation`, so a caller-supplied `lactationStartDate` or
    // `intakeLactation` is the only way to satisfy it here (e.g. a purchased
    // already-milking cow with no calving history in this system).
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
      if (!dto.lactationStartDate && !dto.intakeLactation) {
        throw new BadRequestException(
          'lactationStartDate or intakeLactation is required when registering a cow with productionStatus MILKING (e.g. a purchased already-milking cow with no calving history in this system).',
        );
      }
    }

    // RD-048: DRY at intake must be backed by a real DryPeriod, the same way MILKING is backed
    // by a real Lactation above — otherwise the stored productionStatus would be an unverified
    // raw write derivation can never reconcile (that was the whole bug this closes).
    if (dto.productionStatus === ProductionStatus.DRY && !dto.dryOffStartDate) {
      throw new BadRequestException(
        'dryOffStartDate is required when registering a cow with productionStatus DRY (e.g. a purchased already-dry cow with no lactation history in this system).',
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const cattle = await tx.cattle.create({
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
            herdStatus: dto.status ?? HerdStatus.ACTIVE,
            // RD-048: no longer written raw here — always derived post-commit by
            // `refreshDerivedState` below, from the real Lactation/DryPeriod fact this same
            // transaction creates when `productionStatus` was requested (MILKING/DRY below).
            shedId: dto.shedId,
            lastWeightKg: dto.weightKg,
            lastBcs: dto.bcs,
            motherId: dto.motherId,
            fatherId: dto.fatherId,
            sourceType: dto.sourceType ?? CattleSourceType.UNKNOWN,
            color: dto.color,
            notes: dto.notes,
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
            // RAKHAL-307: every FEMALE gets a ReproductionProfile on create —
            // previously conditional on an initial reproductiveStatus/
            // priorCalvings being supplied, which left the status dimension
            // (and composeStatus()'s alert gate at `reproductionState &&`)
            // silently disabled forever for any female registered without
            // one. `reproductiveStatus` itself is no longer settable here
            // (derived by `refreshDerivedState` below); `priorCalvings`
            // still seeds real prior-calving history when supplied.
            ...(dto.gender === CattleGender.FEMALE
              ? {
                  reproductionProfile: {
                    create: {
                      ...(dto.priorCalvings
                        ? { totalCalvings: dto.priorCalvings }
                        : {}),
                    },
                  },
                }
              : {}),
          },
        });

        if (dto.animalGroupId) {
          await tx.animalGroupMember.create({
            data: {
              groupId: dto.animalGroupId,
              cattleId: cattle.id,
              farmId,
              addedBy: userId,
            },
          });
        }

        // RAKHAL-307: "she is already pregnant" — a synthetic
        // PregnancyDiagnosis (method PURCHASE_INTAKE) + its Pregnancy, same
        // shape `createPregnancyDiagnosis` writes, so the intake declaration
        // is editable via RAKHAL-305 and shows in the events feed (not a
        // bare Pregnancy row).
        if (dto.intakePregnancy) {
          const conceptionDate = dto.intakePregnancy.conceptionDate
            ? new Date(dto.intakePregnancy.conceptionDate)
            : this.addDays(
                new Date(dto.intakePregnancy.expectedCalvingDate!),
                -DEFAULT_GESTATION_DAYS,
              );
          const expectedCalvingDate = dto.intakePregnancy.expectedCalvingDate
            ? new Date(dto.intakePregnancy.expectedCalvingDate)
            : this.addDays(conceptionDate, DEFAULT_GESTATION_DAYS);

          const diagnosis = await tx.pregnancyDiagnosis.create({
            data: {
              cattleId: cattle.id,
              diagnosisDate: new Date(),
              result: PregnancyDiagnosisResult.PREGNANT,
              diagnosisMethod: PregnancyDiagnosisMethod.PURCHASE_INTAKE,
              expectedCalvingDate,
            },
          });
          await tx.pregnancy.create({
            data: {
              cattleId: cattle.id,
              conceptionDate,
              expectedCalvingDate,
              status: PregnancyStatus.ACTIVE,
              sourceDiagnosisId: diagnosis.id,
            },
          });
        }

        // RAKHAL-307: "she is already milking" — preferred over the older
        // bare `lactationStartDate` field when both are supplied; reuses
        // `createPurchasedLactation`'s exact start-date precedence (DIM >
        // estimated calving date > now).
        if (dto.productionStatus === ProductionStatus.MILKING) {
          if (dto.intakeLactation) {
            const now = new Date();
            const startDate =
              dto.intakeLactation.estimatedDaysInMilk !== undefined
                ? this.addDays(now, -dto.intakeLactation.estimatedDaysInMilk)
                : dto.intakeLactation.estimatedCalvingDate
                  ? new Date(dto.intakeLactation.estimatedCalvingDate)
                  : now;
            await tx.lactation.create({
              data: {
                cattleId: cattle.id,
                lactationNumber:
                  dto.intakeLactation.estimatedLactationNumber ?? 1,
                startDate,
                status: LactationStatus.ACTIVE,
                startReason: LactationStartReason.PURCHASED_LACTATING,
                isEstimated: true,
                estimatedLactationNumber:
                  dto.intakeLactation.estimatedLactationNumber ?? null,
                estimatedDaysInMilk:
                  dto.intakeLactation.estimatedDaysInMilk ?? null,
              },
            });
          } else if (dto.lactationStartDate) {
            // RAKHAL-291: purchase-intake Lactation, same shape/`startReason`
            // as `updateStatus()`'s own branch — a brand-new cattle row has
            // no prior Lactation, so this is always lactationNumber 1.
            await tx.lactation.create({
              data: {
                cattleId: cattle.id,
                lactationNumber: 1,
                startDate: new Date(dto.lactationStartDate),
                status: LactationStatus.ACTIVE,
                startReason: LactationStartReason.PURCHASED_LACTATING,
              },
            });
          }
        }

        // RD-048: "she is already dry" at intake — a real open DryPeriod (mirrors the MILKING
        // branch above), required by the guard before this transaction started.
        if (dto.productionStatus === ProductionStatus.DRY) {
          await tx.dryPeriod.create({
            data: {
              cattleId: cattle.id,
              startDate: new Date(dto.dryOffStartDate!),
            },
          });
        }

        // RAKHAL-307: "she has a current health condition" — an open
        // HealthCase written directly (not via `HealthService.createHealthCase`,
        // whose AQR sickness penalty / task / notification side effects don't
        // fit a fresh intake declaration) so the derived health chip is
        // correct from the create response onward.
        if (dto.intakeHealthCondition) {
          const caseCode = await this.nextHealthCaseCode(tx, farmId);
          await tx.healthCase.create({
            data: {
              farmId,
              cattleId: cattle.id,
              caseCode,
              note: dto.intakeHealthCondition.note,
              condition: dto.intakeHealthCondition.condition,
              careType: dto.intakeHealthCondition.careType,
              priority: dto.intakeHealthCondition.priority,
              startDate: new Date(),
              symptoms: [],
              notes: dto.intakeHealthCondition.notes,
            },
          });
        }

        // RAKHAL-483: each history item goes through the event write API as
        // HISTORICAL, inside this transaction (the store makes the handlers join it).
        if (historyItems.some((h) => historyEvent(h)) && this.eventWriter) {
          for (const h of historyItems) {
            const ev = historyEvent(h);
            if (!ev) continue;
            await txStore.run({ tx }, () =>
              this.eventWriter!.record(farmId, userId, cattle.id, {
                type: ev.type,
                eventAt: ev.eventAt,
                provenance: 'HISTORICAL',
                payload: ev.payload,
              }),
            );
          }
        }

        return cattle.id;
      });

      // RAKHAL-319: "bred but pregnancy unknown" / "currently in heat" at
      // intake — routed through the real ReproductionService methods (not
      // duplicated here) so they pick up 313's derive-only status, 314's
      // active-pregnancy guard, and a real pregnancy-check task/HeatEvent,
      // same as if recorded any other way. Runs after the cattle row commits
      // (both need a real cattleId FK) — each method does its own recompute
      // internally, so this can't race the final refreshDerivedState below.
      // (`intakeBreeding` is now a history item, recorded in the transaction above.)
      if (dto.intakeHeat) {
        await this.reproductionService.createHeatEvent(farmId, {
          cattleId: created,
          heatDateTime: dto.intakeHeat.heatDateTime,
          detectionMethod: HeatDetectionMethod.MANUAL,
          notes: dto.intakeHeat.notes,
        });
      }

      // RAKHAL-307: end intake with the same recompute every other
      // reproduction/lactation write uses, so the create response's derived
      // fields (animalCategory, healthStatus, lactationStage, pregnancyStage,
      // reproductionAlerts) are already correct — not just on the next GET.
      await this.derivation.refreshDerivedState(farmId, created);

      const cattle = await this.prisma.cattle.findUniqueOrThrow({
        where: { id: created },
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
          actionDetails: `New cattle [${cattle.name ?? cattle.tagNumber}] registered.`,
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
    // RAKHAL-401: only fetched when the filter is actually used, so this list
    // route's query cost is unchanged for every request that doesn't pass
    // `lifecycleSubStage` — reused below for composeStatus's `reproCtx` too
    // (never fetched twice for one request).
    const presetSettings =
      query.lifecycleSubStage || query.animalCategory
        ? await this.farmSettings.getEffective(farmId)
        : undefined;

    // RAKHAL-400: `includeDeleted` and `status` are independent controls —
    // the old `includeArchived` conflated them (true meant "drop every scope
    // filter", which also silently dropped the default ACTIVE-only view and
    // let a soft-deleted row leak into a status-filtered read).
    const where: Prisma.CattleWhereInput = {
      ...(query.includeDeleted ? anyRecord(farmId) : notDeleted(farmId)),
      herdStatus: query.status ?? HerdStatus.ACTIVE,
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
      ...(query.productionStatus
        ? { productionStatus: query.productionStatus }
        : {}),
      ...(query.shedId ? { shedId: query.shedId } : {}),
      ...(query.animalGroupId
        ? {
            animalGroupMemberships: {
              some: { groupId: query.animalGroupId },
            },
          }
        : {}),
      ...(query.reproductiveStatus
        ? {
            reproductionProfile: {
              is: { reproductiveStatus: query.reproductiveStatus },
            },
          }
        : {}),
      ...(query.healthStatus ? this.healthStatusWhere(query.healthStatus) : {}),
      ...(query.animalCategory
        ? buildAnimalCategoryWhere(
            query.animalCategory,
            new Date(),
            presetSettings?.cattleLifecycleWeaningDays,
          )
        : {}),
      ...(query.lifecycleSubStage
        ? buildLifecycleSubStageWhere(
            query.lifecycleSubStage,
            new Date(),
            this.lifecycleBoundaries(presetSettings!),
          )
        : {}),
    };

    // RAKHAL-475: wrapped in `AND` rather than spread into `where`, which already uses `OR` (search) and may be
    // extended by the category/sub-stage helpers — a spread would silently overwrite one of them.
    const dueWhere = query.dueFilter
      ? await this.upcomingEventsService.dueFilterWhere(farmId, query.dueFilter)
      : null;

    // RAKHAL-480: `?category=` (13 chips) from the shared eligibility table.
    const categoryWhere =
      query.category && this.eligibility
        ? await this.eligibility.categoryWhere(farmId, query.category)
        : null;
    const extraWhere = [dueWhere, categoryWhere].filter(
      (w): w is Prisma.CattleWhereInput => w !== null,
    );

    const rows = await this.prisma.cattle.findMany({
      where: extraWhere.length ? { AND: [where, ...extraWhere] } : where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.defaultInclude(),
    });

    // RAKHAL-279: one settings row + one bulk hold query for the whole page,
    // reused across every row's composeStatus() call (never per-row).
    // RAKHAL-401: reuses `presetSettings` when already fetched above for the
    // `lifecycleSubStage` filter, instead of querying `FarmModuleSettings` twice.
    const reproCtx = await this.buildReproductionContext(
      farmId,
      rows.map((row) => row.id),
      presetSettings,
    );

    // RAKHAL-475: the most urgent upcoming event per animal — one bulk read per source for the whole page.
    const upcoming = await this.upcomingEventsService.forCattle(
      farmId,
      rows.map((row) => row.id),
      { limit: 1 },
    );

    const page = toCursorPage(
      rows.map((row) => {
        const events = upcoming.get(row.id);
        return {
          ...this.composeStatus(row, reproCtx),
          next_event: events?.events[0] ?? null,
          upcoming_event_count: events?.total ?? 0,
        };
      }),
      query,
    );
    // List view carries only the thumbnail (RAKHAL-009) — cheap payload.
    const items = await this.attachListPhotos(farmId, page.items);
    return { ...page, items };
  }

  /** RAKHAL-475: one animal's full upcoming-events list (the column's popover and the detail strip). */
  async findUpcomingEvents(
    farmId: string,
    id: string,
    query: UpcomingEventsQueryDto,
  ) {
    await this.getCattleOrThrow(farmId, id);
    const result = await this.upcomingEventsService.forCattle(farmId, [id], {
      windowDays: query.windowDays,
      limit: query.limit,
    });
    return result.get(id) ?? { events: [], total: 0 };
  }

  async findOne(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(
      farmId,
      id,
      this.defaultInclude(),
    );
    const reproCtx = await this.buildReproductionContext(farmId, [id]);

    // RD-045: a single detail view can afford the real count instead of the list path's
    // bounded `take: 20` approximation (`defaultInclude()`'s `breedingEvents` cap).
    let breedingsSinceLastSuccess: number | undefined;
    if (cattle.gender === CattleGender.FEMALE) {
      // `getCattleOrThrow`'s generic `include` param doesn't propagate into its return type
      // (Prisma client typing limitation), so `cattle` is statically typed without relations
      // here even though `defaultInclude()` fetched `reproductionProfile` at runtime.
      const lastCalvingDate =
        (
          cattle as unknown as {
            reproductionProfile?: { lastCalvingDate: Date | null };
          }
        ).reproductionProfile?.lastCalvingDate ?? null;
      breedingsSinceLastSuccess = await this.prisma.breedingEvent.count({
        where: {
          cattleId: id,
          ...(lastCalvingDate ? { breedingDate: { gt: lastCalvingDate } } : {}),
        },
      });
    }

    return this.attachDetailPhoto(
      this.composeStatus(cattle, reproCtx, breedingsSinceLastSuccess),
    );
  }

  async update(
    farmId: string,
    id: string,
    dto: UpdateCattleDto,
    userId: string,
  ) {
    await this.getCattleOrThrow(farmId, id);
    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, id, dto);

    // RAKHAL-307: an edit, not an intake — 400 when an ACTIVE lactation
    // already exists rather than silently creating a second one or clobbering
    // the existing `startDate`. Correcting an in-progress lactation's start
    // date is out of this field's scope (no such write path exists yet).
    let activeLactation: { id: string } | null = null;
    if (
      dto.lactationStartDate !== undefined ||
      dto.productionStatus === ProductionStatus.MILKING
    ) {
      activeLactation = await this.prisma.lactation.findFirst({
        where: { cattleId: id, status: LactationStatus.ACTIVE },
        select: { id: true },
      });
    }
    if (dto.lactationStartDate !== undefined && activeLactation) {
      throw new BadRequestException(
        'This cow already has an active lactation. lactationStartDate on PATCH /cattle/:id only starts a new one — record a calving event, or edit the existing lactation directly, instead.',
      );
    }
    // RD-048: same "must be backed by a fact" rule `create()`/`updateStatus()` already enforce —
    // a general edit is the one write path that used to skip it entirely.
    if (
      dto.productionStatus === ProductionStatus.MILKING &&
      !activeLactation &&
      !dto.lactationStartDate
    ) {
      throw new BadRequestException(
        'No active lactation on record. Provide lactationStartDate to record this cow as milking (e.g. for a purchased cow with no calving history in this system).',
      );
    }

    let openDryPeriod: { id: string } | null = null;
    if (dto.productionStatus === ProductionStatus.DRY) {
      openDryPeriod = await this.prisma.dryPeriod.findFirst({
        where: { cattleId: id, actualEndDate: null },
        select: { id: true },
      });
      if (!openDryPeriod && !dto.dryOffStartDate) {
        throw new BadRequestException(
          'dryOffStartDate is required to record this cow as dry (no open dry period on record). Provide dryOffStartDate, or record a real dry-off event instead.',
        );
      }
    }

    try {
      const cattle = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.cattle.update({
          where: { id },
          data: {
            name: dto.name,
            tagNumber: dto.tagNumber,
            image: dto.image,
            breedId: dto.breedId,
            gender: dto.gender,
            dateOfBirth: dto.dateOfBirth
              ? new Date(dto.dateOfBirth)
              : undefined,
            herdStatus: dto.status,
            // RD-048: no longer written raw here — see the DryPeriod branch below and
            // `needsRecompute` — the stored value is always derived from a real fact.
            shedId: dto.shedId,
            lastWeightKg: dto.weightKg,
            lastBcs: dto.bcs,
            motherId: dto.motherId,
            fatherId: dto.fatherId,
            sourceType: dto.sourceType,
            color: dto.color,
            notes: dto.notes,
            // RAKHAL-307: mirrors create()'s own BCS write — keeps the
            // denormalized `lastBcs` (set above) and the BCS history in sync.
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
          },
        });

        // RAKHAL-291 profile-edit counterpart: `priorCalvings` here backfills/
        // corrects real prior-calving history on the profile-edit form (as
        // opposed to `updateStatus()`'s purchase-intake MILKING flow), so the
        // read-derived `animalCategory` (HEIFER→COW, see `animal-category.ts`)
        // reflects it immediately rather than needing a calving event.
        if (dto.priorCalvings !== undefined) {
          await tx.reproductionProfile.upsert({
            where: { cattleId: id },
            update: { totalCalvings: dto.priorCalvings },
            create: { cattleId: id, totalCalvings: dto.priorCalvings },
          });
        }

        // RAKHAL-307: backfill/correction path — the pre-check above already
        // 400'd if an ACTIVE lactation exists, so reaching here means it's
        // safe to start one (same shape as `updateStatus()`'s own
        // purchase-intake branch).
        if (dto.lactationStartDate) {
          const lactationCount = await tx.lactation.count({
            where: { cattleId: id },
          });
          await tx.lactation.create({
            data: {
              cattleId: id,
              lactationNumber: lactationCount + 1,
              startDate: new Date(dto.lactationStartDate),
              status: LactationStatus.ACTIVE,
              startReason: LactationStartReason.PURCHASED_LACTATING,
            },
          });
        }

        // RD-048: same shape as the lactation branch above — only fires when the pre-check found
        // no open DryPeriod already (otherwise it's already backed, nothing to create).
        if (
          dto.productionStatus === ProductionStatus.DRY &&
          !openDryPeriod &&
          dto.dryOffStartDate
        ) {
          await tx.dryPeriod.create({
            data: { cattleId: id, startDate: new Date(dto.dryOffStartDate) },
          });
        }

        return tx.cattle.findUniqueOrThrow({
          where: { id: updated.id },
          include: this.defaultInclude(),
        });
      });

      // RAKHAL-307: an edit here can flip derived reproduction/production
      // state (e.g. a heifer→cow priorCalvings correction, or a new
      // lactation starting) — same recompute create() now ends with.
      const needsRecompute =
        dto.priorCalvings !== undefined ||
        Boolean(dto.lactationStartDate) ||
        dto.productionStatus !== undefined;
      if (needsRecompute) {
        await this.derivation.refreshDerivedState(farmId, id);
      }
      const fresh = needsRecompute
        ? await this.prisma.cattle.findUniqueOrThrow({
            where: { id },
            include: this.defaultInclude(),
          })
        : cattle;

      this.log.info('Cattle updated', { cattleId: id, farmId });
      return this.composeStatus(fresh);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string, userId: string) {
    return this.archiveWithReason(farmId, id, {}, userId);
  }

  /** Maps `ArchiveCattleDto.reason` to a `CattleDispositionType` (RAKHAL-399
   * consolidation) — `archiveWithReason` no longer flips `herdStatus` itself
   * for a real herd exit, it just translates the legacy reason string and
   * delegates to `recordDisposition`, the single writer of a non-ACTIVE
   * `herdStatus`. */
  private static readonly ARCHIVE_REASON_TO_DISPOSITION: Partial<
    Record<string, CattleDispositionType>
  > = {
    sold: CattleDispositionType.SALE,
    deceased: CattleDispositionType.DEATH,
    culled: CattleDispositionType.CULL,
  };

  /**
   * Soft-archive (PRD §8.5, RAKHAL-036) — or, for `sold`/`deceased`/`culled`,
   * a real herd exit delegated entirely to {@link recordDisposition}
   * (RAKHAL-399: this method used to flip `herdStatus` inline; now
   * `recordDisposition` is the only writer of a non-ACTIVE `herdStatus`, so
   * every exit — this legacy reason-string entry point, the bulk `mark_sold`
   * action, and Healthcare's mortality flow — always produces a
   * `CattleDisposition` row and gets the same task-cancel/hold-release
   * cleanup). A plain `archived` reason (or no reason) stays record-level
   * soft delete — `deletedAt` only, `herdStatus` untouched.
   */
  async archiveWithReason(
    farmId: string,
    id: string,
    dto: ArchiveCattleDto,
    userId: string,
  ) {
    await this.getCattleOrThrow(farmId, id);

    const dispositionType = dto.reason
      ? CattleService.ARCHIVE_REASON_TO_DISPOSITION[dto.reason]
      : undefined;
    if (dispositionType) {
      await this.recordDisposition(farmId, userId, id, {
        type: dispositionType,
        date: new Date(),
        reason: dto.notes ?? null,
      });
      return this.findOne(farmId, id);
    }

    // RAKHAL-400: real soft-delete is for duplicate/mistake records only — an
    // animal with any real history (milk logs, health cases, breeding events)
    // has a legitimate operational trail and must be dispositioned instead,
    // never deleted (deleting it would silently orphan that history from the
    // active-herd views' "not deleted" scope).
    const [milkLogCount, healthCaseCount, breedingEventCount] =
      await Promise.all([
        this.prisma.milkLogEntry.count({ where: { cattleId: id } }),
        this.prisma.healthCase.count({ where: { cattleId: id } }),
        this.prisma.breedingEvent.count({ where: { cattleId: id } }),
      ]);
    if (milkLogCount > 0 || healthCaseCount > 0 || breedingEventCount > 0) {
      throw new ConflictException(
        'This animal has real history (milk logs, health cases, or breeding events) and cannot be deleted — dispose it instead.',
      );
    }

    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId },
      include: this.defaultInclude(),
    });
    this.log.info('Cattle archived', { cattleId: id, farmId });
    return this.composeStatus(cattle);
  }

  /**
   * The single consolidated SOLD/DEATH/CULL/TRANSFER path (RAKHAL-344,
   * `FINANCE_V2_DESIGN.md` §1.1/§5.1) — replaces the three divergent paths
   * that used to each flip a cow's lifecycle their own way: Finance's inline
   * string-matched `cattle.update({status: SOLD})` (`finance.service.ts:
   * 164-182`, outside any transaction, never closes the lactation),
   * `archiveWithReason()`'s `sold`/`deceased`/`culled` reasons above
   * (`:739-788`), and the bulk `mark_sold` action (`:865-` `bulk()`).
   *
   * **This ticket does not delete or call into either of those two
   * `cattle.service.ts` paths** — per RAKHAL-344's acceptance criteria this
   * method is additive; RAKHAL-345 (`SellAnimal` use case) is what switches
   * the real sell-animal flow onto `recordDisposition` and only then does
   * `finance.service.ts:164-182` get deleted (RAKHAL-345's job, not this
   * one). `archiveWithReason`/`bulk('mark_sold')` keep working exactly as
   * before.
   *
   * A `CattleDisposition` row is a permanent audit fact — the animal record
   * itself is never deleted, only `status`/`isActive`/`soldAt`/
   * `dispositionId` change; every milk/health/reproduction/feeding record
   * this cow ever produced stays untouched (this method never reads or
   * writes any of those tables).
   *
   * Follows the same `tx ?? this.prisma.$transaction(...)` seam every other
   * Finance V2 / Sales service on this milestone uses (RAKHAL-335/337/339)
   * so a later use-case ticket (RAKHAL-345) can pass its own already-open
   * transaction client straight through and get one atomic unit covering
   * `Sale`+`CattleDisposition`+cattle-status-flip+its own ledger/receivable
   * side effects.
   */
  async recordDisposition(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: RecordCattleDispositionInput,
    tx?: Prisma.TransactionClient,
  ) {
    await this.getCattleOrThrow(farmId, cattleId);

    // Invariant (FINANCE_V2_DESIGN.md §6): "A sold animal cannot be sold
    // again." Checked outside the transaction — read-only, and failing fast
    // here avoids opening a transaction for a request that's going to be
    // rejected anyway. Scoped by `cattleId` alone (already farm-scoped via
    // `getCattleOrThrow` above, and `CattleDisposition.cattleId` only ever
    // points at one farm's animal).
    const existingSale = await this.prisma.cattleDisposition.findFirst({
      where: { cattleId, type: CattleDispositionType.SALE },
      select: { id: true },
    });
    if (existingSale) {
      throw new ConflictException(
        'This animal has already been sold and cannot be sold again.',
      );
    }

    const run = (client: Prisma.TransactionClient) =>
      this.recordDispositionWithClient(client, farmId, userId, cattleId, dto);
    const disposition = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    this.log.info('Cattle disposition recorded', {
      cattleId,
      farmId,
      type: dto.type,
      dispositionId: disposition.id,
    });

    // RAKHAL-399: cancel this animal's open Task Hub tasks + release any open
    // AnimalHolds once she's left the herd. Run after the transaction commits
    // (both services use their own injected PrismaService, not this method's
    // `tx`/`client`) — a failure here never rolls back the disposition itself,
    // it's herd-exit cleanup, not part of the disposition's own invariants.
    await this.cleanupOnDisposition(farmId, cattleId, userId, dto.type);

    return disposition;
  }

  /** Task Hub has no `TaskStatus.CANCELLED` by design (MILESTONE 17 dropped a
   * cancel substrate on purpose — see `TaskService.completeBySourceEvent`'s
   * own doc comment) — so "cancel" here means the same thing that method
   * already does: close the task as `COMPLETED` with a note explaining why,
   * not invent a new status. */
  async cleanupOnDisposition(
    farmId: string,
    cattleId: string,
    userId: string,
    type: CattleDispositionType,
  ): Promise<void> {
    const note = `Animal left the herd (${type}) — task closed automatically.`;
    await this.taskService.completeForCattle(farmId, cattleId, userId, note);
    await this.animalHoldService.releaseAllForCattle(farmId, cattleId, userId);
  }

  async recordDispositionWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    cattleId: string,
    dto: RecordCattleDispositionInput,
  ) {
    const disposition = await client.cattleDisposition.create({
      data: {
        farmId,
        cattleId,
        type: dto.type,
        saleId: dto.saleId ?? null,
        date: dto.date,
        price: dto.price ?? null,
        reason: dto.reason ?? null,
        createdById: userId,
      },
    });

    const status = DISPOSITION_CATTLE_STATUS[dto.type];
    const lactationEndReason = DISPOSITION_LACTATION_END_REASON[dto.type];

    if (lactationEndReason) {
      // Reuses the exact lactation-closing logic `archiveWithReason` uses at
      // `:762-773` above — one ACTIVE lactation, ended with the matching
      // `LactationEndReason`, inside this same transaction.
      await this.closeActiveLactation(client, cattleId, lactationEndReason);
    }

    await client.cattle.update({
      where: { id: cattleId },
      data: {
        herdStatus: status,
        productionStatus: null,
        dispositionId: disposition.id,
        ...(dto.type === CattleDispositionType.SALE
          ? { soldAt: dto.date }
          : {}),
      },
    });

    return disposition;
  }

  /**
   * Undoes a `SALE`-type disposition (RAKHAL-377, MILESTONE 22, `BUSINESS_IA_PRD.md`
   * §9.4) — the physical-reversal half of voiding a `Sale` whose line sold this
   * animal. Called by `VoidSaleUseCase` inside its own transaction, never
   * directly by a controller. Deletes the `CattleDisposition` row (the sale
   * "never happened" in business terms once voided — same judgment call
   * `recordDisposition`'s own "cannot be sold again" guard depends on: that
   * guard reads `cattleDisposition.findFirst({cattleId, type: SALE})`, so a
   * left-behind row would forever block re-selling this animal after the
   * void) and restores `herdStatus: ACTIVE` + clears `dispositionId`/`soldAt`.
   *
   * **Known limitation, out of this ticket's scope**: does not reopen a
   * `Lactation` that `recordDispositionWithClient` closed — restoring a
   * closed lactation's `endDate`/production history correctly is a separate
   * concern from undoing the sale itself; a farm cancelling a mistaken sale
   * keeps its lactation closed and can start a new one if the animal remains
   * in milk. Throws if no `SALE` disposition exists for this animal (nothing
   * to undo — the sale's own line/animal linkage is wrong, or it was already
   * undone).
   */
  async undoDisposition(
    farmId: string,
    cattleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const disposition = await client.cattleDisposition.findFirst({
      where: { farmId, cattleId, type: CattleDispositionType.SALE },
      select: { id: true },
    });
    if (!disposition) {
      throw new NotFoundException(
        'No sale disposition found for this animal to undo',
      );
    }

    await client.cattleDisposition.delete({ where: { id: disposition.id } });
    await client.cattle.update({
      where: { id: cattleId },
      data: {
        herdStatus: HerdStatus.ACTIVE,
        dispositionId: null,
        soldAt: null,
      },
    });
  }

  /**
   * Shared lactation-close step: ends the animal's ACTIVE `Lactation` (if
   * any) with the given `LactationEndReason`, inside the caller's already-
   * open transaction. Faithfully mirrors `archiveWithReason`'s own inline
   * `tx.lactation.updateMany(...)` block (`:762-773`) — kept as its own
   * private helper here rather than refactoring `archiveWithReason` to call
   * it, since this ticket's lane is disposition paths only and
   * `archiveWithReason`'s existing behavior must stay untouched (RAKHAL-345
   * decides whether to consolidate further, once it switches the real
   * sell-animal flow over).
   */
  private async closeActiveLactation(
    client: Prisma.TransactionClient,
    cattleId: string,
    endReason: LactationEndReason,
  ) {
    await client.lactation.updateMany({
      where: { cattleId, status: LactationStatus.ACTIVE },
      data: {
        status: LactationStatus.ENDED,
        endDate: new Date(),
        endReason,
      },
    });
  }

  async restore(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    // RAKHAL-397/400: restore only undoes a soft delete. `herdStatus` is
    // never touched — a DECEASED animal restores as DECEASED, not ACTIVE
    // (the old blind `status: ACTIVE` here could resurrect a dead animal).
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: { deletedAt: null },
      include: this.defaultInclude(),
    });
    this.log.info('Cattle restored', { cattleId: id, farmId });
    return this.composeStatus(cattle);
  }

  async remove(
    farmId: string,
    id: string,
    dto: ArchiveCattleDto = {},
    userId: string,
  ) {
    return this.archiveWithReason(farmId, id, dto, userId);
  }

  /**
   * Cattle highlights bar (PRD §8.2, RAKHAL-037): total active herd, average
   * herd AQR, breeding-ready count, and today's yield — each with a trend.
   */
  async highlights(farmId: string) {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const vwpDays = await this.farmSettings.reproVwpDays(farmId);
    const vwpCutoff = new Date(now);
    vwpCutoff.setDate(vwpCutoff.getDate() - vwpDays);

    const activeWhere: Prisma.CattleWhereInput = activeHerd(farmId);

    const [totalActive, prevActiveCattle, aqrAgg, breedingReady] =
      await Promise.all([
        this.prisma.cattle.count({ where: activeWhere }),
        this.prisma.cattle.findMany({
          where: { ...activeWhere, createdAt: { lte: monthAgo } },
          select: { id: true, aqrScore: true },
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
    // Same cohort `total_change_pct` already compares against (active now + existed 30d ago) —
    // fetched as rows rather than a bare count so RD-012(a) can reconstruct each cow's AQR as of
    // `monthAgo` from the same set, one extra query instead of two.
    const prevActive = prevActiveCattle.length;

    const aqrThenByCattle = await computeAqrScoreAsOf(
      this.prisma,
      farmId,
      prevActiveCattle,
      monthAgo,
    );
    const aqrThenScores = [...aqrThenByCattle.values()].filter(
      (s): s is number => s !== null,
    );
    const avgHerdAqrThen = aqrThenScores.length
      ? aqrThenScores.reduce((sum, s) => sum + s, 0) / aqrThenScores.length
      : null;

    const { todayL, yesterdayL } = await this.dailyYield(farmId, now);

    return {
      total_active: totalActive,
      total_change_pct: this.pctChange(totalActive, prevActive),
      avg_herd_aqr: this.round(aqrAgg._avg.aqrScore ?? 0),
      aqr_change_pct:
        avgHerdAqrThen !== null
          ? this.pctChange(aqrAgg._avg.aqrScore ?? 0, avgHerdAqrThen)
          : null,
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
  async bulk(farmId: string, dto: BulkCattleDto, userId: string) {
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
      case 'mark_sold': {
        // RAKHAL-399: consolidated onto `recordDispositionWithClient` — same
        // lifecycle-exit auto-close + `CattleDisposition` row every other
        // exit path now produces, applied to the whole selection in one
        // transaction so a bulk-sold cow can never keep a dangling ACTIVE
        // Lactation or skip the disposition audit trail.
        const activeScope = {
          ...scope,
          ...activeHerd(farmId),
        };
        const targets = await this.prisma.cattle.findMany({
          where: activeScope,
          select: { id: true },
        });
        const targetIds = targets.map((t) => t.id);
        if (targetIds.length === 0) {
          return this.bulkResult(action, 0, cattleIds.length);
        }

        await this.prisma.$transaction(async (tx) => {
          for (const cattleId of targetIds) {
            await this.recordDispositionWithClient(
              tx,
              farmId,
              userId,
              cattleId,
              {
                type: CattleDispositionType.SALE,
                date: new Date(),
              },
            );
          }
        });
        for (const cattleId of targetIds) {
          await this.cleanupOnDisposition(
            farmId,
            cattleId,
            userId,
            CattleDispositionType.SALE,
          );
        }
        return this.bulkResult(action, targetIds.length, cattleIds.length);
      }
      case 'dispose': {
        // Generalizes the `mark_sold` case above to all 3 user-facing exit
        // types (RAKHAL-399's `recordDispositionWithClient`, one transaction
        // covering the whole selection) — the bulk dock's "Dispose" button
        // now picks the type instead of always sending SALE.
        if (!payload?.type) {
          throw new BadRequestException('type is required for dispose');
        }
        const disposeType = payload.type as CattleDispositionType;
        const activeScope = {
          ...scope,
          ...activeHerd(farmId),
        };
        const targets = await this.prisma.cattle.findMany({
          where: activeScope,
          select: { id: true },
        });
        const targetIds = targets.map((t) => t.id);
        if (targetIds.length === 0) {
          return this.bulkResult(action, 0, cattleIds.length);
        }

        await this.prisma.$transaction(async (tx) => {
          for (const cattleId of targetIds) {
            await this.recordDispositionWithClient(
              tx,
              farmId,
              userId,
              cattleId,
              {
                type: disposeType,
                date: payload.date ? new Date(payload.date) : new Date(),
                reason: payload.reason,
              },
            );
          }
        });
        for (const cattleId of targetIds) {
          await this.cleanupOnDisposition(
            farmId,
            cattleId,
            userId,
            disposeType,
          );
        }
        return this.bulkResult(action, targetIds.length, cattleIds.length);
      }
      case 'export': {
        // No `deletedAt` filter here (RAKHAL-310): export operates on the
        // caller's explicit `cattleIds` selection, which may deliberately
        // include archived rows already shown in an "include archived" view —
        // it must export exactly what was selected, not a re-filtered subset.
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

    // Pedigree lookup exception (RAKHAL-310): a child stays a child in the
    // pedigree count even after being archived/sold.
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
        ...activeHerd(farmId),
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
    const vwpDays = await this.farmSettings.reproVwpDays(farmId);

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
        ? new Date(activeLactation.startDate.getTime() + vwpDays * 86400_000)
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
          deletedAt: null,
          status: { in: OPEN_HEALTH_CASE_STATUSES },
        },
        orderBy: { startDate: 'desc' },
        include: {
          treatmentLogs: {
            where: { voidedAt: null },
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
          deletedAt: null,
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
        diagnosis: c.note,
        priority: c.priority,
        status: c.status,
        opened_at: c.startDate.toISOString().slice(0, 10),
        withholding_active: c.isSafetyWithholdingActive,
        withholding_end_date:
          c.milkWithdrawalUntil?.toISOString().slice(0, 10) ?? null,
      })),
      treatment_history: closedCases.map((c) => ({
        id: c.id,
        diagnosis: c.note,
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

  // RAKHAL-352: `tabFinance()` deleted — it was dead code (no controller
  // route ever called it; `GET /cattle/:id/finance` calls
  // `CattleDetailService.cattleFinance()`), and its `expense_breakdown`
  // branch was one of three disagreeing per-animal finance bucketers found
  // by `FINANCE_V2_DESIGN.md` §1.4 (exact-matched `subType === 'feed' |
  // 'health' | 'breeding'`, which never matched real data — see
  // `cattle-finance-aggregation.ts`'s doc comment for the full detail and
  // the single shared replacement now used by `CattleDetailService` and
  // `LactationEconomicsService`).

  async siblings(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(farmId, id);
    if (!cattle.motherId && !cattle.fatherId) {
      return [];
    }

    return this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        id: { not: id },
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
        careType: string;
      }[];
      /** RD-012(c): active (`status: 'ACTIVE'`) rows only, already scoped by `defaultInclude()`'s
       * `safetyWithdrawals` include (`take: 1`) — not re-filtered here. */
      safetyWithdrawals?: {
        milkWithdrawalUntil: Date | null;
        meatWithdrawalUntil: Date | null;
      }[];
      lactations?: { startDate: Date }[];
      heatEvents?: { heatDateTime: Date }[];
      breedingEvents?: {
        status: BreedingStatus;
        breedingDate: Date;
        expectedPregnancyCheckDate: Date | null;
      }[];
      pregnancies?: {
        conceptionDate: Date | null;
        expectedCalvingDate: Date | null;
      }[];
      dryPeriods?: { id: string }[];
    },
  >(
    row: T,
    reproCtx?: ReproductionContext,
    breedingsSinceLastSuccessOverride?: number,
  ) {
    const now = new Date();
    const healthStatus = deriveHealthStatus(row.healthCases ?? []);

    // RD-012(c): quarantine (post-treatment milk/meat hold) is deliberately kept OUT of
    // `deriveHealthStatus()`/`healthStatus` — ADR-020 already fought and won this exact battle for
    // `WITHHOLDING` (dropped to avoid duplicating `MilkService.getMilkEligibility()`'s ownership of
    // the same `SafetyWithdrawal` facts). A sibling field avoids re-opening that drift risk and
    // avoids inventing a precedence rule for "sick AND quarantined at once — which badge wins?".
    // `row.safetyWithdrawals` is already fetched (`defaultInclude()`, `status: 'ACTIVE'`, `take: 1`)
    // — this only reads it, no new query.
    const activeWithdrawal = (row.safetyWithdrawals ?? [])[0];
    const isQuarantined = !!activeWithdrawal;
    const quarantineUntil = activeWithdrawal
      ? this.laterDate(
          activeWithdrawal.milkWithdrawalUntil,
          activeWithdrawal.meatWithdrawalUntil,
        )
      : null;

    const activeLactation = (row.lactations ?? [])[0];
    const dim = activeLactation
      ? this.daysBetween(activeLactation.startDate, now)
      : null;

    const animalCategory = deriveAnimalCategory({
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
      now,
      weaningDays: reproCtx?.settings.cattleLifecycleWeaningDays,
    });

    const lifecycleSubStage = deriveLifecycleSubStage({
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
      now,
      boundaries: reproCtx
        ? this.lifecycleBoundaries(reproCtx.settings)
        : undefined,
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

      // RD-045: the list path (`getGrid()`/`findMany` mappers) leaves this bounded by
      // `defaultInclude()`'s `breedingEvents.take: 20` (Prisma can't express a per-row dynamic
      // date filter declaratively, and a per-row uncapped `count()` in a list is not affordable).
      // `findOne()` (single-record `GET /cattle/:id`) passes a real uncapped `count()` instead —
      // cheap for one row — via `breedingsSinceLastSuccessOverride`.
      const breedingsSinceLastSuccess =
        breedingsSinceLastSuccessOverride ??
        (row.breedingEvents ?? []).filter(
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
      isQuarantined,
      quarantineUntil,
      dim,
      animalCategory,
      lifecycleSubStage,
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
  /** `FarmModuleSettings` → `LifecycleBoundaries` (RAKHAL-401) — the same
   * columns `FarmSettingsService.lifecycleBoundaries` reads, but taken from an
   * already-fetched `settings` row (avoids a second query when `reproCtx` is
   * already in hand from `buildReproductionContext`). */
  private lifecycleBoundaries(settings: FarmModuleSettings) {
    return {
      weaningDays: settings.cattleLifecycleWeaningDays,
      growingStartDays: settings.cattleLifecycleGrowingStartDays,
      breedingAgeDays: settings.cattleLifecycleBreedingAgeDays,
    };
  }

  private async buildReproductionContext(
    farmId: string,
    cattleIds: string[],
    presetSettings?: FarmModuleSettings,
  ): Promise<ReproductionContext> {
    if (cattleIds.length === 0) {
      const settings =
        presetSettings ?? (await this.farmSettings.getEffective(farmId));
      return { settings, reproductiveHoldCattleIds: new Set() };
    }

    const [settings, holds] = await Promise.all([
      presetSettings
        ? Promise.resolve(presetSettings)
        : this.farmSettings.getEffective(farmId),
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
   *
   * `QUARANTINE` (RD-012(c)) is the same underlying fact under its eventual real name — a farmer's
   * "quarantine" means exactly a post-treatment milk/meat hold, same active `SafetyWithdrawal` this
   * file's own `isQuarantined`/`quarantineUntil` response fields (`composeStatus()`) now surface.
   * Deliberately the identical `where` as `WITHHOLDING`, not a separate concept.
   */
  private healthStatusWhere(
    filter: HealthStatusFilter,
  ): Prisma.CattleWhereInput {
    switch (filter) {
      case 'WITHHOLDING':
      case 'QUARANTINE':
        return {
          safetyWithdrawals: { some: { status: 'ACTIVE' } },
        };
      case 'SICK':
      case 'IN_TREATMENT':
        // RAKHAL-415: a preventive plan-apply no longer creates a `HealthCase` at all, so bulk
        // preventive rounds need no filtering here. But `careType: 'CURATIVE'` (RAKHAL-418's
        // replacement for the old `diagnosisType: { notIn: PREVENTIVE_DIAGNOSIS_TYPES }`) is still
        // load-bearing: a case can still be reported directly with `careType: 'PREVENTIVE'` (Report
        // Sickness lets the reporter pick either), and that must not read the cow as SICK — same
        // reasoning `deriveHealthStatus()` already applies. The explicit `deletedAt: null` is
        // separately load-bearing: this migration's backfill soft-deletes *historical* preventive
        // cases rather than deleting them outright (reversibility), so without this check those old
        // rows would resurface a cow as SICK once nothing else excludes them.
        return {
          healthCases: {
            some: {
              deletedAt: null,
              careType: 'CURATIVE',
              status: { in: OPEN_HEALTH_CASE_STATUSES },
            },
          },
        };
      case 'HEALTHY':
        return {
          healthCases: {
            none: {
              deletedAt: null,
              careType: 'CURATIVE',
              status: { in: OPEN_HEALTH_CASE_STATUSES },
            },
          },
          safetyWithdrawals: { none: { status: 'ACTIVE' } },
        };
      default:
        return { id: '__none__' };
    }
  }

  /**
   * Today's and yesterday's total yield (litres) for the farm. Submitted entries only — same definition as
   * `MilkService.overview` / the Dashboard KPI, so the Animal page never disagrees with them (UX audit 2026-10-20).
   */
  private async dailyYield(farmId: string, now: Date) {
    // Farm-local "today", same as `MilkService.overview` — the UTC day is a day behind a UTC+6 farm until 6 AM.
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { timezone: true },
    });
    const todayStart = localDayStart(
      farm?.timezone ?? DEFAULT_FARM_TIMEZONE,
      now,
    );
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

    const [today, yesterday] = await Promise.all([
      this.prisma.milkLogEntry.aggregate({
        where: {
          farmId,
          submitted: true,
          logDate: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { yieldL: true },
      }),
      this.prisma.milkLogEntry.aggregate({
        where: {
          farmId,
          submitted: true,
          logDate: { gte: yesterdayStart, lt: todayStart },
        },
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
      where: { id: shedId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!shed) {
      throw new BadRequestException('Shed must belong to the same farm');
    }
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
        where: { id: dto.breedId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!breed) {
        throw new BadRequestException('Breed must belong to the same farm');
      }
    }

    if (dto.shedId) {
      await this.assertShedInFarm(farmId, dto.shedId);
    }

    if (dto.animalGroupId) {
      const group = await this.prisma.animalGroup.findFirst({
        where: { id: dto.animalGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) {
        throw new BadRequestException(
          'Animal group must belong to the same farm',
        );
      }
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

    // Pedigree lookup exception (RAKHAL-310): a mother/father must still
    // resolve here even if archived/sold since the calving/parentage.
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
      // Pedigree cycle-check exception (RAKHAL-310): must walk the full
      // parentage graph, including archived/sold descendants, to correctly
      // reject a circular mother/father assignment.
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

    // Pedigree lookup exception (RAKHAL-310): ancestry must resolve archived/
    // sold ancestors too, or the tree would truncate at the first exited animal.
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
    // RAKHAL-310 named exception: deliberately no `deletedAt` filter — archive/
    // restore/detail-view flows all route through this helper and must be able
    // to load an already-archived animal (e.g. to restore it or view its detail
    // tabs post-archive).
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
          careType: true,
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
        where: { resolvedAt: null },
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

  /** RD-012(c): the later of two nullable withdrawal dates — when both a milk and a meat
   * withdrawal apply to the same active `SafetyWithdrawal`, quarantine only lifts once the
   * later one passes. `null` if neither is set. */
  private laterDate(a: Date | null, b: Date | null): Date | null {
    if (!a) return b;
    if (!b) return a;
    return a.getTime() >= b.getTime() ? a : b;
  }

  /** Mirrors `ReproductionService`'s own private `addDays` — plain literal
   * helper, not worth cross-module coupling for. */
  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * RAKHAL-307: next per-farm `HC-XXXXX` code, same collision-safe shape as
   * `HealthService`'s own private `nextCaseCode` (duplicated rather than
   * cross-module-injected — see `create()`'s intakeHealthCondition doc
   * comment for why `HealthService` itself isn't reused here). Runs inside
   * the caller's transaction so a concurrent farm-scoped create can't race it.
   */
  private async nextHealthCaseCode(
    tx: Prisma.TransactionClient,
    farmId: string,
  ): Promise<string> {
    // No `deletedAt` filter (RAKHAL-310) — code-sequence generation must scan
    // every case ever issued, archived or not, to never reuse a code.
    const rows = await tx.healthCase.findMany({
      where: { farmId, caseCode: { startsWith: 'HC-' } },
      select: { caseCode: true },
    });
    const n = rows.reduce((max, row) => {
      const match = /^HC-(\d+)$/.exec(row.caseCode);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `HC-${String(n + 1).padStart(5, '0')}`;
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
