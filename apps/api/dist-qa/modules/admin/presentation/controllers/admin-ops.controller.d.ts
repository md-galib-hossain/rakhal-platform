import { AdminOpsService } from '../../application/services/admin-ops.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { RetryJobDto } from '../dto/admin-config.dto';
export declare class AdminOpsController {
    private readonly ops;
    constructor(ops: AdminOpsService);
    queues(): Promise<{
        checkedAt: string;
        queues: {
            name: string;
            paused: boolean;
            counts: {
                [index: string]: number;
            };
        }[];
    }>;
    failed(name: string, limit?: number): Promise<{
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
    retry(admin: CurrentAdminContext, name: string, jobId: string, dto: RetryJobDto): Promise<{
        queue: string;
        jobId: string;
        retried: boolean;
    }>;
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
        items: import("../../application/services/admin-ops.service").IntegrationCheck[];
    }>;
}
