import type { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import type { RedisClient } from 'src/core/redis/redis.module';
import type { Request, Response } from 'express';
export declare function tokensMatch(provided: string, expected: string): boolean;
export declare class HealthController {
    private readonly prisma;
    private readonly metrics;
    private readonly redis;
    private readonly appCfg;
    private probeCache?;
    constructor(prisma: PrismaService, metrics: MetricsService, redis: RedisClient, appCfg: ConfigType<typeof appConfig>);
    metricsEndpoint(req: Request, res: Response): Promise<void>;
    health(): Promise<{
        success: boolean;
        status: string;
        endpoint: "ready" | "health";
        service: string;
        timestamp: string;
        dependencies: {
            database: string;
            redis: string;
        };
    }>;
    ready(): Promise<{
        success: boolean;
        status: string;
        endpoint: "ready" | "health";
        service: string;
        timestamp: string;
        dependencies: {
            database: string;
            redis: string;
        };
    }>;
    live(): {
        success: boolean;
        status: string;
        endpoint: string;
        service: string;
        timestamp: string;
    };
    private buildHealth;
    private probeDependencies;
    private checkDb;
    private checkRedis;
}
