import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BreedingMethod,
  BreedingStatus,
  CalfBirthStatus,
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  CattleStatus,
  DryPeriod,
  LactationStartReason,
  LactationStatus,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  Prisma,
  ProductionStatus,
  ReproductionState,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { SemenService } from 'src/modules/inventory/application/services/semen.service';
import { CalfService } from 'src/modules/calf/application/services/calf.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { AnimalHoldService } from 'src/modules/cattle/application/services/animal-hold.service';
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
import { CreateAbortionEventDto } from '../../presentation/dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../../presentation/dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../../presentation/dto/create-calving-event.dto';
import { CreateDryOffDto } from '../../presentation/dto/create-dry-off.dto';
import { CreatePurchasedLactationDto } from '../../presentation/dto/create-purchased-lactation.dto';
import { CreateHeatEventDto } from '../../presentation/dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../../presentation/dto/create-pregnancy-diagnosis.dto';
import { ReproductionListQueryDto } from '../../presentation/dto/common.dto';

type CattleForAccess = {
  id: string;
  farmId: string;
  gender: CattleGender;
  tagNumber: string;
};

/** ~15 months — typical heifer breeding-readiness threshold (PRD §9). */
const MIN_BREEDING_AGE_DAYS = 450;
/** Standard bovine gestation length, in days — same fallback used elsewhere
 * in this service (`createPregnancyDiagnosis`) when no explicit
 * `expectedCalvingDate` is recorded; reused by `derivePregnancyStage`'s
 * close-up-window projection (RAKHAL-273). */
const DEFAULT_GESTATION_DAYS = 280;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReproductionStateInput {
  now: Date;
  gender: CattleGender | null | undefined;
  dateOfBirth: Date | null;
  /** Ever bred/pregnant/calved — guards NOT_ELIGIBLE from overriding real history. */
  hasBreedingHistory: boolean;
  hasActivePregnancy: boolean;
  lastBreeding: { status: BreedingStatus } | null;
  lastCalving: { calvingDate: Date } | null;
  vwpDays: number;
}

/**
 * Pure breeding-cycle CORE-STATE derivation (RAKHAL-271, v2 correction).
 * Priority (first match wins): NOT_ELIGIBLE (male / under breeding age with
 * no history) → PREGNANT (any active pregnancy, regardless of closeness to
 * calving — that's the derived `CALVING_DUE` alert's job, not a different
 * state) → BRED_AWAITING_CONFIRMATION (pending-check breeding) →
 * POSTPARTUM_WAITING (inside VWP after last calving) → OPEN.
 *
 * v2 dropped the v1 `IN_HEAT`/`PREGNANCY_CHECK_DUE`/`EXPECTED_TO_CALVE`
 * branches entirely — those were time-bound alerts baked into the core
 * enum, not core biological states. See `deriveReproductionAlerts`
 * (`../../domain/reproduction-alerts.ts`) for the derived, multi-valued,
 * read-time-only replacement.
 *
 * Exported (not just a private service method) so it's unit-testable without
 * a Prisma double.
 */
export function deriveReproductionState(
  input: ReproductionStateInput,
): ReproductionState {
  const {
    now,
    gender,
    dateOfBirth,
    hasBreedingHistory,
    hasActivePregnancy,
    lastBreeding,
    lastCalving,
    vwpDays,
  } = input;

  const ageDays = dateOfBirth
    ? Math.floor((now.getTime() - dateOfBirth.getTime()) / DAY_MS)
    : null;
  const underBreedingAge = ageDays !== null && ageDays < MIN_BREEDING_AGE_DAYS;

  if (
    gender !== CattleGender.FEMALE ||
    (underBreedingAge && !hasBreedingHistory)
  ) {
    return ReproductionState.NOT_ELIGIBLE;
  }

  if (hasActivePregnancy) {
    return ReproductionState.PREGNANT;
  }

  if (lastBreeding?.status === BreedingStatus.PENDING_CHECK) {
    return ReproductionState.BRED_AWAITING_CONFIRMATION;
  }

  if (lastCalving) {
    const daysSinceCalving = Math.floor(
      (now.getTime() - lastCalving.calvingDate.getTime()) / DAY_MS,
    );
    if (daysSinceCalving < vwpDays) {
      return ReproductionState.POSTPARTUM_WAITING;
    }
  }

  return ReproductionState.OPEN;
}

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
    private readonly calfService: CalfService,
    private readonly farmSettings: FarmSettingsService,
    private readonly animalHoldService: AnimalHoldService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(ReproductionService.name);
  }

  async createHeatEvent(farmId: string, dto: CreateHeatEventDto) {
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

    await this.ensureProfile(dto.cattleId);
    this.log.info('Heat event created', {
      heatEventId: heatEvent.id,
      cattleId: dto.cattleId,
      farmId: cattle.farmId,
    });

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
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);

    if (dto.bullId) {
      await this.assertCattleInFarm(farmId, dto.bullId);
    }

    // Inventory decrement (REP-05): consume one straw for an AI service before
    // recording it, so a missing/empty batch (INV-02) aborts the breeding.
    if (dto.breedingMethod === BreedingMethod.AI && dto.semenBatchId) {
      await this.semenService.decrementStraw(farmId, dto.semenBatchId, 1);
    }

    const breedingNumber =
      dto.breedingNumber ??
      (await this.prisma.breedingEvent.count({
        where: { cattleId: dto.cattleId },
      })) + 1;

    const breedingEvent = await this.prisma.breedingEvent.create({
      data: {
        cattleId: dto.cattleId,
        breedingDate: new Date(dto.breedingDate),
        breedingMethod: dto.breedingMethod,
        bullId: dto.bullId,
        semenBatchId: dto.semenBatchId,
        inseminator: dto.inseminator,
        breedingNumber,
        expectedPregnancyCheckDate: dto.expectedPregnancyCheckDate
          ? new Date(dto.expectedPregnancyCheckDate)
          : this.addDays(new Date(dto.breedingDate), 35),
        status: dto.status ?? BreedingStatus.PENDING_CHECK,
        notes: dto.notes,
      },
      include: {
        bull: { select: { id: true, tagNumber: true, name: true } },
      },
    });

    await this.refreshProfile(farmId, dto.cattleId);

    // Task Hub: schedule the pregnancy check for this service (PRD §9.3, §17.6).
    await this.taskService.createInternal({
      farmId,
      createdBy: userId,
      name: `Pregnancy check — ${cattle.tagNumber}`,
      details: `Confirm pregnancy for breeding #${breedingEvent.breedingNumber} of [${cattle.tagNumber}].`,
      category: TaskCategory.BREEDING,
      priority: TaskPriority.MEDIUM,
      dueAt:
        breedingEvent.expectedPregnancyCheckDate ??
        this.addDays(new Date(dto.breedingDate), 35),
      source: TaskSource.SYSTEM_AUTO,
      relatedCattleId: dto.cattleId,
    });

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
      where,
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
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
    const breedingEvent = dto.breedingEventId
      ? await this.getBreedingEventForCattle(dto.breedingEventId, dto.cattleId)
      : null;

    const diagnosis = await this.prisma.$transaction(async (tx) => {
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
        const conceptionDate =
          breedingEvent?.breedingDate ?? new Date(dto.diagnosisDate);
        const pregnancy = await tx.pregnancy.create({
          data: {
            cattleId: dto.cattleId,
            breedingEventId: dto.breedingEventId,
            conceptionDate,
            expectedCalvingDate: dto.expectedCalvingDate
              ? new Date(dto.expectedCalvingDate)
              : this.addDays(conceptionDate, 280),
            gestationDays: dto.gestationDay,
            status: PregnancyStatus.ACTIVE,
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

    await this.refreshProfile(farmId, dto.cattleId);

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
    }

    this.log.info('Pregnancy diagnosis created', {
      pregnancyDiagnosisId: diagnosis.id,
      cattleId: dto.cattleId,
      farmId,
      result: dto.result,
    });

    return diagnosis;
  }

  async listPregnancies(farmId: string, query: ReproductionListQueryDto) {
    const where = await this.buildScopedWhere(farmId, query, 'conceptionDate');
    const rows = await this.prisma.pregnancy.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async createCalvingEvent(
    farmId: string,
    userId: string,
    dto: CreateCalvingEventDto,
  ) {
    const cattle = await this.getFemaleCattle(farmId, dto.cattleId);
    const pregnancy = dto.pregnancyId
      ? await this.getPregnancyForCattle(dto.pregnancyId, dto.cattleId)
      : null;
    const calvingDate = new Date(dto.calvingDate);

    const calvingNumber =
      dto.calvingNumber ??
      (await this.prisma.calvingEvent.count({
        where: { cattleId: dto.cattleId },
      })) + 1;

    const calvingEvent = await this.prisma.$transaction(async (tx) => {
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
            gestationDays: this.daysBetween(
              pregnancy.conceptionDate,
              calvingDate,
            ),
          },
        });

        if (pregnancy.breedingEventId) {
          await tx.breedingEvent.update({
            where: { id: pregnancy.breedingEventId },
            data: { status: BreedingStatus.CALVED },
          });
        }
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
              purpose: CattlePurpose.CALF,
              status: CattleStatus.ACTIVE,
              motherId: dto.cattleId,
              fatherId: pregnancy?.breedingEvent?.bullId ?? undefined,
              sourceType: CattleSourceType.BORN,
              isActive: true,
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
      // `refreshProfile()` call, which previously left a real window where a
      // reader could observe `productionStatus: MILKING` with a stale
      // `totalCalvings` if it raced between commit and that follow-up call.
      // reproductiveStatus itself is still left to refreshProfile() below —
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

      return tx.calvingEvent.findUnique({
        where: { id: created.id },
        include: { calfBirths: { include: { calf: true } }, lactations: true },
      });
    });

    await this.refreshProfile(farmId, dto.cattleId);

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
    });

    this.log.info('Calving event created', {
      calvingEventId: calvingEvent?.id,
      cattleId: dto.cattleId,
      farmId,
    });

    return calvingEvent;
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
  ): Promise<DryPeriod> {
    const cattle = await this.getFemaleCattle(farmId, cattleId);
    const dryOffDate = dto.dryOffDate ? new Date(dto.dryOffDate) : new Date();

    const activeLactation = await this.prisma.lactation.findFirst({
      where: { cattleId, status: LactationStatus.ACTIVE },
      orderBy: { startDate: 'desc' },
    });
    if (!activeLactation) {
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
      await tx.lactation.update({
        where: { id: activeLactation.id },
        data: { status: LactationStatus.ENDED, endDate: dryOffDate },
      });

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
        where: { id: cattleId, isActive: true },
        data: { productionStatus: ProductionStatus.DRY },
      });

      return created;
    });

    await this.refreshProfile(farmId, cattleId);

    this.log.info('Dry-off recorded', {
      dryPeriodId: dryPeriod.id,
      cattleId,
      farmId,
      lactationId: activeLactation.id,
    });

    return dryPeriod;
  }

  /**
   * RAKHAL-281: start a `Lactation` for a purchased-lactating cow with no
   * `CalvingEvent` on record in this system — the farmer supplies whatever
   * she knows (estimated calving date / known DIM / lactation number),
   * possibly nothing at all. Mirrors `createCalvingEvent`'s
   * `Cattle.productionStatus` flip (via the shared `flipToMilking`) and its
   * `ReproductionProfile.currentLactationNumber`/`currentLactationId`
   * bookkeeping, without duplicating the `CalvingEvent`/`CalfBirth`/AQR/Task
   * side effects — there is no birth to register here.
   *
   * Deliberate scope decision (documented, not silently skipped): this does
   * **not** touch `ReproductionProfile.totalCalvings` — `createCalvingEvent`
   * derives that field from a real `CalvingEvent.count()`, which stays 0 here
   * (no `CalvingEvent` exists for a purchased cow). A purchased-lactating cow
   * may therefore still derive `AnimalCategory=HEIFER` (`totalCalvings===0`)
   * in `CattleService`'s domain logic despite being `MILKING` here — the
   * existing `priorCalvings` intake field on `CreateCattleDto`/
   * `UpdateCattleStatusDto` (RAKHAL-291) is the supported way to also record
   * real prior-calving history; wiring the two together is left to a future
   * ticket rather than reaching into `CattleModule`'s `ReproductionProfile`
   * invariant from here.
   */
  async createPurchasedLactation(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: CreatePurchasedLactationDto,
  ) {
    const cattle = await this.getFemaleCattle(farmId, cattleId);

    const existingActiveLactation = await this.prisma.lactation.findFirst({
      where: { cattleId, status: LactationStatus.ACTIVE },
    });
    if (existingActiveLactation) {
      throw new BadRequestException(
        `[${cattle.tagNumber}] already has an active lactation on record`,
      );
    }

    const now = new Date();
    // Best available anchor for the required `Lactation.startDate` column:
    // a known DIM (most current signal) > an estimated calving date > "now"
    // (no information supplied at all — still a valid intake, just fully
    // unestimated beyond "she is milking today").
    const startDate =
      dto.estimatedDaysInMilk !== undefined
        ? this.addDays(now, -dto.estimatedDaysInMilk)
        : dto.estimatedCalvingDate
          ? new Date(dto.estimatedCalvingDate)
          : now;

    const existingLactationCount = await this.prisma.lactation.count({
      where: { cattleId },
    });
    const lactationNumber =
      dto.estimatedLactationNumber ?? existingLactationCount + 1;

    const lactation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lactation.create({
        data: {
          cattleId,
          lactationNumber,
          startDate,
          status: LactationStatus.ACTIVE,
          startReason: LactationStartReason.PURCHASED_LACTATING,
          isEstimated: true,
          estimatedLactationNumber: dto.estimatedLactationNumber ?? null,
          estimatedDaysInMilk: dto.estimatedDaysInMilk ?? null,
        },
      });

      await tx.reproductionProfile.upsert({
        where: { cattleId },
        create: {
          cattleId,
          currentLactationNumber: lactationNumber,
          currentLactationId: created.id,
        },
        update: {
          currentLactationNumber: lactationNumber,
          currentLactationId: created.id,
        },
      });

      await this.flipToMilking(tx, cattleId);

      return created;
    });

    await this.refreshProfile(farmId, cattleId);

    this.log.info('Purchased-lactating cow intake recorded', {
      lactationId: lactation.id,
      cattleId,
      farmId,
      userId,
      isEstimated: true,
    });

    return lactation;
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

  async createAbortionEvent(farmId: string, dto: CreateAbortionEventDto) {
    await this.getFemaleCattle(farmId, dto.cattleId);
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
      // the pregnancy pointer here, then refreshProfile() below derives the
      // cow back to OPEN (or whatever the live event state now implies).
      await tx.reproductionProfile.upsert({
        where: { cattleId: dto.cattleId },
        create: { cattleId: dto.cattleId, currentPregnancyId: null },
        update: { currentPregnancyId: null },
      });

      return created;
    });

    await this.refreshProfile(farmId, dto.cattleId);
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
    await this.refreshProfile(farmId, cattleId);

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
        where: { cattleId },
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
        where: { cattleId },
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
      conceptionRate:
        breedings.length > 0 ? successfulPregnancies / breedings.length : null,
      servicesPerConception:
        successfulPregnancies > 0
          ? breedings.length / successfulPregnancies
          : null,
      averageCalvingInterval: this.averageCalvingInterval(calvings),
      expectedCalvingDate: currentPregnancy?.expectedCalvingDate ?? null,
      daysPregnant: currentPregnancy
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

    // ---- Farm-level KPIs (rolling 12 months) ----------------------------
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
          farmId,
          isActive: true,
          gender: 'FEMALE',
        },
      }),
      // Heat events recorded in the last 12 months
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
        },
      }),
      // Pregnancies confirmed (conception date in last 12 months)
      this.prisma.pregnancy.count({
        where: {
          cattle: { farmId },
          conceptionDate: { gte: twelveMonthsAgo },
          status: { in: [PregnancyStatus.ACTIVE, PregnancyStatus.CALVED] },
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
    const in24h = this.addHours(now, -24);
    const in3d = this.addDays(now, 3);
    const in7d = this.addDays(now, 7);

    const dryoffDimThreshold = 265; // cows approaching 280d DIM

    const [
      readyForAi,
      inHeatNow,
      pregnancyCheckDue,
      calvingNext7Days,
      dryoffDue14Days,
    ] = await Promise.all([
      // Ready for AI: Open cows past VWP (active lactation started ≥60 days ago)
      this.prisma.cattle.findMany({
        where: {
          farmId,
          isActive: true,
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
      // In heat now: heat events in the last 24 hours
      this.prisma.heatEvent.findMany({
        where: {
          cattle: { farmId },
          heatDateTime: { gte: in24h },
        },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
        orderBy: { heatDateTime: 'desc' },
        take: 20,
      }),
      // Pregnancy check due: breeding events with pending check due ≤ today + 3d
      this.prisma.breedingEvent.findMany({
        where: {
          cattle: { farmId },
          status: BreedingStatus.PENDING_CHECK,
          expectedPregnancyCheckDate: { lte: in3d },
        },
        include: {
          cattle: { select: { id: true, name: true, tagNumber: true } },
        },
        orderBy: { expectedPregnancyCheckDate: 'asc' },
        take: 20,
      }),
      // Calving next 7 days
      this.prisma.pregnancy.findMany({
        where: {
          cattle: { farmId },
          status: PregnancyStatus.ACTIVE,
          expectedCalvingDate: { gte: now, lte: in7d },
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
          cattle: { farmId },
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
      pregnancy_check_due: pregnancyCheckDue.map((b) => ({
        cattle_id: b.cattle.id,
        name: b.cattle.name,
        tag: b.cattle.tagNumber,
        ai_date: b.breedingDate,
        check_due_date: b.expectedPregnancyCheckDate,
      })),
      calving_next_7_days: calvingNext7Days.map((p) => ({
        cattle_id: p.cattle.id,
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
        farmId,
        isActive: true,
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
   * Unified reproduction events feed (API §5 `GET /reproduction/events`).
   * Merges heat / breeding / pregnancy-diagnosis / calving / abortion events
   * from the event tables, filters by type and date range, returns cursor page.
   */
  async events(
    farmId: string,
    query: {
      cattleId?: string;
      eventType?: string;
      fromDate?: string;
      toDate?: string;
      limit?: number;
      cursor?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    if (query.cattleId) {
      await this.getCattleOrThrow(farmId, query.cattleId);
    }

    const cattleWhere = {
      cattle: { farmId },
      ...(query.cattleId ? { cattleId: query.cattleId } : {}),
    };
    const limit = query.limit ?? 20;
    const types = query.eventType
      ? [query.eventType]
      : ['heat', 'breeding', 'calving', 'abortion', 'pregnancy_diagnosis'];

    const dateFilter = (field: string) =>
      query.fromDate || query.toDate
        ? {
            [field]: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {};

    const cattleInclude = {
      cattle: { select: { id: true, name: true, tagNumber: true } },
    } as const;
    const [heats, breedings, calvings, abortions, diagnoses] =
      await Promise.all([
        this.prisma.heatEvent.findMany({
          where: types.includes('heat')
            ? { ...cattleWhere, ...dateFilter('heatDateTime') }
            : { id: 'NEVER' },
          include: cattleInclude,
          orderBy: { heatDateTime: 'desc' },
          take: limit,
        }),
        this.prisma.breedingEvent.findMany({
          where: types.includes('breeding')
            ? { ...cattleWhere, ...dateFilter('breedingDate') }
            : { id: 'NEVER' },
          include: cattleInclude,
          orderBy: { breedingDate: 'desc' },
          take: limit,
        }),
        this.prisma.calvingEvent.findMany({
          where: types.includes('calving')
            ? { ...cattleWhere, ...dateFilter('calvingDate') }
            : { id: 'NEVER' },
          include: cattleInclude,
          orderBy: { calvingDate: 'desc' },
          take: limit,
        }),
        this.prisma.abortionEvent.findMany({
          where: types.includes('abortion')
            ? { ...cattleWhere, ...dateFilter('abortionDate') }
            : { id: 'NEVER' },
          include: cattleInclude,
          orderBy: { abortionDate: 'desc' },
          take: limit,
        }),
        this.prisma.pregnancyDiagnosis.findMany({
          where: types.includes('pregnancy_diagnosis')
            ? { ...cattleWhere, ...dateFilter('diagnosisDate') }
            : { id: 'NEVER' },
          include: cattleInclude,
          orderBy: { diagnosisDate: 'desc' },
          take: limit,
        }),
      ]);

    type EventEntry = {
      id: string;
      event_type: string;
      event_date: Date;
      cattle_id: string;
      cattle_name: string | null;
      cattle_tag: string;
      details: Record<string, unknown>;
    };

    const unified: EventEntry[] = [
      ...heats.map((h) => ({
        id: h.id,
        event_type: 'heat',
        event_date: h.heatDateTime,
        cattle_id: h.cattle.id,
        cattle_name: h.cattle.name,
        cattle_tag: h.cattle.tagNumber,
        details: {
          detection_method: h.detectionMethod,
          standing_heat: h.standingHeat,
        },
      })),
      ...breedings.map((b) => ({
        id: b.id,
        event_type: 'breeding',
        event_date: b.breedingDate,
        cattle_id: b.cattle.id,
        cattle_name: b.cattle.name,
        cattle_tag: b.cattle.tagNumber,
        details: {
          method: b.breedingMethod,
          status: b.status,
          inseminator: b.inseminator,
        },
      })),
      ...calvings.map((c) => ({
        id: c.id,
        event_type: 'calving',
        event_date: c.calvingDate,
        cattle_id: c.cattle.id,
        cattle_name: c.cattle.name,
        cattle_tag: c.cattle.tagNumber,
        details: { calving_ease: c.calvingEase, calf_count: c.calfCount },
      })),
      ...abortions.map((a) => ({
        id: a.id,
        event_type: 'abortion',
        event_date: a.abortionDate,
        cattle_id: a.cattle.id,
        cattle_name: a.cattle.name,
        cattle_tag: a.cattle.tagNumber,
        details: {
          gestation_day: a.gestationDay,
          suspected_cause: a.suspectedCause,
        },
      })),
      ...diagnoses.map((d) => ({
        id: d.id,
        event_type: 'pregnancy_diagnosis',
        event_date: d.diagnosisDate,
        cattle_id: d.cattle.id,
        cattle_name: d.cattle.name,
        cattle_tag: d.cattle.tagNumber,
        details: { result: d.result, method: d.diagnosisMethod },
      })),
    ]
      .sort((a, b) => b.event_date.getTime() - a.event_date.getTime())
      .slice(0, limit);

    return { items: unified, meta: { total: unified.length, limit } };
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
      where: { id: cattleId, isActive: true },
      data: { productionStatus: ProductionStatus.MILKING },
    });
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

  private async getBreedingEventForCattle(id: string, cattleId: string) {
    const event = await this.prisma.breedingEvent.findFirst({
      where: { id, cattleId },
    });

    if (!event) {
      throw new BadRequestException(
        'Breeding event must belong to the same cattle',
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

  /**
   * Recomputes `ReproductionProfile` from live event state (RAKHAL-271).
   * `farmId` is needed to read the farm's VWP/heat-window/close-up-window
   * settings (`FarmSettingsService`, RD-016 pattern).
   */
  private async refreshProfile(farmId: string, cattleId: string) {
    // Only the inputs `deriveReproductionState` actually needs (RAKHAL-271 v2
    // correction) — heat/close-up-window data moved out to
    // `deriveReproductionAlerts`, computed separately at read time (e.g.
    // `summary()`), not stored on the profile.
    const [
      cattle,
      vwpDays,
      totalBreedings,
      pregnancies,
      totalCalvings,
      totalAbortions,
      firstCalving,
      lastBreeding,
      lastDiagnosis,
      lastCalving,
      currentPregnancy,
      currentLactation,
    ] = await Promise.all([
      this.prisma.cattle.findUnique({
        where: { id: cattleId },
        select: { gender: true, dateOfBirth: true },
      }),
      this.farmSettings.reproVwpDays(farmId),
      this.prisma.breedingEvent.count({ where: { cattleId } }),
      this.prisma.pregnancy.findMany({
        where: { cattleId, status: { not: PregnancyStatus.FAILED } },
        select: { id: true, status: true },
      }),
      this.prisma.calvingEvent.count({ where: { cattleId } }),
      this.prisma.abortionEvent.count({ where: { cattleId } }),
      this.prisma.calvingEvent.findFirst({
        where: { cattleId },
        orderBy: { calvingDate: 'asc' },
      }),
      this.prisma.breedingEvent.findFirst({
        where: { cattleId },
        orderBy: { breedingDate: 'desc' },
      }),
      this.prisma.pregnancyDiagnosis.findFirst({
        where: { cattleId },
        orderBy: { diagnosisDate: 'desc' },
      }),
      this.prisma.calvingEvent.findFirst({
        where: { cattleId },
        orderBy: { calvingDate: 'desc' },
      }),
      this.prisma.pregnancy.findFirst({
        where: { cattleId, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
      }),
      this.prisma.lactation.findFirst({
        where: { cattleId, status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    const status = deriveReproductionState({
      now: new Date(),
      gender: cattle?.gender,
      dateOfBirth: cattle?.dateOfBirth ?? null,
      hasBreedingHistory:
        totalBreedings > 0 || pregnancies.length > 0 || totalCalvings > 0,
      hasActivePregnancy: Boolean(currentPregnancy),
      lastBreeding: lastBreeding ? { status: lastBreeding.status } : null,
      lastCalving: lastCalving
        ? { calvingDate: lastCalving.calvingDate }
        : null,
      vwpDays,
    });

    await this.prisma.reproductionProfile.upsert({
      where: { cattleId },
      create: {
        cattleId,
        reproductiveStatus: status,
        currentLactationNumber: currentLactation?.lactationNumber ?? 0,
        totalBreedings,
        totalPregnancies: pregnancies.length,
        totalCalvings,
        totalAbortions,
        firstCalvingDate: firstCalving?.calvingDate,
        lastBreedingDate: lastBreeding?.breedingDate,
        lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
        lastCalvingDate: lastCalving?.calvingDate,
        currentPregnancyId: currentPregnancy?.id,
        currentLactationId: currentLactation?.id,
      },
      update: {
        reproductiveStatus: status,
        currentLactationNumber: currentLactation?.lactationNumber ?? 0,
        totalBreedings,
        totalPregnancies: pregnancies.length,
        totalCalvings,
        totalAbortions,
        firstCalvingDate: firstCalving?.calvingDate,
        lastBreedingDate: lastBreeding?.breedingDate,
        lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
        lastCalvingDate: lastCalving?.calvingDate,
        currentPregnancyId: currentPregnancy?.id,
        currentLactationId: currentLactation?.id,
      },
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
    pregnancies: Array<{ conceptionDate: Date; status: PregnancyStatus }>,
  ) {
    const lastCalving = calvings.at(-1);
    if (!lastCalving) return null;

    const conceptionAfterCalving = pregnancies.find(
      (pregnancy) =>
        pregnancy.conceptionDate.getTime() >
          lastCalving.calvingDate.getTime() &&
        (pregnancy.status === PregnancyStatus.ACTIVE ||
          pregnancy.status === PregnancyStatus.CALVED),
    );

    if (!conceptionAfterCalving) return null;
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

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
