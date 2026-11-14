import { ApiProperty } from '@nestjs/swagger';
import { EmailTemplate } from '@prisma/client';
import type {
  AdminOpsService,
  IntegrationStatus,
} from '../../application/services/admin-ops.service';

/**
 * Documented response shapes for admin operations visibility (`/admin/ops/*`, admin-api, RD-140). Each class
 * mirrors what `AdminOpsService` returns and is pinned to it by a compile-time guard at the bottom of this
 * file. `Date` fields are ISO-8601 strings on the wire. Recipient addresses are masked by the service and
 * integration details never carry credentials or configured values.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const COUNT_MAP = {
  type: 'object',
  additionalProperties: { type: 'number' },
} as const;
const INTEGRATION_STATUSES = [
  'ok',
  'degraded',
  'down',
  'not_configured',
  'info',
] as const;

// ─── Queues ─────────────────────────────────────────────────────────────────

export class AdminQueueDto {
  @ApiProperty() name!: string;
  @ApiProperty() paused!: boolean;
  @ApiProperty({
    ...COUNT_MAP,
    description: 'Job counts by state (waiting, active, failed, ...).',
  })
  counts!: Record<string, number>;
}

/** GET /admin/ops/queues. */
export class AdminQueuesResponseDto {
  @ApiProperty(DATE_TIME) checkedAt!: string;
  @ApiProperty({ type: () => [AdminQueueDto] }) queues!: AdminQueueDto[];
}

export class AdminFailedJobDto {
  @ApiProperty({ type: String, nullable: true }) id!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() attemptsMade!: number;
  @ApiProperty() failedReason!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) failedAt!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) createdAt!: string | null;
}

/** GET /admin/ops/queues/:name/failed. */
export class AdminFailedJobsResponseDto {
  @ApiProperty() queue!: string;
  @ApiProperty({ type: () => [AdminFailedJobDto] }) jobs!: AdminFailedJobDto[];
}

/** POST /admin/ops/queues/:name/failed/:jobId/retry. */
export class AdminRetryJobResponseDto {
  @ApiProperty() queue!: string;
  @ApiProperty() jobId!: string;
  @ApiProperty() retried!: boolean;
}

// ─── Email + integrations ───────────────────────────────────────────────────

export class AdminEmailFailureDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Masked recipient address.' }) to!: string;
  @ApiProperty({ enum: EmailTemplate, enumName: 'EmailTemplate' })
  template!: EmailTemplate;
  @ApiProperty() retries!: number;
  @ApiProperty() error!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

/** GET /admin/ops/email-status. */
export class AdminEmailStatusResponseDto {
  @ApiProperty({ enum: ['resend', 'smtp'] }) provider!: 'resend' | 'smtp';
  @ApiProperty({ ...COUNT_MAP, description: 'Email counts by status.' })
  last24h!: Record<string, number>;
  @ApiProperty({ ...COUNT_MAP, description: 'Email counts by status.' })
  last7d!: Record<string, number>;
  @ApiProperty({ type: () => [AdminEmailFailureDto] })
  recentFailures!: AdminEmailFailureDto[];
}

export class AdminIntegrationCheckDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: INTEGRATION_STATUSES }) status!: IntegrationStatus;
  @ApiProperty({
    description:
      'Human detail. Never contains a credential or configured value.',
  })
  detail!: string;
  @ApiProperty({ required: false }) latencyMs?: number;
}

/** GET /admin/ops/integrations. */
export class AdminIntegrationsResponseDto {
  @ApiProperty(DATE_TIME) checkedAt!: string;
  @ApiProperty({ type: () => [AdminIntegrationCheckDto] })
  items!: AdminIntegrationCheckDto[];
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ops<K extends keyof AdminOpsService> = AdminOpsService[K] extends (
  ...args: never[]
) => infer R
  ? Awaited<R>
  : never;

export type AdminOpsShapeGuards = [
  Assert<Same<Ops<'listQueues'>, AdminQueuesResponseDto>>,
  Assert<Same<Ops<'failedJobs'>, AdminFailedJobsResponseDto>>,
  Assert<Same<Ops<'retryJob'>, AdminRetryJobResponseDto>>,
  Assert<Same<Ops<'emailStatus'>, AdminEmailStatusResponseDto>>,
  Assert<Same<Ops<'integrations'>, AdminIntegrationsResponseDto>>,
];
