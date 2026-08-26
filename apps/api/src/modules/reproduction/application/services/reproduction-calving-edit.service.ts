import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CalfBirthStatus,
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  HerdStatus,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import {
  ActivityLogService,
  ActivityTaggedValue,
} from 'src/modules/activity/application/services/activity-log.service';
import { CalfService } from 'src/modules/calf/application/services/calf.service';
import { ReproductionDerivationService } from './reproduction-derivation.service';
import { EditCalvingEventDto } from '../../presentation/dto/edit-calving-event.dto';

/**
 * RAKHAL-306: `PATCH /reproduction/calving-events/:id`. The largest
 * blast-radius edit — mirrors `ReproductionEditService`'s shape (own file,
 * `reproduction.service.ts` stays create/read-only) but kept separate since
 * calving's own cascade (calf list, colostrum task, care-reminder schedule)
 * doesn't overlap the other five event types' concerns.
 */
@Injectable()
export class ReproductionCalvingEditService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly derivation: ReproductionDerivationService,
    private readonly calfService: CalfService,
    private readonly aqrService: AqrService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReproductionCalvingEditService.name);
  }

  async editCalvingEvent(
    farmId: string,
    userId: string,
    id: string,
    dto: EditCalvingEventDto,
  ) {
    const existing = await this.prisma.calvingEvent.findFirst({
      where: { id, cattle: { farmId } },
      include: { calfBirths: true },
    });
    if (!existing) throw new NotFoundException('Calving event not found');

    const newCattleId = dto.cattleId ?? existing.cattleId;
    if (dto.cattleId) await this.assertFemaleCattleInFarm(farmId, dto.cattleId);

    const newCalvingDate = dto.calvingDate
      ? new Date(dto.calvingDate)
      : undefined;
    const dateChanged =
      !!newCalvingDate &&
      newCalvingDate.getTime() !== existing.calvingDate.getTime();

    const pregnancy = existing.pregnancyId
      ? await this.prisma.pregnancy.findUnique({
          where: { id: existing.pregnancyId },
        })
      : null;

    await this.prisma.calvingEvent.update({
      where: { id },
      data: {
        cattleId: dto.cattleId,
        calvingDate: newCalvingDate,
        calvingEase: dto.calvingEase,
        placentaExpelled: dto.placentaExpelled,
        retainedPlacenta: dto.retainedPlacenta,
        complications: dto.complications,
        notes: dto.notes,
      },
    });

    // §3.2: calvingDate cascade — Lactation.startDate, each calf's
    // dateOfBirth, Pregnancy.gestationDays, colostrum + calf-care tasks.
    if (dateChanged && newCalvingDate) {
      await this.prisma.lactation.updateMany({
        where: { calvingEventId: id },
        data: { startDate: newCalvingDate },
      });

      const calfIds = existing.calfBirths
        .map((b) => b.calfId)
        .filter((cid): cid is string => cid !== null);
      if (calfIds.length > 0) {
        await this.prisma.cattle.updateMany({
          where: { id: { in: calfIds } },
          data: { dateOfBirth: newCalvingDate },
        });
      }

      if (pregnancy) {
        await this.prisma.pregnancy.update({
          where: { id: pregnancy.id },
          data: {
            actualCalvingDate: newCalvingDate,
            gestationDays: this.daysBetween(
              pregnancy.conceptionDate,
              newCalvingDate,
            ),
          },
        });
      }

      // Colostrum task + every calf-care schedule item share this event's
      // sourceEventId — shift each by the same delta rather than collapsing
      // them onto one newDueAt (rescheduleBySourceEvent's shape), which would
      // destroy the age-based offsets between them.
      const deltaMs = newCalvingDate.getTime() - existing.calvingDate.getTime();
      const tasks = await this.prisma.task.findMany({
        where: {
          farmId,
          sourceEventType: 'CALVING_EVENT',
          sourceEventId: id,
          status: { not: TaskStatus.COMPLETED },
        },
        select: { id: true, dueAt: true },
      });
      await Promise.all(
        tasks.map((t) =>
          this.prisma.task.update({
            where: { id: t.id },
            data: { dueAt: new Date(t.dueAt.getTime() + deltaMs) },
          }),
        ),
      );
    }

    // §3.2: calves[] add — same shape as createCalvingEvent's own loop.
    const addedCalfIds: string[] = [];
    const effectiveCalvingDate = newCalvingDate ?? existing.calvingDate;
    const bull = pregnancy?.breedingEventId
      ? await this.prisma.breedingEvent.findUnique({
          where: { id: pregnancy.breedingEventId },
          select: { bullId: true },
        })
      : null;

    for (const calf of dto.addCalves ?? []) {
      let calfId: string | undefined;
      if (calf.status === CalfBirthStatus.ALIVE) {
        if (!calf.tagNumber) {
          throw new BadRequestException(
            'Alive calves must include tagNumber for cattle registration',
          );
        }
        const createdCalf = await this.prisma.cattle.create({
          data: {
            farmId,
            name: calf.name,
            tagNumber: calf.tagNumber,
            gender: calf.gender,
            dateOfBirth: effectiveCalvingDate,
            purpose: CattlePurpose.CALF,
            herdStatus: HerdStatus.ACTIVE,
            motherId: newCattleId,
            fatherId: bull?.bullId ?? undefined,
            sourceType: CattleSourceType.BORN,
            createdBy: userId,
          },
        });
        calfId = createdCalf.id;
        addedCalfIds.push(calfId);
      }
      await this.prisma.calfBirth.create({
        data: {
          calvingEventId: id,
          calfId,
          gender: calf.gender,
          birthWeight: calf.birthWeight,
          status: calf.status,
        },
      });
    }
    for (const calfId of addedCalfIds) {
      const calf = await this.prisma.cattle.findUniqueOrThrow({
        where: { id: calfId },
      });
      await this.aqrService.applyEvent(farmId, calfId, 'animal_registered', {
        actorId: userId,
        actionDetails: `Calf [${calf.tagNumber}] added to calving record.`,
      });
      await this.calfService.scheduleCareReminders({
        farmId,
        createdBy: userId,
        calfId,
        birthDate: effectiveCalvingDate,
        gender: calf.gender,
        sourceEventId: id,
      });
    }

    // §3.2: calves[] remove — archive, never delete; 409 if she has her own
    // records; reverse her registration AQR +50.
    for (const calfBirthId of dto.removeCalfBirthIds ?? []) {
      const birth = existing.calfBirths.find((b) => b.id === calfBirthId);
      if (!birth) {
        throw new BadRequestException(
          `CalfBirth ${calfBirthId} does not belong to this calving event`,
        );
      }
      if (birth.calfId) {
        const calf = await this.assertCalfHasNoOwnRecords(birth.calfId);
        // RAKHAL-397: removing a mis-recorded calf is a data-entry correction,
        // not a herd exit — soft delete only, herdStatus untouched.
        await this.prisma.cattle.update({
          where: { id: birth.calfId },
          data: { deletedAt: new Date() },
        });

        const registerLog = await this.prisma.activityLog.findFirst({
          where: {
            farmId,
            relatedCattleId: birth.calfId,
            eventTitle: 'Animal Registered',
            aqrImpact: { not: null },
          },
          orderBy: { timestamp: 'desc' },
        });
        if (registerLog) {
          await this.aqrService.reverseEvent(
            farmId,
            birth.calfId,
            registerLog.id,
            {
              actorId: userId,
              actionDetails: `Calf [${calf.tagNumber}] removed from calving record.`,
            },
          );
        }
      }
      await this.prisma.calfBirth.delete({ where: { id: calfBirthId } });
    }

    // calfCount must stay consistent with the resulting CalfBirth rows.
    const finalCount = await this.prisma.calfBirth.count({
      where: { calvingEventId: id },
    });
    await this.prisma.calvingEvent.update({
      where: { id },
      data: { calfCount: finalCount },
    });

    await this.refreshBoth(farmId, existing.cattleId, newCattleId);
    await this.recordEdit(farmId, userId, existing, dto, newCattleId);

    this.log.info('Calving event edited', { calvingEventId: id, farmId });

    return this.prisma.calvingEvent.findUniqueOrThrow({
      where: { id },
      include: { calfBirths: { include: { calf: true } }, lactations: true },
    });
  }

  // ---- Helpers -------------------------------------------------------------

  private async assertFemaleCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
    });
    if (!cattle)
      throw new BadRequestException('Cattle must belong to this farm');
    if (cattle.gender !== CattleGender.FEMALE) {
      throw new BadRequestException(
        'Reproduction records can only be edited onto female cattle',
      );
    }
    return cattle;
  }

  /**
   * 409s naming her tag number if she has accumulated her own records
   * (weights, BCS, health cases, milk log entries, or offspring) — removing
   * the CalfBirth row would otherwise orphan real farm data behind an
   * archived Cattle row with no trace of why.
   */
  private async assertCalfHasNoOwnRecords(calfId: string) {
    const calf = await this.prisma.cattle.findUniqueOrThrow({
      where: { id: calfId },
    });
    const [weights, bcs, health, milk, offspring] = await Promise.all([
      this.prisma.weightRecord.count({ where: { cattleId: calfId } }),
      this.prisma.bodyConditionScore.count({ where: { cattleId: calfId } }),
      this.prisma.healthCase.count({ where: { cattleId: calfId } }),
      this.prisma.milkLogEntry.count({ where: { cattleId: calfId } }),
      this.prisma.cattle.count({
        where: { OR: [{ motherId: calfId }, { fatherId: calfId }] },
      }),
    ]);
    if (weights + bcs + health + milk + offspring > 0) {
      throw new ConflictException(
        `Cannot remove calf [${calf.tagNumber}] from this calving record — she has her own records (weights/BCS/health/milk/offspring). Archive her directly from Cattle instead.`,
      );
    }
    return calf;
  }

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

  private daysBetween(start: Date, end: Date) {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private async recordEdit(
    farmId: string,
    userId: string,
    existing: object,
    dto: object,
    cattleId: string,
  ) {
    const changes = this.buildChanges(existing, dto);
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.BREEDING,
      eventTitle: 'Edited: Calving Event',
      actionDetails:
        changes.length > 0
          ? `Calving Event edited — ${changes.map((c) => `${c.key}: ${c.value}`).join('; ')}`
          : 'Calving Event edited (no field changes).',
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
