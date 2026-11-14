import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { RequirementSettingsService } from './requirement-settings.service';
import { computeLookahead, type LookaheadEvent } from '../../domain/lookahead';

/**
 * Batched look-ahead for the Feeding Grid (MILESTONE 27, RAKHAL-459a): which cows hit dry-off, calving or an
 * assumed peak within the farm's `lookaheadDays`. Three queries for any herd size (settings + two reads), no
 * per-cow reads. `cattleIds` must already be farm-scoped by the caller (the grid resolves them from the farm's
 * active herd).
 */
@Injectable()
export class FeedLookaheadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requirementSettings: RequirementSettingsService,
  ) {}

  async forCattle(
    farmId: string,
    cattleIds: string[],
    now: Date,
  ): Promise<Map<string, LookaheadEvent[]>> {
    const out = new Map<string, LookaheadEvent[]>();
    if (cattleIds.length === 0) return out;

    const [settings, pregnancies, lactations] = await Promise.all([
      this.requirementSettings.resolve(farmId),
      this.prisma.pregnancy.findMany({
        where: { cattleId: { in: cattleIds }, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { cattleId: true, expectedCalvingDate: true },
      }),
      this.prisma.lactation.findMany({
        where: { cattleId: { in: cattleIds }, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        select: {
          cattleId: true,
          startDate: true,
          plannedDryOffAt: true,
          recommendedDryOffAt: true,
          peakDaysInMilk: true,
        },
      }),
    ]);

    // Newest row per cow wins (both lists are ordered newest first).
    const pregnancyByCow = new Map<string, Date | null>();
    for (const p of pregnancies) {
      if (!pregnancyByCow.has(p.cattleId)) {
        pregnancyByCow.set(p.cattleId, p.expectedCalvingDate);
      }
    }
    const lactationByCow = new Map<string, (typeof lactations)[number]>();
    for (const l of lactations) {
      if (!lactationByCow.has(l.cattleId)) lactationByCow.set(l.cattleId, l);
    }

    for (const id of cattleIds) {
      const lactation = lactationByCow.get(id);
      const events = computeLookahead({
        now,
        windowDays: settings.lookaheadDays,
        expectedCalvingDate: pregnancyByCow.get(id),
        dryOffDate:
          lactation?.plannedDryOffAt ?? lactation?.recommendedDryOffAt,
        lactationStart: lactation?.startDate,
        peakDaysInMilk: lactation?.peakDaysInMilk,
      });
      if (events.length > 0) out.set(id, events);
    }
    return out;
  }
}
