import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  BreedingMethod,
  CattleGender,
  ExpectedCalvingDateSource,
  LactationEndReason,
  LactationStatus,
  PregnancyDiagnosisResult,
  PregnancyStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import {
  ActivityLogService,
  ActivityTaggedValue,
} from 'src/modules/activity/application/services/activity-log.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { SemenService } from 'src/modules/inventory/application/services/semen.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { computeDryOffProjection } from '../../domain/lactation-dry-off-projection';
import { ReproductionDerivationService } from './reproduction-derivation.service';
import { EditHeatEventDto } from '../../presentation/dto/edit-heat-event.dto';
import { EditBreedingEventDto } from '../../presentation/dto/edit-breeding-event.dto';
import { EditPregnancyDiagnosisDto } from '../../presentation/dto/edit-pregnancy-diagnosis.dto';
import { EditAbortionEventDto } from '../../presentation/dto/edit-abortion-event.dto';
import { EditDryOffDto } from '../../presentation/dto/edit-dry-off.dto';

/**
 * RAKHAL-305: `PATCH` edit handlers for heat / breeding / pregnancy-diagnosis
 * / abortion / dry-off. Deliberately its own file — `reproduction.service.ts`
 * is the RAKHAL-301 critical-path file and stays create/read-only here.
 *
 * Every handler follows the same shape (design doc §3): **update the row →
 * run the few real materialized-side-effect compensations (§3.2) →
 * `refreshDerivedState` for the old AND new cattle → append an
 * `ActivityLog` before/after entry.** Derived fields (`BreedingEvent.status`,
 * `Pregnancy.status`, `Cattle.productionStatus`, `Lactation.recommendedDryOffAt`)
 * are never written directly here — `refreshDerivedState` is the only writer.
 */
@Injectable()
export class ReproductionEditService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly derivation: ReproductionDerivationService,
    private readonly semenService: SemenService,
    private readonly taskService: TaskService,
    private readonly aqrService: AqrService,
    private readonly activityLog: ActivityLogService,
    private readonly farmSettings: FarmSettingsService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReproductionEditService.name);
  }

  // ---- Heat ------------------------------------------------------------

  async editHeatEvent(
    farmId: string,
    userId: string,
    id: string,
    dto: EditHeatEventDto,
  ) {
    const existing = await this.prisma.heatEvent.findFirst({
      where: { id, cattle: { farmId } },
    });
    if (!existing) throw new NotFoundException('Heat event not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);

    const updated = await this.prisma.heatEvent.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        heatDateTime: dto.heatDateTime ? new Date(dto.heatDateTime) : undefined,
        detectionMethod: dto.detectionMethod,
        standingHeat: dto.standingHeat,
        mucusDischarge: dto.mucusDischarge,
        mountingBehavior: dto.mountingBehavior,
        restlessness: dto.restlessness,
        notes: dto.notes,
      },
    });

    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(
      farmId,
      userId,
      'Heat Event',
      existing,
      dto,
      newCattleId,
    );
    this.log.info('Heat event edited', { heatEventId: id, farmId });
    return updated;
  }

  // ---- Breeding ----------------------------------------------------------

  async editBreedingEvent(
    farmId: string,
    userId: string,
    id: string,
    dto: EditBreedingEventDto,
  ) {
    const existing = await this.prisma.breedingEvent.findFirst({
      where: { id, cattle: { farmId } },
    });
    if (!existing) throw new NotFoundException('Breeding event not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
    if (dto.bullId) await this.assertCattleInFarm(farmId, dto.bullId);

    const mergedMethod = dto.breedingMethod ?? existing.breedingMethod;
    const mergedSemenBatchId =
      dto.semenBatchId !== undefined ? dto.semenBatchId : existing.semenBatchId;
    const newBreedingDate = dto.breedingDate
      ? new Date(dto.breedingDate)
      : existing.breedingDate;

    const hadStraw =
      existing.breedingMethod === BreedingMethod.AI && !!existing.semenBatchId;
    const willHaveStraw =
      mergedMethod === BreedingMethod.AI && !!mergedSemenBatchId;
    const batchChanged = mergedSemenBatchId !== existing.semenBatchId;

    const updated = await this.prisma.breedingEvent.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        breedingDate: dto.breedingDate ? newBreedingDate : undefined,
        breedingMethod: dto.breedingMethod,
        bullId: dto.bullId,
        semenBatchId: dto.semenBatchId,
        inseminator: dto.inseminator,
        breedingNumber: dto.breedingNumber,
        expectedPregnancyCheckDate: dto.expectedPregnancyCheckDate
          ? new Date(dto.expectedPregnancyCheckDate)
          : dto.breedingDate
            ? this.addDays(newBreedingDate, 35)
            : undefined,
        notes: dto.notes,
      },
    });

    // §3.2 row 1: semenBatchId change — restore old, decrement new.
    if (hadStraw && (!willHaveStraw || batchChanged) && existing.semenBatchId) {
      await this.semenService.restoreStraw(
        farmId,
        existing.semenBatchId,
        1,
        'Breeding event edited',
        id,
        userId,
      );
    }
    if (willHaveStraw && (!hadStraw || batchChanged) && mergedSemenBatchId) {
      await this.semenService.decrementStraw(
        farmId,
        mergedSemenBatchId,
        1,
        userId,
        id,
      );
    }

    // §3.2 row 2: breedingDate change — reschedule the pregnancy-check task
    // and re-stamp the heat-resolution timestamp it closed (if any).
    if (dto.breedingDate) {
      await this.taskService.rescheduleBySourceEvent(
        farmId,
        'BREEDING_EVENT',
        id,
        updated.expectedPregnancyCheckDate ?? this.addDays(newBreedingDate, 35),
      );

      const linkedHeat = await this.prisma.heatEvent.findFirst({
        where: { resolvedByBreedingEventId: id },
      });
      if (linkedHeat) {
        await this.prisma.heatEvent.update({
          where: { id: linkedHeat.id },
          data: { resolvedAt: newBreedingDate },
        });
      }
    }

    // §3.2 row 3: bullId change — update any calf's fatherId (`:554` origin).
    if (dto.bullId && dto.bullId !== existing.bullId) {
      const pregnancies = await this.prisma.pregnancy.findMany({
        where: { breedingEventId: id },
        select: { id: true },
      });
      if (pregnancies.length > 0) {
        const calvings = await this.prisma.calvingEvent.findMany({
          where: { pregnancyId: { in: pregnancies.map((p) => p.id) } },
          select: { id: true },
        });
        if (calvings.length > 0) {
          const calfBirths = await this.prisma.calfBirth.findMany({
            where: {
              calvingEventId: { in: calvings.map((c) => c.id) },
              calfId: { not: null },
            },
            select: { calfId: true },
          });
          const calfIds = calfBirths
            .map((b) => b.calfId)
            .filter((cid): cid is string => cid !== null);
          if (calfIds.length > 0) {
            await this.prisma.cattle.updateMany({
              where: { id: { in: calfIds } },
              data: { fatherId: dto.bullId },
            });
          }
        }
      }
    }

    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(
      farmId,
      userId,
      'Breeding Event',
      existing,
      dto,
      newCattleId,
    );
    this.log.info('Breeding event edited', { breedingEventId: id, farmId });
    return updated;
  }

  // ---- Pregnancy diagnosis -------------------------------------------------

  async editPregnancyDiagnosis(
    farmId: string,
    userId: string,
    id: string,
    dto: EditPregnancyDiagnosisDto,
  ) {
    const existing = await this.prisma.pregnancyDiagnosis.findFirst({
      where: { id, cattle: { farmId } },
    });
    if (!existing) throw new NotFoundException('Pregnancy diagnosis not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
    if (dto.breedingEventId) {
      await this.getBreedingEventForCattle(dto.breedingEventId, newCattleId);
    }

    const newExpectedCalvingDate = dto.expectedCalvingDate
      ? new Date(dto.expectedCalvingDate)
      : undefined;

    const updated = await this.prisma.pregnancyDiagnosis.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        breedingEventId: dto.breedingEventId,
        diagnosisDate: dto.diagnosisDate
          ? new Date(dto.diagnosisDate)
          : undefined,
        result: dto.result,
        diagnosisMethod: dto.diagnosisMethod,
        gestationDay: dto.gestationDay,
        expectedCalvingDate: newExpectedCalvingDate,
        notes: dto.notes,
      },
    });

    const linkedPregnancy = await this.prisma.pregnancy.findFirst({
      where: { sourceDiagnosisId: id },
    });

    // §3.2 row 4: PREGNANT → NOT_PREGNANT — retire the Pregnancy it created,
    // reverse the AQR +5 it earned.
    if (
      existing.result === PregnancyDiagnosisResult.PREGNANT &&
      dto.result === PregnancyDiagnosisResult.NOT_PREGNANT &&
      linkedPregnancy &&
      linkedPregnancy.status !== PregnancyStatus.FAILED
    ) {
      await this.prisma.pregnancy.update({
        where: { id: linkedPregnancy.id },
        data: { status: PregnancyStatus.FAILED },
      });

      const confirmLog = await this.prisma.activityLog.findFirst({
        where: {
          farmId,
          relatedCattleId: existing.cattleId,
          eventTitle: 'Pregnancy Confirmed',
          aqrImpact: { not: null },
        },
        orderBy: { timestamp: 'desc' },
      });
      if (confirmLog) {
        await this.aqrService.reverseEvent(
          farmId,
          existing.cattleId,
          confirmLog.id,
          {
            actorId: userId,
            actionDetails: 'Pregnancy diagnosis edited to NOT_PREGNANT.',
          },
        );
      }
    }

    // Opposite direction (edit corrects a diagnosis to PREGNANT with no
    // Pregnancy on record yet) — mirrors createPregnancyDiagnosis's PREGNANT
    // branch so the edit is symmetric, not just a one-way retirement.
    if (
      dto.result === PregnancyDiagnosisResult.PREGNANT &&
      existing.result !== PregnancyDiagnosisResult.PREGNANT &&
      !linkedPregnancy
    ) {
      const breedingEvent = updated.breedingEventId
        ? await this.prisma.breedingEvent.findUnique({
            where: { id: updated.breedingEventId },
          })
        : null;
      const conceptionDate =
        breedingEvent?.breedingDate ?? updated.diagnosisDate;
      // RAKHAL-317: same two-date split as createPregnancyDiagnosis's
      // PREGNANT branch — calculatedCalvingDate is the system estimate, kept
      // forever regardless of any farmer override.
      const calculatedCalvingDate = this.addDays(conceptionDate, 280);
      const expectedCalvingDate =
        newExpectedCalvingDate ?? calculatedCalvingDate;

      const newPregnancy = await this.prisma.pregnancy.create({
        data: {
          cattleId: newCattleId,
          breedingEventId: updated.breedingEventId,
          conceptionDate,
          calculatedCalvingDate,
          expectedCalvingDate,
          expectedCalvingDateSource: newExpectedCalvingDate
            ? ExpectedCalvingDateSource.MANUAL
            : ExpectedCalvingDateSource.SYSTEM,
          gestationDays: updated.gestationDay,
          status: PregnancyStatus.ACTIVE,
          sourceDiagnosisId: id,
        },
      });

      await this.aqrService.applyEvent(
        farmId,
        newCattleId,
        'pregnancy_confirmed',
        {
          actorId: userId,
          actionDetails: 'Pregnancy diagnosis edited to PREGNANT.',
        },
      );

      if (newPregnancy.expectedCalvingDate) {
        const dryPeriodDays =
          await this.farmSettings.reproDryPeriodTargetDays(farmId);
        const { recommendedDryOffAt } = computeDryOffProjection({
          isPregnant: true,
          expectedCalvingDate: newPregnancy.expectedCalvingDate,
          dryPeriodDays,
        });
        await this.prisma.lactation.updateMany({
          where: { cattleId: newCattleId, status: LactationStatus.ACTIVE },
          data: { recommendedDryOffAt },
        });
      }
    }

    // §3.2 row 5: expectedCalvingDate change on a still-active pregnancy.
    // RAKHAL-317: this is always a farmer override — flips the source to
    // MANUAL; calculatedCalvingDate is never touched by an edit handler.
    if (
      newExpectedCalvingDate &&
      linkedPregnancy &&
      linkedPregnancy.status === PregnancyStatus.ACTIVE
    ) {
      await this.prisma.pregnancy.update({
        where: { id: linkedPregnancy.id },
        data: {
          expectedCalvingDate: newExpectedCalvingDate,
          expectedCalvingDateSource: ExpectedCalvingDateSource.MANUAL,
        },
      });
    }

    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(
      farmId,
      userId,
      'Pregnancy Diagnosis',
      existing,
      dto,
      newCattleId,
    );
    this.log.info('Pregnancy diagnosis edited', {
      pregnancyDiagnosisId: id,
      farmId,
    });
    return updated;
  }

  // ---- Abortion ------------------------------------------------------------

  async editAbortionEvent(
    farmId: string,
    userId: string,
    id: string,
    dto: EditAbortionEventDto,
  ) {
    const existing = await this.prisma.abortionEvent.findFirst({
      where: { id, cattle: { farmId } },
    });
    if (!existing) throw new NotFoundException('Abortion event not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
    if (dto.pregnancyId) {
      const pregnancy = await this.prisma.pregnancy.findFirst({
        where: { id: dto.pregnancyId, cattleId: newCattleId },
      });
      if (!pregnancy) {
        throw new BadRequestException(
          'Pregnancy must belong to the same cattle',
        );
      }
    }

    const updated = await this.prisma.abortionEvent.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        pregnancyId: dto.pregnancyId,
        abortionDate: dto.abortionDate ? new Date(dto.abortionDate) : undefined,
        gestationDay: dto.gestationDay,
        suspectedCause: dto.suspectedCause,
        notes: dto.notes,
      },
    });

    // A pregnancyId change is entirely handled by refreshDerivedState — it
    // re-derives Pregnancy.status for every pregnancy owned by this cow from
    // live AbortionEvent rows (both the un-linked old pregnancy and the
    // newly-linked one), no manual flip needed.
    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(
      farmId,
      userId,
      'Abortion Event',
      existing,
      dto,
      newCattleId,
    );
    this.log.info('Abortion event edited', { abortionEventId: id, farmId });
    return updated;
  }

  // ---- Dry-off ---------------------------------------------------------

  async editDryOff(
    farmId: string,
    userId: string,
    id: string,
    dto: EditDryOffDto,
  ) {
    const existing = await this.prisma.dryPeriod.findFirst({
      where: { id, cattle: { farmId } },
    });
    if (!existing) throw new NotFoundException('Dry period not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);

    const newStartDate = dto.dryOffDate ? new Date(dto.dryOffDate) : undefined;
    let newExpectedEndDate: Date | undefined;
    if (newStartDate) {
      const targetDays =
        await this.farmSettings.reproDryPeriodTargetDays(farmId);
      newExpectedEndDate = this.addDays(newStartDate, targetDays);
    }

    const updated = await this.prisma.dryPeriod.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        startDate: newStartDate,
        expectedEndDate: newExpectedEndDate,
        notes: dto.notes,
        reason: dto.reason,
      },
    });

    // §3.2 row 8: dryOffDate change moves Lactation.endDate together —
    // matched by the old startDate since there is no back-link column.
    if (newStartDate) {
      const linkedLactation = await this.prisma.lactation.findFirst({
        where: {
          cattleId: existing.cattleId,
          endReason: LactationEndReason.DRY_OFF,
          endDate: existing.startDate,
        },
        orderBy: { endDate: 'desc' },
      });
      if (linkedLactation) {
        await this.prisma.lactation.update({
          where: { id: linkedLactation.id },
          data: { endDate: newStartDate },
        });
      }
    }

    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(
      farmId,
      userId,
      'Dry-Off',
      existing,
      dto,
      newCattleId,
    );
    this.log.info('Dry-off edited', { dryPeriodId: id, farmId });
    return updated;
  }

  // ---- Helpers -------------------------------------------------------------

  private async assertCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
    });
    if (!cattle)
      throw new BadRequestException('Cattle must belong to this farm');
    return cattle;
  }

  private async assertFemaleCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.assertCattleInFarm(farmId, cattleId);
    if (cattle.gender !== CattleGender.FEMALE) {
      throw new BadRequestException(
        'Reproduction records can only be edited onto female cattle',
      );
    }
    return cattle;
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

  /** Every edit ends here: recompute derived state for the old cow, and the
   * new one too when `cattleId` itself changed (§3.2 row 9). */
  private async refreshBoth(
    farmId: string,
    oldCattleId: string,
    newCattleId: string,
  ) {
    await this.derivation.refreshDerivedState(farmId, oldCattleId);
    if (newCattleId !== oldCattleId) {
      await this.derivation.refreshDerivedState(farmId, newCattleId);
    }
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async recordEdit(
    farmId: string,
    userId: string,
    eventType: string,
    existing: object,
    dto: object,
    cattleId: string,
  ) {
    const changes = this.buildChanges(existing, dto);
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.BREEDING,
      eventTitle: `Edited: ${eventType}`,
      actionDetails:
        changes.length > 0
          ? `${eventType} edited — ${changes.map((c) => `${c.key}: ${c.value}`).join('; ')}`
          : `${eventType} edited (no field changes).`,
      actorId: userId,
      relatedCattleId: cattleId,
      taggedValues: changes,
    });
  }

  private buildChanges(existing: object, dto: object): ActivityTaggedValue[] {
    const existingRecord = existing as Record<string, unknown>;
    const changes: ActivityTaggedValue[] = [];
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      changes.push({
        key,
        value: `${this.stringify(existingRecord[key])} → ${this.stringify(value)}`,
      });
    }
    return changes;
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return value.toISOString();
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  }
}
