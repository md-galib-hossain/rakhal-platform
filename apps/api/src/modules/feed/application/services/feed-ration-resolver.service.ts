import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedConcentration } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { FeedPlanResolverService } from './feed-plan-resolver.service';

export type RationMatchLevel = 'INDIVIDUAL' | 'GROUP' | 'HERD';

export interface ResolvedRation {
  concentration: FeedConcentration;
  matchLevel: RationMatchLevel;
}

/**
 * "Which TMR ration is this cow on" — now a **shim over `FeedPlanResolverService`** (MILESTONE 27,
 * RAKHAL-456, ADR-027 D1). A cow's program is the feed plan applied to her (individual → group → herd);
 * this returns that plan's TMR recipe when the plan is exactly one `PREPARED` line pointing at a live
 * `FEED_MIXTURE` recipe — the shape "Apply TMR" creates and the RAKHAL-456 data migration produces from
 * the old `FeedConcentration.targetType`/`cattleId` targeting. A multi-line plan or a plan with no TMR
 * resolves to `null` here (its supply is compared through `GET /feed/plans/:id/fit` instead); callers
 * (the DMI tab, `resolved-ration`) move onto the plan resolver in RAKHAL-458.
 *
 * Behaviour change vs the old resolver: creating a TMR with a target no longer makes it live — only
 * applying it does.
 */
@Injectable()
export class FeedRationResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: FeedPlanResolverService,
  ) {}

  async resolveActiveRation(
    farmId: string,
    cattleId: string,
  ): Promise<ResolvedRation | null> {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');

    const program = (await this.plans.resolveForCattle(farmId, [cattleId])).get(
      cattleId,
    );
    if (!program) return null;
    const only =
      program.lines.length === 1 && program.lines[0].lineType === 'PREPARED'
        ? program.lines[0]
        : null;
    if (!only?.concentrationId) return null;

    const concentration = await this.prisma.feedConcentration.findFirst({
      where: {
        id: only.concentrationId,
        farmId,
        deletedAt: null,
        kind: 'FEED_MIXTURE',
      },
    });
    return concentration ? { concentration, matchLevel: program.via } : null;
  }
}
