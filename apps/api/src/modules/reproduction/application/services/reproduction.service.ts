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
  LactationStatus,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  ReproductiveStatus,
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
import { CreateAbortionEventDto } from '../../presentation/dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../../presentation/dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../../presentation/dto/create-calving-event.dto';
import { CreateHeatEventDto } from '../../presentation/dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../../presentation/dto/create-pregnancy-diagnosis.dto';
import { ReproductionListQueryDto } from '../../presentation/dto/common.dto';

type CattleForAccess = {
  id: string;
  farmId: string;
  gender: CattleGender;
  tagNumber: string;
};

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

    await this.refreshProfile(dto.cattleId);

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
            reproductiveStatus: ReproductiveStatus.PREGNANT,
            lastPregnancyCheckDate: new Date(dto.diagnosisDate),
            currentPregnancyId: pregnancy.id,
          },
          update: {
            reproductiveStatus: ReproductiveStatus.PREGNANT,
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

    await this.refreshProfile(dto.cattleId);

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

      const lactation = await tx.lactation.create({
        data: {
          cattleId: dto.cattleId,
          lactationNumber: calvingNumber,
          calvingEventId: created.id,
          startDate: calvingDate,
          status: LactationStatus.ACTIVE,
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

      await tx.reproductionProfile.upsert({
        where: { cattleId: dto.cattleId },
        create: {
          cattleId: dto.cattleId,
          reproductiveStatus: ReproductiveStatus.LACTATING,
          currentLactationNumber: calvingNumber,
          firstCalvingDate: calvingDate,
          lastCalvingDate: calvingDate,
          currentLactationId: lactation.id,
          currentPregnancyId: null,
        },
        update: {
          reproductiveStatus: ReproductiveStatus.LACTATING,
          currentLactationNumber: calvingNumber,
          firstCalvingDate: calvingNumber === 1 ? calvingDate : undefined,
          lastCalvingDate: calvingDate,
          currentLactationId: lactation.id,
          currentPregnancyId: null,
        },
      });

      return tx.calvingEvent.findUnique({
        where: { id: created.id },
        include: { calfBirths: { include: { calf: true } }, lactations: true },
      });
    });

    await this.refreshProfile(dto.cattleId);

    // AQR: register each live-born calf (+50) just like CattleService does.
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

      await tx.reproductionProfile.upsert({
        where: { cattleId: dto.cattleId },
        create: {
          cattleId: dto.cattleId,
          reproductiveStatus: ReproductiveStatus.ABORTED,
          currentPregnancyId: null,
        },
        update: {
          reproductiveStatus: ReproductiveStatus.ABORTED,
          currentPregnancyId: null,
        },
      });

      return created;
    });

    await this.refreshProfile(dto.cattleId);
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
    await this.refreshProfile(cattleId);

    const [
      profile,
      breedings,
      pregnancies,
      calvings,
      abortions,
      currentPregnancy,
      currentLactation,
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
    ]);

    const successfulPregnancies = pregnancies.filter(
      (pregnancy) =>
        pregnancy.status === PregnancyStatus.ACTIVE ||
        pregnancy.status === PregnancyStatus.CALVED,
    ).length;

    return {
      cattle: {
        id: cattle.id,
        tagNumber: cattle.tagNumber,
      },
      status: profile?.reproductiveStatus ?? ReproductiveStatus.HEIFER,
      currentLactation: profile?.currentLactationNumber ?? 0,
      dim: currentLactation
        ? this.daysBetween(currentLactation.startDate, new Date())
        : null,
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

  private async refreshProfile(cattleId: string) {
    const [
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
      activeDryPeriod,
    ] = await Promise.all([
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
      this.prisma.dryPeriod.findFirst({
        where: { cattleId, actualEndDate: null },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    const status = activeDryPeriod
      ? ReproductiveStatus.DRY
      : currentPregnancy
        ? ReproductiveStatus.PREGNANT
        : currentLactation
          ? ReproductiveStatus.LACTATING
          : lastBreeding?.status === BreedingStatus.PENDING_CHECK
            ? ReproductiveStatus.BRED
            : ReproductiveStatus.OPEN;

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
