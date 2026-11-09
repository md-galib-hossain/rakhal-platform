import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { RedisClient } from 'src/core/redis/redis.module';
export declare class CacheService {
    private readonly redis;
    private readonly log;
    constructor(redis: RedisClient, logger: LoggerService);
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    delete(keys: string | string[]): Promise<void>;
    deleteByPrefix(prefix: string): Promise<void>;
    getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}
