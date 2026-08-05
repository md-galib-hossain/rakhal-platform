import { Injectable, NotFoundException } from '@nestjs/common';
import { AnimalHold, AnimalHoldType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateAnimalHoldDto } from '../../presentation/dto/create-animal-hold.dto';
import { ListAnimalHoldQueryDto } from '../../presentation/dto/list-animal-hold-query.dto';
import { ReleaseAnimalHoldDto } from '../../presentation/dto/release-animal-hold.dto';

const HOLD_TYPE_LABEL: Record<AnimalHoldType, string> = {
  REPRODUCTIVE: 'Reproductive',
  MILK_DISCARD: 'Milk discard',
  QUARANTINE: 'Quarantine',
  OTHER: 'Other',
};

/**
 * Generic per-animal "hold" mechanism (RAKHAL-280, v2 prerequisite).
 *
 * This is the ONE mechanism meant to back both the future `REPRODUCTIVE_HOLD`
 * reproduction alert (RAKHAL-272, type `REPRODUCTIVE`) and the future
 * `DISCARD_REQUIRED` milk-eligibility reason (RAKHAL-278, type
 * `MILK_DISCARD`) — no ad-hoc booleans elsewhere. Neither consumer is wired up
 * yet; this service only exposes create/release/query.
 *
 * Farm-scoped: every read/write is scoped through the owning `Cattle` row's
 * `farmId` (the `AnimalHold` table itself has no Prisma relation to `Cattle`/
 * `Farm` — plain scalar FKs, same "isolated migration" precedent as
 * `MediaAsset`, see `animal-hold.prisma`).
 *
 * Audited via {@link ActivityLogService} (not `AuditService`) — `AuditService`'s
 * `AuditAction` enum is a closed set of auth/billing/admin-account events
 * (`prisma/schemas/audit/audit-enums.prisma`, a hot shared file this ticket's
 * Lane explicitly excludes editing) with no generic farm-domain-event member.
 * `ActivityLogService` is the cross-cutting engine other farm-domain modules
 * (milk submit, finance transactions, the AQR engine) already use for exactly
 * this kind of free-text, per-farm operational event and requires no schema
 * change to adopt.
 */
@Injectable()
export class AnimalHoldService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AnimalHoldService.name);
  }

  async createHold(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: CreateAnimalHoldDto,
  ): Promise<AnimalHold> {
    const cattle = await this.assertCattleInFarm(farmId, cattleId);

    const hold = await this.prisma.animalHold.create({
      data: {
        farmId,
        cattleId,
        type: dto.type,
        reason: dto.reason,
        createdBy: userId,
      },
    });

    this.log.info('Animal hold created', {
      farmId,
      cattleId,
      holdId: hold.id,
      type: hold.type,
    });

    await this.activityLog.record({
      farmId,
      module: 'COW_MANAGEMENT',
      eventTitle: `${HOLD_TYPE_LABEL[hold.type]} hold placed`,
      actionDetails: `${cattle.tagNumber}: ${dto.reason}`,
      actorId: userId,
      relatedCattleId: cattleId,
      taggedValues: [
        { key: 'holdId', value: hold.id },
        { key: 'type', value: hold.type },
      ],
    });

    return hold;
  }

  async releaseHold(
    farmId: string,
    cattleId: string,
    holdId: string,
    releasedBy: string,
    dto?: ReleaseAnimalHoldDto,
  ): Promise<AnimalHold> {
    const cattle = await this.assertCattleInFarm(farmId, cattleId);
    const existing = await this.prisma.animalHold.findFirst({
      where: { id: holdId, farmId, cattleId },
    });
    if (!existing) {
      throw new NotFoundException('Animal hold not found');
    }
    if (existing.endedAt) {
      // Already released — idempotent, return as-is rather than error.
      return existing;
    }

    const hold = await this.prisma.animalHold.update({
      where: { id: holdId },
      data: {
        endedAt: new Date(),
        releasedBy,
      },
    });

    this.log.info('Animal hold released', {
      farmId,
      cattleId,
      holdId: hold.id,
      type: hold.type,
    });

    await this.activityLog.record({
      farmId,
      module: 'COW_MANAGEMENT',
      eventTitle: `${HOLD_TYPE_LABEL[hold.type]} hold released`,
      actionDetails: dto?.note
        ? `${cattle.tagNumber}: ${dto.note}`
        : `${cattle.tagNumber}`,
      actorId: releasedBy,
      relatedCattleId: cattleId,
      taggedValues: [
        { key: 'holdId', value: hold.id },
        { key: 'type', value: hold.type },
      ],
    });

    return hold;
  }

  /**
   * Clean query helper for other services (reproduction/milk, later tickets)
   * to check whether an animal currently has an active hold of a given type
   * (or any type, if omitted). Not wired into any consumer yet.
   */
  async activeHoldsForCattle(
    farmId: string,
    cattleId: string,
    type?: AnimalHoldType,
  ): Promise<AnimalHold[]> {
    return this.prisma.animalHold.findMany({
      where: {
        farmId,
        cattleId,
        endedAt: null,
        ...(type ? { type } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async list(
    farmId: string,
    cattleId: string,
    query: ListAnimalHoldQueryDto,
  ): Promise<CursorPage<AnimalHold>> {
    await this.assertCattleInFarm(farmId, cattleId);

    const where: Prisma.AnimalHoldWhereInput = {
      farmId,
      cattleId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.includeReleased ? {} : { endedAt: null }),
    };

    const rows = await this.prisma.animalHold.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    return toCursorPage(rows, query);
  }

  private async assertCattleInFarm(farmId: string, cattleId: string) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true, tagNumber: true },
    });
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }
    return cattle;
  }
}
