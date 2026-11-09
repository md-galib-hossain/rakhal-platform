import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { AnchorChecker } from 'src/modules/notification/application/resolvers/source-resolver.port';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';

/**
 * NV2-B05: fire-time existence check for manual BEFORE/AFTER schedules anchored on an animal event
 * (docs/EPIC_NOTIFICATIONS_V2.md §3.3 step 3). A voided or deleted event, or one from another farm, no longer exists.
 */
@Injectable()
export class AnimalEventAnchorChecker implements AnchorChecker, OnModuleInit {
  readonly anchorType = 'ANIMAL_EVENT' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SourceResolverRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.registerAnchorChecker(this);
  }

  async exists(farmId: string, anchorId: string): Promise<boolean> {
    const ev = await this.prisma.animalEvent.findFirst({
      where: { id: anchorId, farmId, status: { not: 'VOIDED' } },
      select: { id: true },
    });
    return ev !== null;
  }
}
