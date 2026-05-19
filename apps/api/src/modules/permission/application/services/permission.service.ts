import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';

@Injectable()
export class PermissionService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(PermissionService.name);
  }

  async resolvePermissions(
    userId: string,
    farmId: string,
    permissionsVersion: number,
  ): Promise<string[]> {
    const cacheKey = this.cacheKey(userId, farmId, permissionsVersion);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // cache is best-effort
    }

    const membership = await this.prisma.farmMember.findUnique({
      where: {
        farmId_userId: { farmId, userId },
      },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: {
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Permission denied');
    }

    const permissions = membership.role.permissions.map(
      (rolePermission) => rolePermission.permission.key,
    );

    try {
      await this.redis.set(cacheKey, JSON.stringify(permissions), {
        EX: 300,
      });
    } catch {
      // cache is best-effort
    }

    return permissions;
  }

  async hasPermission(
    userId: string,
    farmId: string,
    permissionsVersion: number,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const permissions = await this.resolvePermissions(
      userId,
      farmId,
      permissionsVersion,
    );

    return requiredPermissions.every((permission) =>
      permissions.includes(permission),
    );
  }

  async assertPermissions(
    userId: string,
    farmId: string,
    permissionsVersion: number,
    requiredPermissions: string[],
  ): Promise<void> {
    const allowed = await this.hasPermission(
      userId,
      farmId,
      permissionsVersion,
      requiredPermissions,
    );

    if (!allowed) {
      this.log.warn('Permission denied', {
        userId,
        farmId,
        requiredPermissions,
      });
      throw new ForbiddenException('Permission denied');
    }
  }

  async invalidateForFarm(userId: string, farmId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(
        `auth:permissions:${userId}:${farmId}:*`,
      );
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch {
      // best effort
    }
  }

  async invalidateForUser(userId: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`auth:permissions:${userId}:*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch {
      // best effort
    }
  }

  private cacheKey(
    userId: string,
    farmId: string,
    permissionsVersion: number,
  ): string {
    return `auth:permissions:${userId}:${farmId}:${permissionsVersion}`;
  }
}
