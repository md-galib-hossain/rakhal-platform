import type { Queue } from 'bullmq';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { RedisClient } from 'src/core/redis/redis.module';
import { AdminAuditService } from './admin-audit.service';
export type IntegrationStatus = 'ok' | 'degraded' | 'down' | 'not_configured' | 'info';
export interface IntegrationCheck {
    key: string;
    label: string;
    status: IntegrationStatus;
    detail: string;
    latencyMs?: number;
}
export declare function maskEmail(address: string): string;
export declare class AdminOpsService {
    private readonly prisma;
    private readonly audit;
    private readonly redis;
    private readonly queues;
    constructor(prisma: PrismaService, audit: AdminAuditService, redis: RedisClient, outbox: Queue, email: Queue, notificationOccurrence: Queue);
    listQueues(): Promise<{
        checkedAt: string;
        queues: {
            name: string;
            paused: boolean;
            counts: {
                [index: string]: number;
            };
        }[];
    }>;
    failedJobs(name: string, limit?: number): Promise<{
        queue: string;
        jobs: {
            id: string | null;
            name: string;
            attemptsMade: number;
            failedReason: string;
            failedAt: string | null;
            createdAt: string | null;
        }[];
    }>;
    retryJob(actorId: string, name: string, jobId: string, reason: string): Promise<{
        queue: string;
        jobId: string;
        retried: boolean;
    }>;
    private queue;
    emailStatus(): Promise<{
        provider: "resend" | "smtp";
        last24h: Record<string, number>;
        last7d: Record<string, number>;
        recentFailures: {
            id: string;
            to: string;
            template: import("@prisma/client").$Enums.EmailTemplate;
            retries: number;
            error: string;
            createdAt: Date;
        }[];
    }>;
    integrations(): Promise<{
        checkedAt: string;
        items: IntegrationCheck[];
    }>;
    private timed;
}
