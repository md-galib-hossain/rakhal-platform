import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class BkashTokenService {
    private readonly redis;
    private readonly log;
    constructor(redis: RedisClient, logger: LoggerService);
    getToken(): Promise<string>;
}
