"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOpsService = void 0;
exports.maskEmail = maskEmail;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
const outbox_queue_constants_1 = require("src/common/outbox/infrastructure/queue/outbox.queue.constants");
const email_queue_constants_1 = require("src/modules/email/infrastructure/queue/email.queue.constants");
const schedule_queue_port_1 = require("src/modules/notification/application/queue/schedule-queue.port");
const admin_audit_service_1 = require("./admin-audit.service");
const DAY_MS = 24 * 60 * 60 * 1000;
function maskEmail(address) {
    const [local, domain] = address.split('@');
    if (!domain)
        return '***';
    return `${local.slice(0, 1)}***@${domain}`;
}
let AdminOpsService = class AdminOpsService {
    prisma;
    audit;
    redis;
    queues;
    constructor(prisma, audit, redis, outbox, email, notificationOccurrence) {
        this.prisma = prisma;
        this.audit = audit;
        this.redis = redis;
        this.queues = {
            [outbox_queue_constants_1.OUTBOX_QUEUE]: outbox,
            [email_queue_constants_1.EMAIL_QUEUE]: email,
            [schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE]: notificationOccurrence,
        };
    }
    async listQueues() {
        const rows = await Promise.all(Object.entries(this.queues).map(async ([name, queue]) => {
            const [counts, paused] = await Promise.all([
                queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
                queue.isPaused(),
            ]);
            return { name, paused, counts };
        }));
        return { checkedAt: new Date().toISOString(), queues: rows };
    }
    async failedJobs(name, limit = 25) {
        const queue = this.queue(name);
        const jobs = await queue.getFailed(0, Math.min(Math.max(limit, 1), 100) - 1);
        return {
            queue: name,
            jobs: jobs.map((job) => ({
                id: job.id ?? null,
                name: job.name,
                attemptsMade: job.attemptsMade,
                failedReason: (job.failedReason ?? '').slice(0, 300),
                failedAt: job.finishedOn
                    ? new Date(job.finishedOn).toISOString()
                    : null,
                createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
            })),
        };
    }
    async retryJob(actorId, name, jobId, reason) {
        const queue = this.queue(name);
        const job = await queue.getJob(jobId);
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        if ((await job.getState()) !== 'failed') {
            throw new common_1.ConflictException('Only a failed job can be retried');
        }
        const failedReason = (job.failedReason ?? '').slice(0, 300);
        await job.retry('failed');
        await this.audit.record({
            adminId: actorId,
            action: 'QUEUE_JOB_RETRIED',
            entityType: 'QueueJob',
            entityId: `${name}:${jobId}`,
            metadata: { queue: name, jobName: job.name, reason, failedReason },
        });
        return { queue: name, jobId, retried: true };
    }
    queue(name) {
        const queue = this.queues[name];
        if (!queue)
            throw new common_1.NotFoundException('Unknown queue');
        return queue;
    }
    async emailStatus() {
        const now = Date.now();
        const window = async (ms) => {
            const rows = await this.prisma.emailLog.groupBy({
                by: ['status'],
                where: { createdAt: { gte: new Date(now - ms) } },
                _count: { _all: true },
            });
            const out = {
                QUEUED: 0,
                PROCESSING: 0,
                SENT: 0,
                FAILED: 0,
            };
            for (const row of rows)
                out[row.status] = row._count._all;
            return out;
        };
        const [last24h, last7d, failures] = await Promise.all([
            window(DAY_MS),
            window(7 * DAY_MS),
            this.prisma.emailLog.findMany({
                where: { status: 'FAILED' },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    to: true,
                    template: true,
                    retries: true,
                    errorMessage: true,
                    createdAt: true,
                },
            }),
        ]);
        return {
            provider: env_1.env.EMAIL_PROVIDER,
            last24h,
            last7d,
            recentFailures: failures.map((f) => ({
                id: f.id,
                to: maskEmail(f.to),
                template: f.template,
                retries: f.retries,
                error: (f.errorMessage ?? '').slice(0, 200),
                createdAt: f.createdAt,
            })),
        };
    }
    async integrations() {
        const [database, redis] = await Promise.all([
            this.timed('database', 'PostgreSQL', async () => {
                await this.prisma.$queryRaw `SELECT 1`;
            }),
            this.timed('redis', 'Redis', async () => {
                await this.redis.ping();
            }),
        ]);
        const prod = env_1.env.NODE_ENV === 'production';
        const email = env_1.env.EMAIL_PROVIDER === 'resend'
            ? {
                key: 'email',
                label: 'Email (Resend)',
                status: env_1.env.RESEND_API_KEY ? 'ok' : 'not_configured',
                detail: env_1.env.RESEND_API_KEY
                    ? 'API key present'
                    : 'No API key; mail is not delivered',
            }
            : {
                key: 'email',
                label: 'Email (SMTP)',
                status: 'info',
                detail: 'SMTP provider selected; credentials not inspected',
            };
        const r2Complete = !!(env_1.env.R2_ACCOUNT_ID &&
            env_1.env.R2_ACCESS_KEY_ID &&
            env_1.env.R2_SECRET_ACCESS_KEY &&
            env_1.env.R2_BUCKET);
        const storage = env_1.env.STORAGE_PROVIDER === 'r2'
            ? {
                key: 'storage',
                label: 'File storage (R2)',
                status: r2Complete ? 'ok' : 'degraded',
                detail: r2Complete
                    ? 'Credentials complete'
                    : 'R2 credentials incomplete',
            }
            : {
                key: 'storage',
                label: 'File storage (memory)',
                status: prod ? 'degraded' : 'info',
                detail: 'In-memory storage: uploads are lost on restart',
            };
        const bkash = !!(env_1.env.BKASH_APP_KEY &&
            env_1.env.BKASH_APP_SECRET &&
            env_1.env.BKASH_USERNAME &&
            env_1.env.BKASH_PASSWORD);
        const payments = {
            key: 'payments',
            label: 'Payments (bKash)',
            status: bkash ? 'ok' : 'not_configured',
            detail: bkash ? 'Credentials complete' : 'bKash credentials not set',
        };
        const sentry = !!(env_1.env.SENTRY_ENABLED && env_1.env.SENTRY_DSN);
        const telegram = !!env_1.env.TELEGRAM_BOT_TOKEN;
        return {
            checkedAt: new Date().toISOString(),
            items: [
                database,
                redis,
                email,
                storage,
                payments,
                {
                    key: 'sentry',
                    label: 'Error tracking (Sentry)',
                    status: sentry ? 'ok' : 'not_configured',
                    detail: sentry ? 'Enabled' : 'Disabled or no DSN',
                },
                {
                    key: 'telegram',
                    label: 'Telegram notifications',
                    status: telegram ? 'ok' : 'not_configured',
                    detail: telegram ? 'Bot token present' : 'No bot token',
                },
            ],
        };
    }
    async timed(key, label, probe) {
        const started = Date.now();
        try {
            await probe();
            return {
                key,
                label,
                status: 'ok',
                detail: 'Reachable',
                latencyMs: Date.now() - started,
            };
        }
        catch {
            return {
                key,
                label,
                status: 'down',
                detail: 'Probe failed',
                latencyMs: Date.now() - started,
            };
        }
    }
};
exports.AdminOpsService = AdminOpsService;
exports.AdminOpsService = AdminOpsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __param(3, (0, bullmq_1.InjectQueue)(outbox_queue_constants_1.OUTBOX_QUEUE)),
    __param(4, (0, bullmq_1.InjectQueue)(email_queue_constants_1.EMAIL_QUEUE)),
    __param(5, (0, bullmq_1.InjectQueue)(schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        admin_audit_service_1.AdminAuditService, Object, Function, Function, Function])
], AdminOpsService);
//# sourceMappingURL=admin-ops.service.js.map