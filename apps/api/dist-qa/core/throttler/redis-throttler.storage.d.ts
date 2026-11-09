import type { ThrottlerStorage } from '@nestjs/throttler';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { RedisClient } from 'src/core/redis/redis.module';
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;
export declare class RedisThrottlerStorage implements ThrottlerStorage {
    private readonly redis;
    private readonly log;
    constructor(redis: RedisClient, logger: LoggerService);
    increment(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord>;
}
export {};
