import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { EventRegistry } from '../../domain/event-registry';
import {
  AnimalFacts,
  CATEGORY_RULES,
  CategoryContext,
  CattleCategory,
  categoriesOf,
} from '../../domain/eligibility/categories';
import { evaluateEligibility } from '../../domain/eligibility/evaluate';
import { EVENT_REGISTRY } from './animal-event-types.service';

/**
 * RAKHAL-480: category filter + per-animal event eligibility, both driven by
 * the single `CATEGORY_RULES` table.
 */
@Injectable()
export class EligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FarmSettingsService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  async context(
    farmId: string,
    opts: { withFattening?: boolean; now?: Date } = {},
  ): Promise<CategoryContext> {
    const s = await this.settings.getEffective(farmId);
    return {
      now: opts.now ?? new Date(),
      weaningDays: s.cattleLifecycleWeaningDays,
      breedingAgeDays: s.cattleLifecycleBreedingAgeDays,
      freshDays: s.lactationFreshDays,
      fatteningCattleIds: opts.withFattening
        ? await this.fatteningCattleIds(farmId)
        : undefined,
    };
  }

  /** Prisma `where` for `GET /cattle?category=` (herd scope is added by the caller). */
  async categoryWhere(
    farmId: string,
    category: CattleCategory,
  ): Promise<Prisma.CattleWhereInput> {
    const ctx = await this.context(farmId, {
      withFattening: category === 'FATTENING',
    });
    return CATEGORY_RULES[category].where(ctx);
  }

  /** Latest ENTER_FATTENING not followed by a LEAVE_FATTENING. */
  async fatteningCattleIds(farmId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ cattleId: string }[]>(Prisma.sql`
      SELECT DISTINCT e."cattleId" FROM "AnimalEvent" e
       WHERE e."farmId" = ${farmId} AND e.type = 'ENTER_FATTENING' AND e.status = 'ACTIVE'
         AND NOT EXISTS (
           SELECT 1 FROM "AnimalEvent" l
            WHERE l."cattleId" = e."cattleId" AND l.type = 'LEAVE_FATTENING' AND l.status = 'ACTIVE'
              AND (l."eventAt" > e."eventAt" OR (l."eventAt" = e."eventAt" AND l."createdAt" >= e."createdAt")))`);
    return rows.map((r) => r.cattleId);
  }

  /** Facts + context for one animal (shared by `eligible` and the write API). */
  async loadFacts(farmId: string, cattleId: string, now?: Date) {
    const row = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: {
        id: true,
        gender: true,
        dateOfBirth: true,
        productionStatus: true,
        herdStatus: true,
        reproductionProfile: {
          select: { totalCalvings: true, reproductiveStatus: true },
        },
        lactations: {
          where: { status: 'ACTIVE' },
          select: { startDate: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!row) throw new NotFoundException('Animal not found');

    const ctx = await this.context(farmId, { now });
    const fattening = await this.fatteningCattleIds(farmId);
    const facts: AnimalFacts = {
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      totalCalvings: row.reproductionProfile?.totalCalvings ?? 0,
      productionStatus: row.productionStatus,
      reproductiveStatus: row.reproductionProfile?.reproductiveStatus ?? null,
      activeLactationStart: row.lactations[0]?.startDate ?? null,
      inFattening: fattening.includes(row.id),
    };
    return { facts, ctx, leftHerd: row.herdStatus !== 'ACTIVE' };
  }

  /** Which event types this animal can take now, with findings. */
  async eligible(farmId: string, cattleId: string, date?: Date) {
    const { facts, ctx, leftHerd } = await this.loadFacts(farmId, cattleId);
    return {
      categories: categoriesOf(facts, ctx),
      types: this.registry
        .all()
        .map((def) => evaluateEligibility(def, { facts, ctx, date, leftHerd })),
    };
  }
}
