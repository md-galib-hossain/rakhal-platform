import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedConcentration, FeedTargetType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';

export type RationMatchLevel = 'INDIVIDUAL' | 'GROUP' | 'HERD';

export interface ResolvedRation {
  concentration: FeedConcentration;
  matchLevel: RationMatchLevel;
}

/**
 * Layered ration targeting (2026-08-13, user request — "herd default -> group -> individual
 * override, most specific wins"). `FeedConcentration.targetType` is GROUP|INDIVIDUAL|HERD;
 * a farm can have at most one active `FEED_MIXTURE` at each level (not enforced by a DB
 * constraint — first match by `createdAt desc` wins if a farm somehow has more than one,
 * same "most recent wins" fallback other feed-module reads already use elsewhere). Only
 * `FEED_MIXTURE` concentrations are real fed rations — a `CONCENTRATE_TEMPLATE` is never a
 * resolution candidate, it's a recipe building block, not something a cow is "on".
 */
@Injectable()
export class FeedRationResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActiveRation(
    farmId: string,
    cattleId: string,
  ): Promise<ResolvedRation | null> {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true, feedGroupId: true },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');

    const individual = await this.findActive(farmId, {
      targetType: 'INDIVIDUAL',
      cattleId,
    });
    if (individual)
      return { concentration: individual, matchLevel: 'INDIVIDUAL' };

    if (cattle.feedGroupId) {
      const group = await this.findActive(farmId, {
        targetType: 'GROUP',
        feedGroupId: cattle.feedGroupId,
      });
      if (group) return { concentration: group, matchLevel: 'GROUP' };
    }

    const herd = await this.findActive(farmId, { targetType: 'HERD' });
    if (herd) return { concentration: herd, matchLevel: 'HERD' };

    return null;
  }

  private async findActive(
    farmId: string,
    where: {
      targetType: FeedTargetType;
      cattleId?: string;
      feedGroupId?: string;
    },
  ): Promise<FeedConcentration | null> {
    return this.prisma.feedConcentration.findFirst({
      where: {
        farmId,
        deletedAt: null,
        kind: 'FEED_MIXTURE',
        ...where,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
