import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FarmStatus } from '@prisma/client';
import { CacheService } from 'src/core/cache/cache.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { VerifiedFarmContext } from 'src/modules/tenant-access/domain/verified-farm-context.type';

@Injectable()
export class TenantAccessService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly cache: CacheService,
  ) {
    this.log = this.logger.setContext(TenantAccessService.name);
  }

  async resolveFarmContext(
    userId: string,
    farmId: string,
  ): Promise<VerifiedFarmContext> {
    return this.cache.getOrSet(
      `tenant:farm-context:${userId}:${farmId}`,
      300,
      async () => {
        const farm = await this.prisma.farm.findUnique({
          where: { id: farmId },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            deletedAt: true,
          },
        });

        if (!farm || farm.deletedAt) {
          throw new NotFoundException('Farm not found');
        }

        if (farm.status !== FarmStatus.ACTIVE) {
          throw new ForbiddenException('Farm is not accessible');
        }

        const membership = await this.prisma.farmMember.findUnique({
          where: {
            farmId_userId: {
              farmId,
              userId,
            },
          },
          select: {
            id: true,
            roleId: true,
            role: {
              select: {
                id: true,
                name: true,
                isSystemRole: true,
              },
            },
          },
        });

        if (!membership) {
          this.log.warn('Rejected farm access without membership', {
            userId,
            farmId,
          });
          throw new ForbiddenException('Farm access denied');
        }

        return {
          farmId: farm.id,
          farmName: farm.name,
          farmSlug: farm.slug,
          farmStatus: farm.status,
          membershipId: membership.id,
          roleId: membership.roleId,
          roleName: membership.role.name,
          isSystemRole: membership.role.isSystemRole,
        };
      },
    );
  }
}

