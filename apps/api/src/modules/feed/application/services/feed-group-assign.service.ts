import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';

/**
 * Feed group ↔ cattle assignment (PRD §12.2, RAKHAL-083). The `FeedGroup` model
 * + its CRUD live in the Settings module (`/settings/feed-groups`); this service
 * only adds the feed-specific membership ops, farm-scoped. Sets `Cattle.feedGroupId`.
 */
@Injectable()
export class FeedGroupAssignService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(FeedGroupAssignService.name);
  }

  /** Bulk-assign cattle to a feed group. Only cattle in this farm are affected. */
  async assignCattle(farmId: string, groupId: string, cattleIds: string[]) {
    await this.assertGroupInFarm(farmId, groupId);
    const { count } = await this.prisma.cattle.updateMany({
      where: {
        id: { in: cattleIds },
        ...activeHerd(farmId),
      },
      data: { feedGroupId: groupId },
    });
    this.log.info('Cattle assigned to feed group', {
      farmId,
      groupId,
      assigned: count,
    });
    return { assigned: count, failed: cattleIds.length - count };
  }

  /** List the cattle currently in a feed group. */
  async listCattle(farmId: string, groupId: string) {
    await this.assertGroupInFarm(farmId, groupId);
    return this.prisma.cattle.findMany({
      where: {
        ...activeHerd(farmId),
        feedGroupId: groupId,
      },
      orderBy: { tagNumber: 'asc' },
      select: { id: true, name: true, tagNumber: true, productionStatus: true },
    });
  }

  private async assertGroupInFarm(farmId: string, groupId: string) {
    const group = await this.prisma.feedGroup.findFirst({
      where: { id: groupId, farmId },
      select: { id: true, deletedAt: true },
    });
    if (!group) throw new NotFoundException('Feed group not found');
    if (group.deletedAt) {
      throw new BadRequestException('Feed group is archived');
    }
  }
}
