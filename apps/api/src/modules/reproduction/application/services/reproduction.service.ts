import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  BreedingMethod,
  BreedingStatus,
  CalfBirthStatus,
  CattleGender,
  CattleSourceType,
  HerdStatus,
  DryPeriod,
  ExpenseCategory,
  ExpectedCalvingDateSource,
  HeatResolutionReason,
  LactationEndReason,
  LactationStartReason,
  LactationStatus,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  Prisma,
  ProductionStatus,
  ReproductionState,
  SemenSource,
  SemenType,
  TargetSex,
  TaskCategory,
  TaskPriority,
  TaskSource,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import {
  ActivityLogService,
  ActivityTaggedValue,
} from 'src/modules/activity/application/services/activity-log.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { SemenService } from 'src/modules/inventory/application/services/semen.service';
import { ExpenseService } from 'src/modules/purchasing/application/expense.service';
import { CalfService } from 'src/modules/calf/application/services/calf.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { AnimalHoldService } from 'src/modules/cattle/application/services/animal-hold.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import {
  deriveReproductionAlerts,
  ReproductionAlert,
} from '../../domain/reproduction-alerts';
import {
  deriveLactationStage,
  LactationStage,
} from '../../domain/lactation-stage';
import {
  derivePregnancyStage,
  PregnancyStage,
} from '../../domain/pregnancy-stage';
import { computeDryOffProjection } from '../../domain/lactation-dry-off-projection';
import { eventApiContext } from 'src/modules/animal-events/application/event-api-context';
import { estimatePregnancyDates } from '../../domain/pregnancy-estimate';
import {
  ReproductionDerivationService,
  deriveReproductionState,
  type ReproductionStateInput,
} from './reproduction-derivation.service';
import { CreateAbortionEventDto } from '../../presentation/dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../../presentation/dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../../presentation/dto/create-calving-event.dto';
import { CreateDryOffDto } from '../../presentation/dto/create-dry-off.dto';
import { CreateHeatEventDto } from '../../presentation/dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../../presentation/dto/create-pregnancy-diagnosis.dto';
import { ReproductionListQueryDto } from '../../presentation/dto/common.dto';
import { ListPregnanciesQueryDto } from '../../presentation/dto/list-pregnancies-query.dto';
import { ListReproductionCowsQueryDto } from '../../presentation/dto/list-reproduction-cows-query.dto';

type CattleForAccess = {
  id: string;
  farmId: string;
  gender: CattleGender;
  tagNumber: string;
};

/** Standard bovine gestation length, in days — same fallback used elsewhere
 * in this service (`createPregnancyDiagnosis`) when no explicit
 * `expectedCalvingDate` is recorded; reused by `derivePregnancyStage`'s
 * close-up-window projection (RAKHAL-273). */
const DEFAULT_GESTATION_DAYS = 280;

/** RAKHAL-315: how far out a pregnancy recheck task is due after a
 * SUSPECTED diagnosis. No dedicated farm setting yet — fixed like the
 * gestation-days fallback above; revisit if farms need it configurable. */
const PREGNANCY_RECHECK_DAYS = 10;

// RAKHAL-301: `deriveReproductionState`/`ReproductionStateInput` moved to
// `ReproductionDerivationService` — re-exported here so existing import
// paths (incl. this file's own unit test suite) don't churn.
export { deriveReproductionState };
export type { ReproductionStateInput };

/**
 * Reproduction service (PRD §9). Farm-scoped: `farmId` is supplied by the
 * controller from the verified token context (`FarmContextGuard`), so every
 * cattle lookup is scoped to it and no cross-tenant access is possible. Domain
 * events feed the live cross-cutting engines: pregnancy confirmation (+5) and
 * calving (+8) emit AQR/Activity events, newborn calves register (+50), and a
 * breeding spawns a pregnancy-check task while calving spawns a colostrum task.
 */
@Injectable()
export class ReproductionService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aqrService: AqrService,
    private readonly taskService: TaskService,
    private readonly semenService: SemenService,
    private readonly expenseService: ExpenseService,
    private readonly calfService: CalfService,
    private readonly farmSettings: FarmSettingsService,
    private readonly animalHoldService: AnimalHoldService,
    private readonly logger: LoggerService,
    private readonly derivation: ReproductionDerivationService,
    private readonly activityLog: ActivityLogService,
  ) {
    this.log = this.logger.setContext(ReproductionService.name);
  }

  /**
   * Immutable Activity Log entry (BREEDING module) for a reproduction event
   * that has no AQR event of its own — so no score change (`aqrImpact` unset).
   * Called only after the DB write commits; never throws into the caller's
   * flow beyond what `ActivityLogService.record` itself does.
   */
  private async logActivity(
    farmId: string,
    actorId: string | null | undefined,
    cattleId: string,
    eventTitle: string,
    actionDetails: string,
    taggedValues: ActivityTaggedValue[],
  ) {
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.BREEDING,
      eventTitle,
      actionDetails,
      actorId: actorId ?? null,
      relatedCattleId: cattleId,
      taggedValues,
    });
  }

  async createHeatEvent(
    farmId: string,
    dto: CreateHeatEventDto,
    idempotencyKey?: string,
    actorId?: string | null,
  ) {
    return this.withIdempotency(
      farmId,
      idempotencyKey,
      'reproduction.createHeatEvent',
      () => this.createHeatEventInner(farmId, dto, actorId),
    );
  }

  private async createHeatEventInner(
    farmId: string,
    dto: CreateHeatEventDto,
    actorId?: string | null,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);

    const heatEvent = await this.prisma.heatEvent.create({
      data: {
        cattleId: dto.cattleId,
        heatDateTime: new Date(dto.heatDateTime),
        detectionMethod: dto.detectionMethod,
        standingHeat: dto.standingHeat ?? false,
        mucusDischarge: dto.mucusDischarge ?? false,
        mountingBehavior: dto.mountingBehavior ?? false,
        restlessness: dto.restlessness ?? false,
        notes: dto.notes,
      },
    });

    // RAKHAL-318: a real heat observation is never silently dropped, even on
    // an actively-pregnant cow — the row is created regardless, but the
    // caller gets a conflict flag (and `deriveReproductionAlerts` surfaces
    // `HEAT_ON_ACTIVE_PREGNANCY` on every later read) instead of the
    // pregnancy being assumed over.
    const activePregnancy = await this.prisma.pregnancy.findFirst({
      where: { cattleId: dto.cattleId, status: PregnancyStatus.ACTIVE },
      select: { id: true },
    });

    await this.ensureProfile(dto.cattleId);
    await this.logActivity(
      farmId,
      actorId,
      dto.cattleId,
      'Heat detected',
      `Heat detected for [${cattle.tagNumber}] (${dto.detectionMethod}).`,
      [
        { key: 'cattle', value: cattle.tagNumber },
        { key: 'method', value: String(dto.detectionMethod) },
      ],
    );
    this.log.info('Heat event created', {
      heatEventId: heatEvent.id,
      cattleId: dto.cattleId,
      farmId: cattle.farmId,
      activePregnancyConflict: Boolean(activePregnancy),
    });

    if (activePregnancy) {
      return {
        ...heatEvent,
        activePregnancyConflict: true,
        pregnancyId: activePregnancy.id,
      };
    }

    return heatEvent;
  }

  async listHeatEvents(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'heatDateTime');
    const rows = await this.prisma.heatEvent.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async createBreedingEvent(
    farmId: string,
    userId: string,
    dto: CreateBreedingEventDto,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      farmId,
      idempotencyKey,
      'reproduction.createBreedingEvent',
      () => this.createBreedingEventInner(farmId, userId, dto),
    );
  }

  private async createBreedingEventInner(
    farmId: string,
    userId: string,
    dto: CreateBreedingEventDto,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);

    // RAKHAL-314: a breeding is meaningless on an already-pregnant cow — block
    // before any side effect. Correction path is editing/retiring the active
    // Pregnancy first (MILESTONE 17's edit substrate), then recording the new
    // breeding. Read here for the straw-decrement/breedingNumber fast-fail
    // (unlocked, best-effort); RAKHAL-324's authoritative re-check happens
    // inside the transaction below, after the row lock.
    const activePregnancy = await this.prisma.pregnancy.findFirst({
      where: { cattleId: dto.cattleId, status: PregnancyStatus.ACTIVE },
    });
    // RAKHAL-481 (Q4): through the event API this is a warning, not a block.
    if (activePregnancy && !eventApiContext()) {
      throw new BadRequestException(
        `[${cattle.tagNumber}] already has an active pregnancy (id ${activePregnancy.id}, expected calving ${activePregnancy.expectedCalvingDate?.toISOString().slice(0, 10) ?? 'unknown'}). Resolve or correct it before recording a new breeding.`,
      );
    }

    if (dto.bullId) {
      await this.assertCattleInFarm(farmId, dto.bullId);
    }

    // Explicit semen source (was implicitly inferred from semenBatchId
    // presence). Backward-compat: old clients that omit semenSource on an AI
    // event get it inferred server-side, matching pre-change behavior.
    const semenSource: SemenSource | undefined =
      dto.breedingMethod === BreedingMethod.AI
        ? (dto.semenSource ??
          (dto.semenBatchId
            ? SemenSource.FARM_INVENTORY
            : SemenSource.EXTERNAL))
        : undefined;

    if (
      semenSource &&
      semenSource !== SemenSource.FARM_INVENTORY &&
      dto.semenBatchId
    ) {
      throw new BadRequestException(
        'semenBatchId is only valid when semenSource is FARM_INVENTORY',
      );
    }
    if (
      semenSource === SemenSource.TECHNICIAN_SUPPLIED &&
      !dto.serviceProviderId
    ) {
      throw new BadRequestException(
        'serviceProviderId is required when semenSource is TECHNICIAN_SUPPLIED',
      );
    }
    const serviceProvider = dto.serviceProviderId
      ? await this.assertServiceProviderInFarm(farmId, dto.serviceProviderId)
      : null;

    // RAKHAL-330: AI with a manual (non-inventory) semen source has no
    // per-straw cost to fall back on — the cost has to come from the farmer.
    if (
      dto.breedingMethod === BreedingMethod.AI &&
      semenSource !== SemenSource.FARM_INVENTORY &&
      dto.serviceCost == null
    ) {
      throw new BadRequestException(
        'serviceCost is required for AI breeding when semen is not sourced from farm inventory',
      );
    }

    // Inventory decrement (REP-05): consume one straw for an AI service before
    // recording it, so a missing/empty batch (INV-02) aborts the breeding.
    // The batch is also the source of truth for semenType/targetSex — a
    // FARM_INVENTORY pick inherits both from the batch rather than any
    // manual dto value (which the frontend never sends for this source).
    let inventorySemenType: SemenType | undefined;
    let inventoryTargetSex: TargetSex | undefined;
    let inventoryCostPerUnit: number | undefined;
    let inventoryBatchName: string | undefined;
    if (
      dto.breedingMethod === BreedingMethod.AI &&
      semenSource === SemenSource.FARM_INVENTORY
    ) {
      if (!dto.semenBatchId) {
        throw new BadRequestException(
          'semenBatchId is required when semenSource is FARM_INVENTORY',
        );
      }
      // RAKHAL-330: check the batch has a cost *before* decrementing its straw
      // count — a missing-cost rejection must not leave a straw silently
      // consumed with no breeding event to show for it.
      const batchPreview = await this.prisma.semenBatch.findFirst({
        where: { id: dto.semenBatchId, farmId },
        select: { name: true, costPerUnit: true },
      });
      if (!batchPreview) {
        throw new BadRequestException(
          'semenBatchId does not refer to a batch on this farm',
        );
      }
      if (batchPreview.costPerUnit == null) {
        throw new BadRequestException(
          `Semen batch [${batchPreview.name}] has no cost per straw set — set its cost before recording an AI event against it.`,
        );
      }
      const batch = await this.semenService.decrementStraw(
        farmId,
        dto.semenBatchId,
        1,
        userId,
      );
      inventorySemenType = batch.semenType ?? undefined;
      inventoryTargetSex = batch.targetSex ?? undefined;
      inventoryCostPerUnit = batchPreview.costPerUnit;
      inventoryBatchName = batchPreview.name;
    }

    // RAKHAL-330: resolve the breeding's cost basis — AI always has one
    // (batch cost or manual serviceCost, both enforced above); NATURAL/
    // EMBRYO_TRANSFER stay optional. Whenever a real cost is being posted,
    // paymentMethod becomes mandatory (no silent default payment source).
    const resolvedCost =
      dto.breedingMethod === BreedingMethod.AI
        ? (semenSource === SemenSource.FARM_INVENTORY
            ? inventoryCostPerUnit
            : dto.serviceCost)!
        : (dto.serviceCost ?? 0);
    const costEntityName =
      semenSource === SemenSource.FARM_INVENTORY
        ? inventoryBatchName
        : (serviceProvider?.name ?? dto.semenCompany ?? 'Breeding service');
    const breedingNumber =
      dto.breedingNumber ??
      (await this.prisma.breedingEvent.count({
        where: { cattleId: dto.cattleId, voidedAt: null },
      })) + 1;

    const heatWindowDays = await this.farmSettings.reproHeatWindowDays(farmId);
    // RAKHAL-476: preg-check lead time is a farm setting (default 35).
    const pregnancyCheckDays =
      await this.farmSettings.reproPregnancyCheckDays(farmId);
    const breedingDate = new Date(dto.breedingDate);

    let breedingEvent = await this.prisma.$transaction(async (tx) => {
      // RAKHAL-324: lock the cow row, then re-validate the active-pregnancy
      // guard against live, transaction-consistent state — closes the race
      // where a concurrent `createPregnancyDiagnosis` PREGNANT confirmation
      // commits between the unlocked check above and this write.
      await this.lockCattleForUpdate(tx, dto.cattleId);
      const activePregnancyInTx = await tx.pregnancy.findFirst({
        where: { cattleId: dto.cattleId, status: PregnancyStatus.ACTIVE },
        select: { id: true },
      });
      if (activePregnancyInTx && !eventApiContext()) {
        throw new BadRequestException(
          `[${cattle.tagNumber}] already has an active pregnancy (id ${activePregnancyInTx.id}). Resolve or correct it before recording a new breeding.`,
        );
      }

      const created = await tx.breedingEvent.create({
        data: {
          cattleId: dto.cattleId,
          breedingDate,
          breedingMethod: dto.breedingMethod,
          bullId: dto.bullId,
          semenBatchId: dto.semenBatchId,
          inseminator: dto.inseminator,
          semenSource,
          serviceProviderId: dto.serviceProviderId,
          sireNameOrCode: dto.sireNameOrCode,
          sireBreed: dto.sireBreed,
          semenType:
            semenSource === SemenSource.FARM_INVENTORY
              ? inventorySemenType
              : dto.semenType,
          targetSex:
            semenSource === SemenSource.FARM_INVENTORY
              ? inventoryTargetSex
              : dto.targetSex,
          strawBatchCode: dto.strawBatchCode,
          semenCompany: dto.semenCompany,
          serviceCost: dto.serviceCost,
          paymentMethod: dto.paymentMethod,
          breedingNumber,
          expectedPregnancyCheckDate: dto.expectedPregnancyCheckDate
            ? new Date(dto.expectedPregnancyCheckDate)
            : this.addDays(breedingDate, pregnancyCheckDays),
          status: BreedingStatus.PENDING_CHECK,
          notes: dto.notes,
        },
        include: {
          bull: { select: { id: true, tagNumber: true, name: true } },
        },
      });

      // RAKHAL-298: an AI closes the open heat it responds to. Stamps the
      // most recent unresolved heat within the farm's window; silent no-op
      // when none exists (an AI can be recorded without a logged heat).
      const openHeat = await tx.heatEvent.findFirst({
        where: {
          cattleId: dto.cattleId,
          resolvedAt: null,
          heatDateTime: {
            gte: this.addDays(breedingDate, -heatWindowDays),
            // RAKHAL-320: compare against end-of-day, not the raw timestamp —
            // a date-only breedingDate parses to midnight, which would wrongly
            // exclude a heat recorded earlier the same calendar day.
            lte: this.endOfDay(breedingDate),
          },
        },
        orderBy: { heatDateTime: 'desc' },
      });
      if (openHeat) {
        await tx.heatEvent.update({
          where: { id: openHeat.id },
          data: {
            resolvedAt: breedingDate,
            resolvedByBreedingEventId: created.id,
            resolutionReason: HeatResolutionReason.INSEMINATED,
          },
        });
      }

      return created;
    });

    // Post the breeding's cost to Finance after the event commits.
    // When using straw from FARM_INVENTORY: the straw was already purchased and paid
    // when stocked into inventory. Using recordInventoryConsumption attributes the cost
    // to the animal (cattleId) without debiting the farm's cash/bank accounts a second time (prevents double costing).
    // When paying an external technician or service fee: recordExpense with financialAccountId.
    if (resolvedCost > 0) {
      let postedExpenseId: string | null = null;
      if (semenSource === SemenSource.FARM_INVENTORY) {
        const posted = await this.expenseService.recordInventoryConsumption(
          farmId,
          userId,
          {
            category: ExpenseCategory.BREEDING,
            description: `${costEntityName ?? 'Semen Straw'} — Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod})`,
            amount: resolvedCost,
            expenseDate: breedingDate.toISOString(),
            cattleId: dto.cattleId,
          },
        );
        postedExpenseId = posted.id;
      } else {
        const posted = await this.expenseService.recordExpense(farmId, userId, {
          category: ExpenseCategory.BREEDING,
          description: `${costEntityName ?? 'Breeding service'} — Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod})`,
          amount: resolvedCost,
          expenseDate: breedingDate.toISOString(),
          // One account per farm: the fee is paid from it, no wallet to pick.
          financialAccountId: await this.expenseService.resolveAccountId(
            farmId,
            userId,
            dto.financialAccountId,
          ),
          cattleId: dto.cattleId,
        });
        postedExpenseId = posted.id;
      }

      if (postedExpenseId) {
        breedingEvent = await this.prisma.breedingEvent.update({
          where: { id: breedingEvent.id },
          data: { financeTransactionId: postedExpenseId },
          include: {
            bull: { select: { id: true, tagNumber: true, name: true } },
          },
        });
      }
    }

    await this.derivation.refreshDerivedState(farmId, dto.cattleId);

    // Task Hub: schedule the pregnancy check for this service (PRD §9.3, §17.6).
    // RAKHAL-322: guarded against duplicates — see createBreedingTaskUnlessDuplicate.
    // RAKHAL-484: through the event API the BREEDING_TO_PREG_CHECK follow-up rule makes this task.
    if (!eventApiContext())
      await this.createBreedingTaskUnlessDuplicate(
        {
          farmId,
          createdBy: userId,
          name: `Pregnancy check — ${cattle.tagNumber}`,
          details: `Confirm pregnancy for breeding #${breedingEvent.breedingNumber} of [${cattle.tagNumber}].`,
          category: TaskCategory.BREEDING,
          priority: TaskPriority.MEDIUM,
          dueAt:
            breedingEvent.expectedPregnancyCheckDate ??
            this.addDays(new Date(dto.breedingDate), pregnancyCheckDays),
          source: TaskSource.SYSTEM_AUTO,
          relatedCattleId: dto.cattleId,
          sourceEventType: 'BREEDING_EVENT',
          sourceEventId: breedingEvent.id,
        },
        'Pregnancy check — ',
      );

    await this.logActivity(
      farmId,
      userId,
      dto.cattleId,
      'Breeding recorded',
      `Breeding #${breedingEvent.breedingNumber} (${dto.breedingMethod}) recorded for [${cattle.tagNumber}].`,
      [
        { key: 'cattle', value: cattle.tagNumber },
        { key: 'method', value: String(dto.breedingMethod) },
        { key: 'breeding', value: `#${breedingEvent.breedingNumber}` },
      ],
    );

    this.log.info('Breeding event created', {
      breedingEventId: breedingEvent.id,
      cattleId: dto.cattleId,
      farmId,
    });

    return breedingEvent;
  }

  async listBreedingEvents(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'breedingDate');
    const rows = await this.prisma.breedingEvent.findMany({
      where: { ...where, voidedAt: null },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { bull: { select: { id: true, tagNumber: true, name: true } } },
    });
    return toCursorPage(rows, query);
  }

  async getBreedingEvent(farmId: string, id: string) {
    const event = await this.prisma.breedingEvent.findFirst({
      where: { id, cattle: { farmId } },
      include: {
        cattle: { select: { id: true, farmId: true } },
        bull: { select: { id: true, tagNumber: true, name: true } },
        diagnoses: true,
        pregnancies: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Breeding event not found');
    }

    return event;
  }

  async createPregnancyDiagnosis(
    farmId: string,
    userId: string,
    dto: CreatePregnancyDiagnosisDto,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      farmId,
      idempotencyKey,
      'reproduction.createPregnancyDiagnosis',
      () => this.createPregnancyDiagnosisInner(farmId, userId, dto),
    );
  }

  private async createPregnancyDiagnosisInner(
    farmId: string,
    userId: string,
    dto: CreatePregnancyDiagnosisDto,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);

    // RAKHAL-(pregnancy-check-orphan): the "Record Pregnancy Check" quick
    // action lets a diagnosis be submitted without picking a breeding event
    // (a genuine standalone check is allowed) — but when the cow has exactly
    // one open PENDING_CHECK breeding, that's unambiguously the one this
    // diagnosis answers. Auto-link it so the breeding's pregnancy-check task
    // actually completes below, instead of sitting PENDING forever. Left
    // unresolved (dto.breedingEventId stays undefined) when zero or more
    // than one candidate exists — never guess between two open breedings.
    if (!dto.breedingEventId) {
      const openBreedings = await this.prisma.breedingEvent.findMany({
        where: { cattleId: dto.cattleId, status: BreedingStatus.PENDING_CHECK },
        select: { id: true, breedingDate: true },
        take: 2,
      });
      // RAKHAL-481 (D2): via the event API an old check must not attach itself
      // to an AI recorded after it.
      if (
        openBreedings.length === 1 &&
        (!eventApiContext() ||
          openBreedings[0].breedingDate <= new Date(dto.diagnosisDate))
      ) {
        dto.breedingEventId = openBreedings[0].id;
      }
    }

    const breedingEvent = dto.breedingEventId
      ? await this.getBreedingEventForCattle(dto.breedingEventId, dto.cattleId)
      : null;
    // RAKHAL-285: read once outside the transaction — only needed when the
    // PREGNANT branch below recomputes `Lactation.recommendedDryOffAt`.
    const dryPeriodDays =
      await this.farmSettings.reproDryPeriodTargetDays(farmId);

    const diagnosis = await this.prisma.$transaction(async (tx) => {
      // RAKHAL-324: same cow-row lock `createBreedingEvent`/`returnToHeat`
      // take — this PREGNANT branch is the other side of both of those races
      // (it's the write that flips Pregnancy/BreedingEvent state they guard
      // against).
      await this.lockCattleForUpdate(tx, dto.cattleId);

      const created = await tx.pregnancyDiagnosis.create({
        data: {
          cattleId: dto.cattleId,
          breedingEventId: dto.breedingEventId,
          diagnosisDate: new Date(dto.diagnosisDate),
          result: dto.result,
          diagnosisMethod: dto.diagnosisMethod,
          gestationDay: dto.gestationDay,
          expectedCalvingDate: dto.expectedCalvingDate
            ? new Date(dto.expectedCalvingDate)
            : undefined,
          notes: dto.notes,
        },
      });

      if (dto.result === PregnancyDiagnosisResult.PREGNANT) {
        // RAKHAL-476: with no linked breeding, derive conception from the
        // gestation day / expected calving — never the check date itself.
        const estimate = estimatePregnancyDates({
          diagnosisDate: new Date(dto.diagnosisDate),
          breedingDate: breedingEvent?.breedingDate,
          gestationDay: dto.gestationDay,
          expectedCalvingDate: dto.expectedCalvingDate
            ? new Date(dto.expectedCalvingDate)
            : null,
        });
        if (estimate.source !== 'BREEDING') {
          this.log.info('CONCEPTION_ESTIMATED', {
            cattleId: dto.cattleId,
            source: estimate.source,
          });
        }
        const conceptionDate = estimate.conceptionDate;
        // RAKHAL-317: the system's own estimate, kept forever regardless of
        // any later farmer override — never recomputed after this.
        const calculatedCalvingDate = estimate.calculatedCalvingDate;
        const pregnancy = await tx.pregnancy.create({
          data: {
            cattleId: dto.cattleId,
            breedingEventId: dto.breedingEventId,
            conceptionDate,
            conceptionConfidence: estimate.confidence,
            calculatedCalvingDate,
            expectedCalvingDate: dto.expectedCalvingDate
              ? new Date(dto.expectedCalvingDate)
              : calculatedCalvingDate,
            expectedCalvingDateSource: dto.expectedCalvingDate
              ? ExpectedCalvingDateSource.MANUAL
              : ExpectedCalvingDateSource.SYSTEM,
            gestationDays: dto.gestationDay,
            status: PregnancyStatus.ACTIVE,
            // RAKHAL-299/305: back-link so an edit to this diagnosis (e.g.
            // PREGNANT→NOT_PREGNANT) can find the Pregnancy it produced.
            sourceDiagnosisId: created.id,
          },
        });

        if (dto.breedingEventId) {
          await tx.breedingEvent.update({
            where: { id: dto.breedingEventId },
            data: { status: BreedingStatus.PREGNANT },
          });
        }

        await tx.reproductionProfile.upsert({
          where: { cattleId: dto.cattleId },
          create: {
            cattleId: dto.cattleId,
            reproductiveStatus: ReproductionState.PREGNANT,
            lastPregnancyCheckDate: new Date(dto.diagnosisDate),
            currentPregnancyId: pregnancy.id,
          },
          update: {
            reproductiveStatus: ReproductionState.PREGNANT,
            lastPregnancyCheckDate: new Date(dto.diagnosisDate),
            currentPregnancyId: pregnancy.id,
          },
        });

        // RAKHAL-285: recompute the dam's active Lactation's
        // `recommendedDryOffAt` — pregnancy-driven, primary projection.
        // `pregnancy.expectedCalvingDate` is always set (either the DTO's
        // value or the 280-day fallback above), so this always fires
        // whenever a PREGNANT diagnosis is recorded (new confirmation or
        // re-diagnosis). No-ops (updateMany matches 0 rows) if she has no
        // active Lactation right now — that's fine, it'll apply the moment
        // one exists.
        if (pregnancy.expectedCalvingDate) {
          const { recommendedDryOffAt } = computeDryOffProjection({
            isPregnant: true,
            expectedCalvingDate: pregnancy.expectedCalvingDate,
            dryPeriodDays,
          });
          await tx.lactation.updateMany({
            where: { cattleId: dto.cattleId, status: LactationStatus.ACTIVE },
            data: { recommendedDryOffAt },
          });
        }
      } else if (
        dto.breedingEventId &&
        dto.result === PregnancyDiagnosisResult.NOT_PREGNANT
      ) {
        await tx.breedingEvent.update({
          where: { id: dto.breedingEventId },
          data: { status: BreedingStatus.FAILED },
        });
      }

      return created;
    });

    await this.derivation.refreshDerivedState(farmId, dto.cattleId);

    // RAKHAL-315: any diagnosis result resolves the breeding's original
    // pregnancy-check task — before this, none of the three results ever
    // completed it, so it sat PENDING forever.
    if (dto.breedingEventId) {
      await this.taskService.completeBySourceEvent(
        farmId,
        'BREEDING_EVENT',
        dto.breedingEventId,
        userId,
      );

      // SUSPECTED: never fabricate a NOT_PREGNANT/PREGNANT outcome — hold the
      // cow BRED_AWAITING_CONFIRMATION and schedule a real recheck instead.
      if (dto.result === PregnancyDiagnosisResult.SUSPECTED) {
        const recheckDueDate = this.addDays(
          new Date(dto.diagnosisDate),
          PREGNANCY_RECHECK_DAYS,
        );
        // RAKHAL-322: guarded against duplicates — two rapid SUSPECTED
        // diagnoses on the same breeding must not open two recheck cards.
        await this.createBreedingTaskUnlessDuplicate(
          {
            farmId,
            createdBy: userId,
            name: `Pregnancy recheck — ${cattle.tagNumber}`,
            details: `Diagnosis on ${dto.diagnosisDate} was inconclusive; recheck breeding #${breedingEvent?.breedingNumber ?? '?'} of [${cattle.tagNumber}].`,
            category: TaskCategory.BREEDING,
            priority: TaskPriority.MEDIUM,
            dueAt: recheckDueDate,
            source: TaskSource.SYSTEM_AUTO,
            relatedCattleId: dto.cattleId,
            sourceEventType: 'BREEDING_EVENT',
            sourceEventId: dto.breedingEventId,
          },
          'Pregnancy recheck — ',
        );

        // RAKHAL-320: breeding stays PENDING_CHECK (still unresolved — see
        // reproduction-alerts.ts's PREGNANCY_CHECK_DUE derivation), but its
        // due date rolls to the recheck date. Otherwise the dashboard's
        // "Pregnancy Check Due" query (status=PENDING_CHECK AND
        // expectedPregnancyCheckDate<=today+3d) keeps matching the original,
        // already-actioned due date forever.
        await this.prisma.breedingEvent.update({
          where: { id: dto.breedingEventId },
          data: { expectedPregnancyCheckDate: recheckDueDate },
        });
      }
    }

    // AQR: Pregnancy Confirmed (+5) + immutable Activity Log entry (PRD §19.2).
    if (dto.result === PregnancyDiagnosisResult.PREGNANT) {
      await this.aqrService.applyEvent(
        farmId,
        dto.cattleId,
        'pregnancy_confirmed',
        {
          actorId: userId,
          actionDetails: `Pregnancy confirmed for [${cattle.tagNumber}].`,
        },
      );
    } else {
      // PREGNANT is already logged by the AQR event above; log the other
      // results (NOT_PREGNANT / SUSPECTED) here, with no score change.
      await this.logActivity(
        farmId,
        userId,
        dto.cattleId,
        'Pregnancy diagnosis',
        `Pregnancy diagnosis for [${cattle.tagNumber}]: ${dto.result}.`,
        [
          { key: 'cattle', value: cattle.tagNumber },
          { key: 'result', value: String(dto.result) },
        ],
      );
    }

    this.log.info('Pregnancy diagnosis created', {
      pregnancyDiagnosisId: diagnosis.id,
      cattleId: dto.cattleId,
      farmId,
      result: dto.result,
    });

    return diagnosis;
  }

  async listPregnancies(farmId: string, query: ListPregnanciesQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'conceptionDate');
    const rows = await this.prisma.pregnancy.findMany({
      where: { ...where, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      // "eligible for calving" pickers need the cow's tag/name without an
      // extra round-trip per row.
      include: {
        cattle: { select: { id: true, name: true, tagNumber: true } },
      },
    });
    return toCursorPage(rows, query);
  }

  async createCalvingEvent(
    farmId: string,
    userId: string,
    dto: CreateCalvingEventDto,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      farmId,
      idempotencyKey,
      'reproduction.createCalvingEvent',
      () => this.createCalvingEventInner(farmId, userId, dto),
    );
  }

  private async createCalvingEventInner(
    farmId: string,
    userId: string,
    dto: CreateCalvingEventDto,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);

    // Same gap/fix as createPregnancyDiagnosisInner's auto-resolve above: a
    // calving submitted without pregnancyId (e.g. a caller that forgets it,
    // or a UI path that hasn't been threaded through yet) otherwise never
    // closes the Pregnancy/BreedingEvent it belongs to. Auto-link when the
    // cow has exactly one ACTIVE pregnancy — never guess between two.
    if (!dto.pregnancyId) {
      const activePregnancies = await this.prisma.pregnancy.findMany({
        where: { cattleId: dto.cattleId, status: PregnancyStatus.ACTIVE },
        select: { id: true },
        take: 2,
      });
      if (activePregnancies.length === 1) {
        dto.pregnancyId = activePregnancies[0].id;
      }
    }

    const pregnancy = dto.pregnancyId
      ? await this.getPregnancyForCattle(dto.pregnancyId, dto.cattleId)
      : null;
    const calvingDate = new Date(dto.calvingDate);

    const calvingNumber =
      dto.calvingNumber ??
      (await this.prisma.calvingEvent.count({
        where: { cattleId: dto.cattleId },
      })) + 1;

    const txResult = await this.prisma.$transaction(async (tx) => {
      const created = await tx.calvingEvent.create({
        data: {
          cattleId: dto.cattleId,
          pregnancyId: dto.pregnancyId,
          calvingDate,
          calvingNumber,
          calvingEase: dto.calvingEase,
          calfCount: dto.calfCount ?? dto.calves?.length ?? 1,
          placentaExpelled: dto.placentaExpelled ?? false,
          retainedPlacenta: dto.retainedPlacenta ?? false,
          complications: dto.complications,
          notes: dto.notes,
        },
      });

      if (pregnancy) {
        await tx.pregnancy.update({
          where: { id: pregnancy.id },
          data: {
            status: PregnancyStatus.CALVED,
            actualCalvingDate: calvingDate,
            gestationDays: pregnancy.conceptionDate
              ? this.daysBetween(pregnancy.conceptionDate, calvingDate)
              : null,
          },
        });

        if (pregnancy.breedingEventId) {
          await tx.breedingEvent.update({
            where: { id: pregnancy.breedingEventId },
            data: { status: BreedingStatus.CALVED },
          });
        }
      }

      // RAKHAL-290: no two ACTIVE lactations for the same dam. A calving
      // recorded while the prior lactation is still ACTIVE means the farmer
      // missed (or skipped) the dry-off step for it — close it here rather
      // than leaving two ACTIVE rows or silently overwriting the old one.
      // `endDate` is the new calving date (the moment the old lactation
      // stopped being current), and the closure is returned on the response
      // (`closedMissingDryOff` below) so the caller/UI can flag it instead of
      // this being a silent correction.
      const missedDryOffLactation = await tx.lactation.findFirst({
        where: { cattleId: dto.cattleId, status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
      });
      if (missedDryOffLactation) {
        await tx.lactation.update({
          where: { id: missedDryOffLactation.id },
          data: {
            status: LactationStatus.ENDED,
            endDate: calvingDate,
            endReason: LactationEndReason.MISSING_DRY_OFF_RECORD,
          },
        });
      }

      // v2 correction (RAKHAL-269/271): lactation start now lives solely on
      // `Lactation` — `startReason`/`sourceCalvingEventId` replace the
      // rejected `Cattle.lactationStartDate` stamp this call used to make.
      const lactation = await tx.lactation.create({
        data: {
          cattleId: dto.cattleId,
          lactationNumber: calvingNumber,
          calvingEventId: created.id,
          startDate: calvingDate,
          status: LactationStatus.ACTIVE,
          startReason: LactationStartReason.CALVING,
          sourceCalvingEventId: created.id,
        },
      });

      for (const calf of dto.calves ?? []) {
        let calfId: string | undefined;
        if (calf.status === CalfBirthStatus.ALIVE) {
          if (!calf.tagNumber) {
            throw new BadRequestException(
              'Alive calves must include tagNumber for cattle registration',
            );
          }

          const createdCalf = await tx.cattle.create({
            data: {
              farmId: cattle.farmId,
              name: calf.name,
              tagNumber: calf.tagNumber,
              gender: calf.gender,
              dateOfBirth: calvingDate,
              herdStatus: HerdStatus.ACTIVE,
              motherId: dto.cattleId,
              fatherId: pregnancy?.breedingEvent?.bullId ?? undefined,
              sourceType: CattleSourceType.BORN,
              createdBy: userId,
            },
          });
          calfId = createdCalf.id;
        }

        await tx.calfBirth.create({
          data: {
            calvingEventId: created.id,
            calfId,
            gender: calf.gender,
            birthWeight: calf.birthWeight,
            status: calf.status,
          },
        });
      }

      // Atomicity fix: `totalCalvings` must be guaranteed consistent with the
      // `productionStatus: MILKING` flip below (the HEIFER/MILKING invariant
      // reads `totalCalvings`, not a separately-derived state) — counted
      // inside this same transaction (the just-created `CalvingEvent` row is
      // already visible to it) rather than left to the post-transaction
      // `refreshDerivedState()` call, which previously left a real window
      // where a reader could observe `productionStatus: MILKING` with a
      // stale `totalCalvings` if it raced between commit and that follow-up
      // call. reproductiveStatus itself is still left to
      // `refreshDerivedState()` below —
      // it derives PREGNANT/EXPECTED_TO_CALVE/OPEN/etc. from live event state
      // (RAKHAL-271), which this upsert doesn't need for that invariant.
      const totalCalvings = await tx.calvingEvent.count({
        where: { cattleId: dto.cattleId },
      });
      await tx.reproductionProfile.upsert({
        where: { cattleId: dto.cattleId },
        create: {
          cattleId: dto.cattleId,
          currentLactationNumber: calvingNumber,
          firstCalvingDate: calvingDate,
          lastCalvingDate: calvingDate,
          currentLactationId: lactation.id,
          currentPregnancyId: null,
          totalCalvings,
        },
        update: {
          currentLactationNumber: calvingNumber,
          firstCalvingDate: calvingNumber === 1 ? calvingDate : undefined,
          lastCalvingDate: calvingDate,
          currentLactationId: lactation.id,
          currentPregnancyId: null,
          totalCalvings,
        },
      });

      // Cattle.productionStatus was never auto-managed (manual-only field) —
      // calving is a real lifecycle transition, so flip the dam into MILKING.
      // `Cattle.lactationStartDate` is gone (v2 correction) — the `Lactation`
      // row created just above is now the sole source of truth for lactation
      // start. Extracted to `flipToMilking` (RAKHAL-281) so the new
      // purchased-lactating intake path (`createPurchasedLactation`) can reuse
      // the exact same guarded transition instead of duplicating it.
      await this.flipToMilking(tx, dto.cattleId);

      const createdCalvingEvent = await tx.calvingEvent.findUnique({
        where: { id: created.id },
        include: { calfBirths: { include: { calf: true } }, lactations: true },
      });

      return {
        calvingEvent: createdCalvingEvent,
        // RAKHAL-290: surfaced so the caller/UI can flag the missed dry-off
        // record rather than this being a silent correction — null when the
        // dam already had no ACTIVE lactation (the expected, normal case).
        closedMissingDryOffLactation: missedDryOffLactation
          ? await tx.lactation.findUniqueOrThrow({
              where: { id: missedDryOffLactation.id },
            })
          : null,
      };
    });

    const { calvingEvent, closedMissingDryOffLactation } = txResult;

    await this.derivation.refreshDerivedState(farmId, dto.cattleId);

    // AQR: register each live-born calf (+50) just like CattleService does, then
    // spin up the age-based calf-care schedule (PRD §14.5, RD-009).
    for (const birth of calvingEvent?.calfBirths ?? []) {
      if (birth.calfId) {
        await this.aqrService.applyEvent(
          farmId,
          birth.calfId,
          'animal_registered',
          {
            actorId: userId,
            actionDetails: `Calf [${birth.calf?.tagNumber ?? birth.calfId}] born to [${cattle.tagNumber}].`,
          },
        );

        await this.calfService.scheduleCareReminders({
          farmId,
          createdBy: userId,
          calfId: birth.calfId,
          birthDate: calvingDate,
          gender: birth.gender,
          sourceEventId: calvingEvent?.id,
        });
      }
    }

    // AQR: Calving Recorded (+8) on the dam + immutable Activity Log entry.
    await this.aqrService.applyEvent(
      farmId,
      dto.cattleId,
      'calving_successful',
      {
        actorId: userId,
        actionDetails: `Calving recorded for [${cattle.tagNumber}] (${
          calvingEvent?.calfBirths.length ?? 0
        } calf/calves).`,
      },
    );

    // Task Hub: colostrum feeding is time-critical in the first hours (PRD §14).
    await this.taskService.createInternal({
      farmId,
      createdBy: userId,
      name: `Colostrum feeding — calf of ${cattle.tagNumber}`,
      details:
        'Feed colostrum to the newborn calf within the first 6 hours of birth.',
      category: TaskCategory.CALF_CARE,
      priority: TaskPriority.HIGH,
      dueAt: this.addHours(calvingDate, 6),
      source: TaskSource.SYSTEM_AUTO,
      relatedCattleId: dto.cattleId,
      safetyCritical: true,
      sourceEventType: 'CALVING_EVENT',
      sourceEventId: calvingEvent?.id,
    });

    this.log.info('Calving event created', {
      calvingEventId: calvingEvent?.id,
      cattleId: dto.cattleId,
      farmId,
      closedMissingDryOffLactationId: closedMissingDryOffLactation?.id ?? null,
    });

    return { ...calvingEvent, closedMissingDryOffLactation };
  }

  /**
   * Record a dry-off (RD-038 — `DryPeriod` previously had no writer anywhere
   * in the codebase). Ends the cow's active `Lactation`, opens a `DryPeriod`
   * row (`expectedEndDate` projected from the farm's `reproDryPeriodTargetDays`
   * setting, RD-016), and flips `Cattle.productionStatus` to `DRY` — the same
   * lifecycle-transition pattern `createCalvingEvent` uses for `MILKING`.
   */
  async recordDryOff(
    farmId: string,
    cattleId: string,
    dto: CreateDryOffDto,
    actorId?: string | null,
  ): Promise<DryPeriod> {
    const cattle = await this.getFemaleCattle(farmId, cattleId);
    const dryOffDate = dto.dryOffDate ? new Date(dto.dryOffDate) : new Date();

    const activeLactation = await this.prisma.lactation.findFirst({
      where: { cattleId, status: LactationStatus.ACTIVE },
      orderBy: { startDate: 'desc' },
    });
    // RAKHAL-481: through the event API a missing lactation is a warning.
    if (!activeLactation && !eventApiContext()) {
      throw new BadRequestException(
        `[${cattle.tagNumber}] has no active lactation to dry off`,
      );
    }

    const alreadyDry = await this.prisma.dryPeriod.findFirst({
      where: { cattleId, actualEndDate: null },
    });
    if (alreadyDry) {
      throw new BadRequestException(
        `[${cattle.tagNumber}] already has an open dry period`,
      );
    }

    const targetDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);

    const dryPeriod = await this.prisma.$transaction(async (tx) => {
      // RAKHAL-481: with no active lactation (event API only) there is nothing to close.
      if (activeLactation) {
        await tx.lactation.update({
          where: { id: activeLactation.id },
          data: {
            status: LactationStatus.ENDED,
            endDate: dryOffDate,
            // RAKHAL-290: closes RAKHAL-281's own note that `recordDryOff`
            // didn't set this yet.
            endReason: LactationEndReason.DRY_OFF,
          },
        });
      }

      const created = await tx.dryPeriod.create({
        data: {
          cattleId,
          startDate: dryOffDate,
          expectedEndDate: this.addDays(dryOffDate, targetDays),
          notes: dto.notes,
          reason: dto.reason,
        },
      });

      // Lifecycle transition (mirrors createCalvingEvent's MILKING flip) — only
      // auto-set while the cow is still active (an archived cow shouldn't
      // revive; RAKHAL-269 trimmed ProductionStatus to MILKING|DRY only, so
      // isActive is the correct archival guard now, not a SOLD/DECEASED check).
      await tx.cattle.updateMany({
        where: { id: cattleId, ...activeHerd(farmId) },
        data: { productionStatus: ProductionStatus.DRY },
      });

      return created;
    });

    await this.derivation.refreshDerivedState(farmId, cattleId);

    await this.logActivity(
      farmId,
      actorId,
      cattleId,
      'Dry-off recorded',
      `[${cattle.tagNumber}] dried off on ${dryOffDate.toISOString().slice(0, 10)}.`,
      [
        { key: 'cattle', value: cattle.tagNumber },
        {
          key: 'dryOffDate',
          value: dryOffDate.toISOString().slice(0, 10),
        },
      ],
    );

    this.log.info('Dry-off recorded', {
      dryPeriodId: dryPeriod.id,
      cattleId,
      farmId,
      lactationId: activeLactation?.id ?? null,
    });

    return dryPeriod;
  }

  async listCalvingEvents(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'calvingDate');
    const rows = await this.prisma.calvingEvent.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { calfBirths: { include: { calf: true } }, lactations: true },
    });
    return toCursorPage(rows, query);
  }

  async createAbortionEvent(
    farmId: string,
    dto: CreateAbortionEventDto,
    actorId?: string | null,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
    const pregnancy = dto.pregnancyId
      ? await this.getPregnancyForCattle(dto.pregnancyId, dto.cattleId)
      : null;

    const abortion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.abortionEvent.create({
        data: {
          cattleId: dto.cattleId,
          pregnancyId: dto.pregnancyId,
          abortionDate: new Date(dto.abortionDate),
          gestationDay: dto.gestationDay,
          suspectedCause: dto.suspectedCause,
          notes: dto.notes,
        },
      });

      if (pregnancy) {
        await tx.pregnancy.update({
          where: { id: pregnancy.id },
          data: { status: PregnancyStatus.ABORTED },
        });

        if (pregnancy.breedingEventId) {
          await tx.breedingEvent.update({
            where: { id: pregnancy.breedingEventId },
            data: { status: BreedingStatus.ABORTED },
          });
        }
      }

      // ReproductionState has no dead-end ABORTED value (RAKHAL-271) — clear
      // the pregnancy pointer here, then refreshDerivedState() below derives the
      // cow back to OPEN (or whatever the live event state now implies).
      await tx.reproductionProfile.upsert({
        where: { cattleId: dto.cattleId },
        create: { cattleId: dto.cattleId, currentPregnancyId: null },
        update: { currentPregnancyId: null },
      });

      // RAKHAL-285: an abortion means expected-calving is no longer valid,
      // so the pregnancy-driven projection isn't either — clear it. The
      // Lactation itself (status/endDate) is untouched — she keeps milking.
      await tx.lactation.updateMany({
        where: { cattleId: dto.cattleId, status: LactationStatus.ACTIVE },
        data: { recommendedDryOffAt: null },
      });

      return created;
    });

    await this.derivation.refreshDerivedState(farmId, dto.cattleId);
    await this.logActivity(
      farmId,
      actorId,
      dto.cattleId,
      'Abortion recorded',
      `Abortion recorded for [${cattle.tagNumber}] on ${dto.abortionDate}.`,
      [
        { key: 'cattle', value: cattle.tagNumber },
        { key: 'date', value: String(dto.abortionDate) },
      ],
    );
    this.log.info('Abortion event created', {
      abortionEventId: abortion.id,
      cattleId: dto.cattleId,
      farmId,
    });

    return abortion;
  }

  async listAbortionEvents(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'abortionDate');
    const rows = await this.prisma.abortionEvent.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async listLactations(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'startDate');
    const rows = await this.prisma.lactation.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { calvingEvent: true },
    });
    return toCursorPage(rows, query);
  }

  async summary(farmId: string, cattleId: string) {
    const cattle = await this.getFemaleCattle(farmId, cattleId);
    await this.derivation.refreshDerivedState(farmId, cattleId);

    const [
      profile,
      breedings,
      pregnancies,
      calvings,
      abortions,
      currentPregnancy,
      currentLactation,
      recentHeat,
      heatWindowDays,
      closeUpWindowDays,
      openDryPeriod,
      lactationStageThresholds,
      pregnancyStageThresholds,
      overdueCheckDays,
      repeatBreederThreshold,
      longDaysOpenThresholdDays,
      calvingOverdueDays,
      reproductiveHolds,
    ] = await Promise.all([
      this.prisma.reproductionProfile.findUnique({ where: { cattleId } }),
      this.prisma.breedingEvent.findMany({
        where: { cattleId, voidedAt: null },
        orderBy: { breedingDate: 'asc' },
      }),
      this.prisma.pregnancy.findMany({
        where: { cattleId, status: { not: PregnancyStatus.FAILED } },
      }),
      this.prisma.calvingEvent.findMany({
        where: { cattleId },
        orderBy: { calvingDate: 'asc' },
      }),
      this.prisma.abortionEvent.findMany({ where: { cattleId } }),
      this.prisma.pregnancy.findFirst({
        where: { cattleId, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
      }),
      this.prisma.lactation.findFirst({
        where: { cattleId, status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.heatEvent.findFirst({
        where: { cattleId, resolvedAt: null },
        orderBy: { heatDateTime: 'desc' },
      }),
      this.farmSettings.reproHeatWindowDays(farmId),
      this.farmSettings.reproCloseUpWindowDays(farmId),
      // RAKHAL-273: an open dry period (no actualEndDate) takes priority over
      // the lactation-day thresholds for `LactationStage`.
      this.prisma.dryPeriod.findFirst({
        where: { cattleId, actualEndDate: null },
      }),
      this.farmSettings.lactationStageThresholds(farmId),
      this.farmSettings.pregnancyStageThresholds(farmId),
      // RAKHAL-272: extended alert thresholds/hold-lookup.
      this.farmSettings.reproOverduePregnancyCheckDays(farmId),
      this.farmSettings.reproRepeatBreederThreshold(farmId),
      this.farmSettings.reproLongDaysOpenDays(farmId),
      this.farmSettings.reproCalvingOverdueDays(farmId),
      this.animalHoldService.activeHoldsForCattle(
        farmId,
        cattleId,
        'REPRODUCTIVE',
      ),
    ]);

    const successfulPregnancies = pregnancies.filter(
      (pregnancy) =>
        pregnancy.status === PregnancyStatus.ACTIVE ||
        pregnancy.status === PregnancyStatus.CALVED,
    ).length;
    // RAKHAL-482: rate KPIs leave out history entries.
    const excluded = await this.historicalKpiExclusions({ cattleId });
    const kpiBreedings = breedings.filter(
      (b) => !b.animalEventId || !excluded.eventIds.includes(b.animalEventId),
    ).length;
    const kpiPregnancies = pregnancies.filter(
      (p) =>
        (p.status === PregnancyStatus.ACTIVE ||
          p.status === PregnancyStatus.CALVED) &&
        (!p.sourceDiagnosisId ||
          !excluded.diagnosisIds.includes(p.sourceDiagnosisId)),
    ).length;

    const lastBreeding = breedings.at(-1) ?? null;
    const reproductionState =
      profile?.reproductiveStatus ?? ReproductionState.NOT_ELIGIBLE;

    // RAKHAL-272: "since her last successful outcome" is anchored on the most
    // recent calving — mirrors `this.daysOpen()`'s existing anchor below. A
    // cow that's never calved has no anchor, so every recorded breeding
    // counts (a heifer can still be a repeat-breeder before her first
    // calving).
    const lastCalvingForAlerts = calvings.at(-1) ?? null;
    const breedingsSinceLastSuccess = breedings.filter(
      (b) =>
        !lastCalvingForAlerts ||
        b.breedingDate.getTime() > lastCalvingForAlerts.calvingDate.getTime(),
    ).length;
    const daysOpenForAlerts = lastCalvingForAlerts
      ? this.daysBetween(lastCalvingForAlerts.calvingDate, new Date())
      : null;

    // Derived (not stored) alerts layered on top of the core state (RAKHAL-271
    // v2 correction + RAKHAL-272's extension) — see `deriveReproductionAlerts`.
    const reproductionAlerts: ReproductionAlert[] = deriveReproductionAlerts({
      now: new Date(),
      reproductionState,
      recentHeat: recentHeat ? { heatDateTime: recentHeat.heatDateTime } : null,
      heatWindowDays,
      lastBreeding: lastBreeding
        ? {
            status: lastBreeding.status,
            expectedPregnancyCheckDate: lastBreeding.expectedPregnancyCheckDate,
          }
        : null,
      currentPregnancy: currentPregnancy
        ? { expectedCalvingDate: currentPregnancy.expectedCalvingDate }
        : null,
      closeUpWindowDays,
      overdueCheckDays,
      calvingOverdueDays,
      breedingsSinceLastSuccess,
      repeatBreederThreshold,
      daysOpen: daysOpenForAlerts,
      longDaysOpenThresholdDays,
      totalAbortions: abortions.length,
      hasReproductiveHold: reproductiveHolds.length > 0,
    });

    // Derived (not stored) stage fields (RAKHAL-273), layered alongside the
    // core state/alerts the same way — always computed at read time, both
    // nullable (a dry cow with no active pregnancy has no `pregnancyStage`; a
    // heifer with no active lactation has no `lactationStage`).
    const lactationStage: LactationStage | null = deriveLactationStage({
      now: new Date(),
      lactationStartDate: currentLactation?.startDate ?? null,
      isInActiveDryPeriod: Boolean(openDryPeriod),
      farmSettings: lactationStageThresholds,
    });

    const pregnancyStage: PregnancyStage | null = derivePregnancyStage({
      now: new Date(),
      conceptionDate: currentPregnancy?.conceptionDate ?? null,
      farmSettings: {
        ...pregnancyStageThresholds,
        closeUpWindowDays,
        gestationDays: DEFAULT_GESTATION_DAYS,
      },
    });

    return {
      cattle: {
        id: cattle.id,
        tagNumber: cattle.tagNumber,
      },
      status: reproductionState,
      reproductionAlerts,
      lactationStage,
      pregnancyStage,
      currentLactation: profile?.currentLactationNumber ?? 0,
      dim: currentLactation
        ? this.daysBetween(currentLactation.startDate, new Date())
        : null,
      // RAKHAL-281: a purchased-lactating cow's DIM/lactation-number above
      // are farmer-supplied estimates (no CalvingEvent backs them) — surface
      // that so the frontend can render "Approximately".
      isEstimated: currentLactation?.isEstimated ?? false,
      totalCalvings: calvings.length,
      totalPregnancies: successfulPregnancies,
      totalAbortions: abortions.length,
      conceptionRate: kpiBreedings > 0 ? kpiPregnancies / kpiBreedings : null,
      servicesPerConception:
        kpiPregnancies > 0 ? kpiBreedings / kpiPregnancies : null,
      averageCalvingInterval: this.averageCalvingInterval(calvings),
      expectedCalvingDate: currentPregnancy?.expectedCalvingDate ?? null,
      daysPregnant: currentPregnancy?.conceptionDate
        ? this.daysBetween(currentPregnancy.conceptionDate, new Date())
        : null,
      lastBreeding: profile?.lastBreedingDate ?? null,
      daysOpen: this.daysOpen(calvings, pregnancies),
      gestationLength:
        currentPregnancy?.actualCalvingDate && currentPregnancy.conceptionDate
          ? this.daysBetween(
              currentPregnancy.conceptionDate,
              currentPregnancy.actualCalvingDate,
            )
          : null,
    };
  }

  // ---- RAKHAL-051: Reproduction Dashboard ------------------------------------

  /**
   * Reproduction module dashboard (PRD §9.2 / API §5). Pure aggregation over the
   * already-built event tables — no schema changes. All queries are farm-scoped
   * through the `cattle.farmId` relation.
   */
  async dashboard(farmId: string) {
    const now = new Date();
    const twelveMonthsAgo = this.addDays(now, -365);
    const vwpDays = await this.farmSettings.reproVwpDays(farmId);
    const heatWindowDays = await this.farmSettings.reproHeatWindowDays(farmId);

    // ---- Farm-level KPIs (rolling 12 months) ----------------------------
    // RAKHAL-482: history entries are excluded from the rate KPIs.
    const excludedHistory = await this.historicalKpiExclusions({ farmId });
    const [
      totalActiveFemaleCows,
      heatCount12mo,
      breedingEvents12mo,
      confirmedPregnancies12mo,
      allCalvingPairs,
    ] = await Promise.all([
      // Eligible herd: active female cattle
      this.prisma.cattle.count({
        where: {
          ...activeHerd(farmId),
          gender: 'FEMALE',
        },
      }),
      // Heat events recorded in the last 12 months. The next 4 queries are
      // trailing-year KPIs (detection/conception/pregnancy rate, calving
      // interval) — deliberately herd-wide, including cows since sold/dead
      // within the window, so the rate reflects the whole period's activity.
      this.prisma.heatEvent.count({
        where: {
          cattle: { farmId },
          heatDateTime: { gte: twelveMonthsAgo },
        },
      }),
      // Breeding events in the last 12 months
      this.prisma.breedingEvent.count({
        where: {
          cattle: { farmId },
          breedingDate: { gte: twelveMonthsAgo },
          voidedAt: null,
          OR: [
            { animalEventId: null },
            { animalEventId: { notIn: excludedHistory.eventIds } },
          ],
        },
      }),
      // Pregnancies confirmed (conception date in last 12 months)
      this.prisma.pregnancy.count({
        where: {
          cattle: { farmId },
          conceptionDate: { gte: twelveMonthsAgo },
          status: { in: [PregnancyStatus.ACTIVE, PregnancyStatus.CALVED] },
          OR: [
            { sourceDiagnosisId: null },
            { sourceDiagnosisId: { notIn: excludedHistory.diagnosisIds } },
          ],
        },
      }),
      // All calving pairs per cow (for calving interval)
      this.prisma.calvingEvent.findMany({
        where: { cattle: { farmId } },
        orderBy: [{ cattleId: 'asc' }, { calvingDate: 'asc' }],
        select: { cattleId: true, calvingDate: true },
      }),
    ]);

    // Average calving interval across the whole herd
    const avgCalvingInterval = this.herdAvgCalvingInterval(allCalvingPairs);

    const kpis = {
      heat_detection_rate_pct:
        totalActiveFemaleCows > 0
          ? this.round((heatCount12mo / totalActiveFemaleCows) * 100)
          : null,
      conception_rate_pct:
        breedingEvents12mo > 0
          ? this.round((confirmedPregnancies12mo / breedingEvents12mo) * 100)
          : null,
      pregnancy_rate_pct:
        totalActiveFemaleCows > 0
          ? this.round((confirmedPregnancies12mo / totalActiveFemaleCows) * 100)
          : null,
      avg_calving_interval_days: avgCalvingInterval,
    };

    // ---- Action panels --------------------------------------------------
    const vwpCutoff = this.addDays(now, -vwpDays); // per-farm VWP (RD-016)
    const in24h = this.addDays(now, -heatWindowDays);
    const in3d = this.addDays(now, 3);
    const in7d = this.addDays(now, 7);

    const dryoffDimThreshold = 265; // cows approaching 280d DIM

    const [
      readyForAi,
      inHeatNow,
      pregnancyCheckTasks,
      calvingNext7Days,
      dryoffDue14Days,
    ] = await Promise.all([
      // Ready for AI: Open cows past VWP (active lactation started ≥60 days ago)
      this.prisma.cattle.findMany({
        where: {
          ...activeHerd(farmId),
          gender: 'FEMALE',
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
        select: {
          id: true,
          name: true,
          tagNumber: true,
          lactations: {
            where: { status: LactationStatus.ACTIVE },
            select: { startDate: true },
            take: 1,
          },
          reproductionProfile: {
            select: { lastBreedingDate: true },
          },
        },
        take: 20,
      }),
      // In heat now: heat events within the farm's heat window (RD-016-adjacent)
      this.prisma.heatEvent.findMany({
        where: {
          cattle: activeHerd(farmId),
          heatDateTime: { gte: in24h },
          resolvedAt: null,
        },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
        orderBy: { heatDateTime: 'desc' },
        take: 20,
      }),
      // RAKHAL-321: pregnancy check/recheck due, sourced from the live Task
      // Hub row instead of `BreedingEvent.status` — the Task's own
      // completion is what "the check is done" actually means (events tell
      // us what happened, tasks tell us what needs to happen). Recheck tasks
      // (RAKHAL-315's SUSPECTED branch) share the same
      // `sourceEventType`/`category` as the original check — distinguished
      // by the `name` prefix each is created with below, no schema change.
      this.prisma.task.findMany({
        where: {
          farmId,
          category: TaskCategory.BREEDING,
          sourceEventType: 'BREEDING_EVENT',
          status: { not: TaskStatus.COMPLETED },
          dueAt: { lte: in3d },
          OR: [
            { name: { startsWith: 'Pregnancy check — ' } },
            { name: { startsWith: 'Pregnancy recheck — ' } },
          ],
        },
        orderBy: { dueAt: 'asc' },
        take: 40,
      }),
      // Calving next 7 days (and overdue — no calving recorded yet past the
      // expected date; "Record Calving" is the action, so overdue belongs
      // here rather than dropping off the dashboard silently)
      this.prisma.pregnancy.findMany({
        where: {
          cattle: activeHerd(farmId),
          status: PregnancyStatus.ACTIVE,
          expectedCalvingDate: { lte: in7d },
        },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
        orderBy: { expectedCalvingDate: 'asc' },
        take: 20,
      }),
      // Dry-off due in 14 days: active lactations approaching 265+ DIM
      this.prisma.lactation.findMany({
        where: {
          cattle: activeHerd(farmId),
          status: LactationStatus.ACTIVE,
          startDate: { lte: this.addDays(now, -dryoffDimThreshold) },
        },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 20,
      }),
    ]);

    // RAKHAL-321: enrich the Task-sourced check/recheck rows — `Task` has no
    // Prisma relation to `Cattle`/`BreedingEvent` (a plain string FK shared
    // across modules, see `Task.relatedCattleId`/`sourceEventId`'s doc
    // comment), so batch-fetch both and join in memory. Cattle lookup also
    // re-applies the `isActive` filter the old `cattle: { isActive: true }`
    // nested where used to give for free.
    const checkCattleIds = [
      ...new Set(
        pregnancyCheckTasks
          .map((t) => t.relatedCattleId)
          .filter((id): id is string => !!id),
      ),
    ];
    const checkBreedingEventIds = [
      ...new Set(
        pregnancyCheckTasks
          .map((t) => t.sourceEventId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [checkCattleRows, checkBreedingRows] = await Promise.all([
      this.prisma.cattle.findMany({
        where: {
          id: { in: checkCattleIds },
          ...activeHerd(farmId),
        },
        select: { id: true, name: true, tagNumber: true },
      }),
      this.prisma.breedingEvent.findMany({
        where: { id: { in: checkBreedingEventIds } },
        select: { id: true, breedingDate: true },
      }),
    ]);
    const checkCattleById = new Map(checkCattleRows.map((c) => [c.id, c]));
    const checkBreedingById = new Map(checkBreedingRows.map((b) => [b.id, b]));
    const pregnancyCheckDue = pregnancyCheckTasks
      .filter(
        (t) => t.name.startsWith('Pregnancy check — ') && t.relatedCattleId,
      )
      .map((t) => {
        const cattle = checkCattleById.get(t.relatedCattleId!);
        const breeding = t.sourceEventId
          ? checkBreedingById.get(t.sourceEventId)
          : undefined;
        return cattle
          ? {
              cattle_id: cattle.id,
              name: cattle.name,
              tag: cattle.tagNumber,
              ai_date: breeding?.breedingDate ?? null,
              check_due_date: t.dueAt,
              breeding_event_id: t.sourceEventId ?? null,
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, 20);
    const pregnancyRecheckDue = pregnancyCheckTasks
      .filter(
        (t) => t.name.startsWith('Pregnancy recheck — ') && t.relatedCattleId,
      )
      .map((t) => {
        const cattle = checkCattleById.get(t.relatedCattleId!);
        const breeding = t.sourceEventId
          ? checkBreedingById.get(t.sourceEventId)
          : undefined;
        return cattle
          ? {
              cattle_id: cattle.id,
              name: cattle.name,
              tag: cattle.tagNumber,
              ai_date: breeding?.breedingDate ?? null,
              recheck_due_date: t.dueAt,
              breeding_event_id: t.sourceEventId ?? null,
            }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, 20);

    const action_required = {
      ready_for_ai: readyForAi.map((c) => {
        const lactationStart = c.lactations[0]?.startDate;
        return {
          cattle_id: c.id,
          name: c.name,
          tag: c.tagNumber,
          dim: lactationStart ? this.daysBetween(lactationStart, now) : null,
          days_open: lactationStart
            ? this.daysBetween(lactationStart, now)
            : null,
        };
      }),
      in_heat_now: inHeatNow.map((h) => ({
        cattle_id: h.cattle.id,
        name: h.cattle.name,
        tag: h.cattle.tagNumber,
        heat_observed_at: h.heatDateTime,
      })),
      pregnancy_check_due: pregnancyCheckDue,
      // RAKHAL-321: new panel, split out of the old combined `pregnancy_check_due`
      // now that both are Task-sourced and distinguishable by task name.
      pregnancy_recheck_due: pregnancyRecheckDue,
      calving_next_7_days: calvingNext7Days.map((p) => ({
        cattle_id: p.cattle.id,
        pregnancy_id: p.id,
        name: p.cattle.name,
        tag: p.cattle.tagNumber,
        expected_date: p.expectedCalvingDate,
        days_remaining: p.expectedCalvingDate
          ? this.daysBetween(now, p.expectedCalvingDate)
          : null,
      })),
      dryoff_due_14_days: dryoffDue14Days.map((l) => ({
        cattle_id: l.cattle.id,
        name: l.cattle.name,
        tag: l.cattle.tagNumber,
        dim: this.daysBetween(l.startDate, now),
        dryoff_target_date: this.addDays(l.startDate, 280),
      })),
    };

    // ---- 30-day calving forecast -----------------------------------------
    const calvingForecast30 = await this.prisma.pregnancy.findMany({
      where: {
        cattle: { farmId },
        status: PregnancyStatus.ACTIVE,
        expectedCalvingDate: { gte: now, lte: this.addDays(now, 30) },
      },
      include: {
        cattle: { select: { id: true, name: true, tagNumber: true } },
      },
      orderBy: { expectedCalvingDate: 'asc' },
    });

    const calving_forecast_30_days = calvingForecast30.map((p) => ({
      cattle_id: p.cattle.id,
      name: p.cattle.name,
      tag: p.cattle.tagNumber,
      expected_date: p.expectedCalvingDate,
    }));

    // ---- Open cows -------------------------------------------------------
    const openCows = await this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        gender: 'FEMALE',
        reproductionProfile: {
          is: { reproductiveStatus: ReproductionState.OPEN },
        },
      },
      include: {
        reproductionProfile: {
          select: {
            totalBreedings: true,
            totalPregnancies: true,
            lastBreedingDate: true,
          },
        },
        lactations: {
          where: { status: LactationStatus.ACTIVE },
          select: { startDate: true },
          take: 1,
        },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    const open_cows = openCows.map((c) => {
      const lactationStart = c.lactations[0]?.startDate ?? null;
      const dim = lactationStart ? this.daysBetween(lactationStart, now) : null;
      const profile = c.reproductionProfile;
      const conceptionRate =
        profile && profile.totalBreedings > 0
          ? this.round(
              (profile.totalPregnancies / profile.totalBreedings) * 100,
            )
          : null;
      return {
        cattle_id: c.id,
        name: c.name,
        tag: c.tagNumber,
        dim,
        days_open: dim,
        last_ai_date: profile?.lastBreedingDate ?? null,
        vwp_end_date: lactationStart
          ? this.addDays(lactationStart, vwpDays)
          : null,
        conception_rate_pct: conceptionRate,
      };
    });

    return { kpis, action_required, calving_forecast_30_days, open_cows };
  }

  /**
   * RAKHAL-363: every cow currently in an active reproductive cycle (OPEN /
   * BRED_AWAITING_CONFIRMATION / PREGNANT), cursor-paginated — replaces the old
   * dashboard-embedded, uncapped, OPEN-only `open_cows[]` list above. Unlike that
   * list's `days_open` (a pre-existing bug aliasing DIM), this computes a real
   * running days-open counter from `lastCalvingDate` (same shape as
   * `daysOpenForAlerts` in `summary()`), not the historical `daysOpen()` KPI
   * (which is only meaningful for a *completed* open period).
   */
  async listReproductionCows(
    farmId: string,
    query: ListReproductionCowsQueryDto,
  ) {
    const statuses = query.status
      ? [query.status]
      : [
          ReproductionState.OPEN,
          ReproductionState.BRED_AWAITING_CONFIRMATION,
          ReproductionState.PREGNANT,
        ];

    const rows = await this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        gender: CattleGender.FEMALE,
        reproductionProfile: { is: { reproductiveStatus: { in: statuses } } },
      },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        reproductionProfile: true,
        breedingEvents: {
          where: { voidedAt: null },
          orderBy: { breedingDate: 'desc' },
          take: 1,
          include: {
            diagnoses: { orderBy: { diagnosisDate: 'desc' }, take: 1 },
          },
        },
        pregnancies: {
          where: { status: PregnancyStatus.ACTIVE },
          take: 1,
        },
      },
    });

    const page = toCursorPage(rows, query);
    const now = new Date();

    return {
      ...page,
      items: page.items.map((c) => {
        const profile = c.reproductionProfile;
        const lastBreeding = c.breedingEvents[0] ?? null;
        const activePregnancy = c.pregnancies[0] ?? null;

        return {
          cattle_id: c.id,
          name: c.name,
          tag: c.tagNumber,
          status: profile?.reproductiveStatus ?? null,
          last_ai_date: profile?.lastBreedingDate ?? null,
          pregnancy_checked: Boolean(lastBreeding?.diagnoses.length),
          days_open: profile?.lastCalvingDate
            ? this.daysBetween(profile.lastCalvingDate, now)
            : null,
          days_pregnant: activePregnancy?.conceptionDate
            ? this.daysBetween(activePregnancy.conceptionDate, now)
            : null,
          expected_calving_date: activePregnancy?.expectedCalvingDate ?? null,
        };
      }),
    };
  }

  /** Herd-level average calving interval: average of per-cow average intervals. */
  private herdAvgCalvingInterval(
    pairs: { cattleId: string; calvingDate: Date }[],
  ): number | null {
    const byCow = new Map<string, Date[]>();
    for (const p of pairs) {
      const list = byCow.get(p.cattleId) ?? [];
      list.push(p.calvingDate);
      byCow.set(p.cattleId, list);
    }
    const intervals: number[] = [];
    for (const dates of byCow.values()) {
      for (let i = 1; i < dates.length; i += 1) {
        intervals.push(this.daysBetween(dates[i - 1], dates[i]));
      }
    }
    if (intervals.length === 0) return null;
    return Math.round(
      intervals.reduce((sum, v) => sum + v, 0) / intervals.length,
    );
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Flip a dam into `MILKING` (RAKHAL-281 extraction of `createCalvingEvent`'s
   * inline transition, now shared with `createPurchasedLactation`).
   * `ProductionStatus` no longer holds SOLD/DECEASED (RAKHAL-269 trimmed it to
   * MILKING|DRY, archival now nulls productionStatus + flips isActive/status
   * instead) — guard on isActive so an archived cow isn't revived.
   */
  private async flipToMilking(tx: Prisma.TransactionClient, cattleId: string) {
    await tx.cattle.updateMany({
      where: { id: cattleId, herdStatus: 'ACTIVE', deletedAt: null },
      data: { productionStatus: ProductionStatus.MILKING },
    });
  }

  /**
   * RAKHAL-324: take a Postgres row lock on the cow for the lifetime of the
   * caller's transaction. Two near-concurrent writes on the same cow (e.g. a
   * pregnancy confirmation racing a new breeding, or a return-to-heat racing
   * a diagnosis) serialize on this lock — the second transaction blocks here
   * until the first commits, then its own re-read of live state (the guard
   * that runs immediately after this call) sees the first transaction's
   * effect and can 400 cleanly instead of both succeeding inconsistently.
   */
  private async lockCattleForUpdate(
    tx: Prisma.TransactionClient,
    cattleId: string,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Cattle" WHERE id = ${cattleId} FOR UPDATE`,
    );
  }

  /**
   * RAKHAL-322: at most one active (non-completed) pregnancy-check/recheck
   * task per breeding event. `namePrefix` is the same discriminator
   * RAKHAL-321's dashboard panels already split on ("Pregnancy check — " vs
   * "Pregnancy recheck — ") — reused here instead of a new column. Guards
   * against a double-submit or a race between two workers spawning two open
   * dashboard cards for the same check.
   */
  private async createBreedingTaskUnlessDuplicate(
    input: Parameters<TaskService['createInternal']>[0],
    namePrefix: string,
  ) {
    // RAKHAL-481: a history entry creates no reminder (hub §3.5).
    if (eventApiContext()?.historical) return;
    if (input.sourceEventType && input.sourceEventId) {
      const existing = await this.prisma.task.findFirst({
        where: {
          farmId: input.farmId,
          sourceEventType: input.sourceEventType,
          sourceEventId: input.sourceEventId,
          status: { not: TaskStatus.COMPLETED },
          name: { startsWith: namePrefix },
        },
        select: { id: true },
      });
      if (existing) {
        this.log.info('Duplicate pregnancy-check/recheck task suppressed', {
          farmId: input.farmId,
          sourceEventId: input.sourceEventId,
          existingTaskId: existing.id,
        });
        return existing;
      }
    }
    return this.taskService.createInternal(input);
  }

  /**
   * RAKHAL-323: generic per-farm idempotency guard. A caller-supplied
   * `Idempotency-Key` header reserves a row before `fn()` runs — the unique
   * `(farmId, key, endpoint)` index is the race-safe guard (the DB, not a
   * pre-check, decides who wins a true concurrent double-submit). A replay
   * of the same key (sequential retry, or the loser of a race once the
   * winner has finished) returns the original stored response instead of
   * creating a second row. No key supplied → `fn()` just runs, unguarded, as
   * every caller behaved before this ticket.
   */
  /**
   * RAKHAL-482: HISTORICAL entries (intake / back-dated history) feed state but
   * not the rate KPIs. Returns the HISTORICAL header ids and the diagnosis ids
   * they belong to, scoped to one cow or a whole farm.
   */
  private async historicalKpiExclusions(scope: {
    farmId?: string;
    cattleId?: string;
  }) {
    const events = await this.prisma.animalEvent.findMany({
      where: { ...scope, provenance: 'HISTORICAL', status: 'ACTIVE' },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);
    const diagnoses = eventIds.length
      ? await this.prisma.pregnancyDiagnosis.findMany({
          where: { animalEventId: { in: eventIds } },
          select: { id: true },
        })
      : [];
    return { eventIds, diagnosisIds: diagnoses.map((d) => d.id) };
  }

  private async withIdempotency<T>(
    farmId: string,
    key: string | undefined,
    endpoint: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) return fn();

    try {
      await this.prisma.idempotencyKey.create({
        data: { farmId, key, endpoint },
      });
    } catch (error) {
      if (!this.isUniqueError(error)) throw error;
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { farmId_key_endpoint: { farmId, key, endpoint } },
      });
      if (existing?.responseBody) {
        return existing.responseBody as T;
      }
      throw new ConflictException(
        'An identical request with this Idempotency-Key is already in progress',
      );
    }

    const result = await fn();
    await this.prisma.idempotencyKey.update({
      where: { farmId_key_endpoint: { farmId, key, endpoint } },
      data: { responseBody: result as unknown as Prisma.InputJsonValue },
    });
    return result;
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }

  /** Resolve a female animal scoped to the active farm (tenant isolation). */
  private async getFemaleCattle(farmId: string, cattleId: string) {
    const cattle = await this.getCattleOrThrow(farmId, cattleId);

    if (cattle.gender !== CattleGender.FEMALE) {
      throw new BadRequestException(
        'Reproduction records can only be created for female cattle',
      );
    }

    return cattle;
  }

  // Deliberately includes archived cattle — shared by both the create-event
  // guard (getFemaleCattle/assertCattleInFarm) and the read-only events()/
  // cattleId-filter validation, and a sold/dead cow's history must stay
  // viewable. Splitting the guard so creation additionally rejects archived
  // cattle is real debt (RD-056), out of this ticket's sweep scope.
  private async getCattleOrThrow(
    farmId: string,
    cattleId: string,
  ): Promise<CattleForAccess> {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: {
        id: true,
        farmId: true,
        gender: true,
        tagNumber: true,
      },
    });

    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }

    return cattle;
  }

  /** Assert a referenced animal (e.g. a service bull) belongs to the same farm. */
  private async assertCattleInFarm(farmId: string, cattleId: string) {
    return this.getCattleOrThrow(farmId, cattleId);
  }

  /** Assert a referenced `ServiceProvider` (AI technician) belongs to the same farm and is active. */
  private async assertServiceProviderInFarm(
    farmId: string,
    serviceProviderId: string,
  ) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { id: serviceProviderId, farmId, deletedAt: null },
    });
    if (!provider) {
      throw new BadRequestException(
        'serviceProviderId does not refer to an active service provider on this farm',
      );
    }
    return provider;
  }

  private async getBreedingEventForCattle(id: string, cattleId: string) {
    const event = await this.prisma.breedingEvent.findFirst({
      where: { id, cattleId },
    });

    if (!event) {
      throw new BadRequestException(
        'Breeding event must belong to the same cattle',
      );
    }
    if (event.voidedAt) {
      throw new BadRequestException(
        'That breeding was voided - pick a live breeding.',
      );
    }

    return event;
  }

  private async getPregnancyForCattle(id: string, cattleId: string) {
    const pregnancy = await this.prisma.pregnancy.findFirst({
      where: { id, cattleId },
      include: { breedingEvent: true },
    });

    if (!pregnancy) {
      throw new BadRequestException('Pregnancy must belong to the same cattle');
    }

    return pregnancy;
  }

  /**
   * Build a list filter scoped to the active farm (token tenancy). The farm is
   * applied via the `cattle` relation; an optional `cattleId` is verified to
   * belong to the farm before it narrows the result.
   */
  private async buildScopedWhere(
    farmId: string,
    query: ReproductionListQueryDto,
    dateField: string,
  ) {
    if (query.cattleId) {
      await this.getCattleOrThrow(farmId, query.cattleId);
    }

    return {
      cattle: { farmId },
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
      ...this.dateRange(dateField, query.fromDate, query.toDate),
    };
  }

  private async ensureProfile(cattleId: string) {
    await this.prisma.reproductionProfile.upsert({
      where: { cattleId },
      create: { cattleId },
      update: {},
    });
  }

  private dateRange(field: string, fromDate?: string, toDate?: string) {
    if (!fromDate && !toDate) return {};
    return {
      [field]: {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      },
    };
  }

  private averageCalvingInterval(
    calvings: Array<{ calvingDate: Date }>,
  ): number | null {
    if (calvings.length < 2) return null;

    const intervals: number[] = [];
    for (let index = 1; index < calvings.length; index += 1) {
      intervals.push(
        this.daysBetween(
          calvings[index - 1].calvingDate,
          calvings[index].calvingDate,
        ),
      );
    }

    return Math.round(
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
    );
  }

  private daysOpen(
    calvings: Array<{ calvingDate: Date }>,
    pregnancies: Array<{
      conceptionDate: Date | null;
      status: PregnancyStatus;
    }>,
  ) {
    const lastCalving = calvings.at(-1);
    if (!lastCalving) return null;

    const conceptionAfterCalving = pregnancies.find(
      (pregnancy) =>
        pregnancy.conceptionDate !== null &&
        pregnancy.conceptionDate.getTime() >
          lastCalving.calvingDate.getTime() &&
        (pregnancy.status === PregnancyStatus.ACTIVE ||
          pregnancy.status === PregnancyStatus.CALVED),
    );

    if (!conceptionAfterCalving?.conceptionDate) return null;
    return this.daysBetween(
      lastCalving.calvingDate,
      conceptionAfterCalving.conceptionDate,
    );
  }

  private daysBetween(start: Date, end: Date) {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * RAKHAL-320: end of `date`'s calendar day (23:59:59.999). Used to compare
   * an event-time timestamp (e.g. `HeatEvent.heatDateTime`) against a
   * date-only input (e.g. a breeding date with no time component) without
   * the date-only value's implicit midnight losing same-day events recorded
   * later in the day.
   */
  private endOfDay(date: Date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
