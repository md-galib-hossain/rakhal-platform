import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';

@Injectable()
export class PermissionsVersionCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async get(userId: string): Promise<number | undefined> {
    try {
      const value = await this.redis.get(this.getKey(userId));

      if (value === null) {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async set(userId: string, permissionsVersion: number): Promise<void> {
    try {
      await this.redis.set(this.getKey(userId), String(permissionsVersion), {
        EX: 300,
      });
    } catch {
      return undefined;
    }
  }

  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(userId));
    } catch {
      return undefined;
    }
  }

  private getKey(userId: string): string {
    return `auth:permissions-version:${userId}`;
  }
}
