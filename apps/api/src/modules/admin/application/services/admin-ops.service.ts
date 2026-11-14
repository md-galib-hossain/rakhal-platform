import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { env } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import { OUTBOX_QUEUE } from 'src/common/outbox/infrastructure/queue/outbox.queue.constants';
import { EMAIL_QUEUE } from 'src/modules/email/infrastructure/queue/email.queue.constants';
import { NOTIFICATION_OCCURRENCE_QUEUE } from 'src/modules/notification/application/queue/schedule-queue.port';
import { AdminAuditService } from './admin-audit.service';

export type IntegrationStatus =
  | 'ok'
  | 'degraded'
  | 'down'
  | 'not_configured'
  | 'info';

export interface IntegrationCheck {
  key: string;
  label: string;
  status: IntegrationStatus;
  /** Human detail. Never contains a credential, URL with credentials, or any configured value. */
  detail: string;
  latencyMs?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `a***@example.com` — enough to recognise a recipient, not enough to harvest addresses. */
export function maskEmail(address: string): string {
  const [local, domain] = address.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Read-mostly operational visibility for the admin panel (Phase 5): BullMQ queues and failed jobs (with one
 * controlled, audited retry), email delivery status and integration health. Job payloads are never returned
 * (they carry recipients and tokens), and integration checks only say *whether* something is configured.
 */
@Injectable()
export class AdminOpsService {
  private readonly queues: Record<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @InjectQueue(OUTBOX_QUEUE) outbox: Queue,
    @InjectQueue(EMAIL_QUEUE) email: Queue,
    @InjectQueue(NOTIFICATION_OCCURRENCE_QUEUE) notificationOccurrence: Queue,
  ) {
    this.queues = {
      [OUTBOX_QUEUE]: outbox,
      [EMAIL_QUEUE]: email,
      [NOTIFICATION_OCCURRENCE_QUEUE]: notificationOccurrence, // RAKHAL-498
    };
  }

  // --------------------------------------------------------------- queues

  async listQueues() {
    const rows = await Promise.all(
      Object.entries(this.queues).map(async ([name, queue]) => {
        const [counts, paused] = await Promise.all([
          queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'completed',
            'failed',
          ),
          queue.isPaused(),
        ]);
        return { name, paused, counts };
      }),
    );
    return { checkedAt: new Date().toISOString(), queues: rows };
  }

  async failedJobs(name: string, limit = 25) {
    const queue = this.queue(name);
    const jobs = await queue.getFailed(
      0,
      Math.min(Math.max(limit, 1), 100) - 1,
    );
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

  /** Puts one failed job back on the queue. Anything not in the failed state is refused (409). */
  async retryJob(actorId: string, name: string, jobId: string, reason: string) {
    const queue = this.queue(name);
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if ((await job.getState()) !== 'failed') {
      throw new ConflictException('Only a failed job can be retried');
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

  private queue(name: string): Queue {
    const queue = this.queues[name];
    if (!queue) throw new NotFoundException('Unknown queue');
    return queue;
  }

  // ---------------------------------------------------------------- email

  async emailStatus() {
    const now = Date.now();
    const window = async (ms: number) => {
      const rows = await this.prisma.emailLog.groupBy({
        by: ['status'],
        where: { createdAt: { gte: new Date(now - ms) } },
        _count: { _all: true },
      });
      const out: Record<string, number> = {
        QUEUED: 0,
        PROCESSING: 0,
        SENT: 0,
        FAILED: 0,
      };
      for (const row of rows) out[row.status] = row._count._all;
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
      provider: env.EMAIL_PROVIDER,
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

  // --------------------------------------------------------- integrations

  async integrations() {
    const [database, redis] = await Promise.all([
      this.timed('database', 'PostgreSQL', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      this.timed('redis', 'Redis', async () => {
        await this.redis.ping();
      }),
    ]);

    const prod = env.NODE_ENV === 'production';
    const email: IntegrationCheck =
      env.EMAIL_PROVIDER === 'resend'
        ? {
            key: 'email',
            label: 'Email (Resend)',
            status: env.RESEND_API_KEY ? 'ok' : 'not_configured',
            detail: env.RESEND_API_KEY
              ? 'API key present'
              : 'No API key; mail is not delivered',
          }
        : {
            key: 'email',
            label: 'Email (SMTP)',
            status: 'info',
            detail: 'SMTP provider selected; credentials not inspected',
          };

    const r2Complete = !!(
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET
    );
    const storage: IntegrationCheck =
      env.STORAGE_PROVIDER === 'r2'
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

    const bkash = !!(
      env.BKASH_APP_KEY &&
      env.BKASH_APP_SECRET &&
      env.BKASH_USERNAME &&
      env.BKASH_PASSWORD
    );
    const payments: IntegrationCheck = {
      key: 'payments',
      label: 'Payments (bKash)',
      status: bkash ? 'ok' : 'not_configured',
      detail: bkash ? 'Credentials complete' : 'bKash credentials not set',
    };

    const sentry = !!(env.SENTRY_ENABLED && env.SENTRY_DSN);
    const telegram = !!env.TELEGRAM_BOT_TOKEN;

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
        } satisfies IntegrationCheck,
        {
          key: 'telegram',
          label: 'Telegram notifications',
          status: telegram ? 'ok' : 'not_configured',
          detail: telegram ? 'Bot token present' : 'No bot token',
        } satisfies IntegrationCheck,
      ],
    };
  }

  private async timed(
    key: string,
    label: string,
    probe: () => Promise<void>,
  ): Promise<IntegrationCheck> {
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
    } catch {
      return {
        key,
        label,
        status: 'down',
        detail: 'Probe failed',
        latencyMs: Date.now() - started,
      };
    }
  }
}
