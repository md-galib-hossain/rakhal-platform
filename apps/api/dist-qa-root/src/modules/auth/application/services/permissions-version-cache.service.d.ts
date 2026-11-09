import type { RedisClient } from 'src/core/redis/redis.module';
export declare class PermissionsVersionCacheService {
    private readonly redis;
    constructor(redis: RedisClient);
    get(userId: string): Promise<number | undefined>;
    set(userId: string, permissionsVersion: number): Promise<void>;
    invalidate(userId: string): Promise<void>;
    private getKey;
}
