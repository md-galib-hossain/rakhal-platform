import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { FeedIngredientService } from 'src/modules/feed/application/services/feed-ingredient.service';
import type { FeedIngredientResponseDto } from 'src/modules/feed/presentation/dto/feed-response.dto';
import type { AdminAuditService } from '../../application/services/admin-audit.service';

/**
 * Documented response shapes for the remaining admin-api routes: liveness (`/admin/health`), cron visibility
 * (`/admin/crons`), the audit trail (`/admin/audit`) and the global feed-ingredient catalogue
 * (`/admin/feed-ingredients`, which reuses the farm-side `FeedIngredientResponseDto`) (RD-140). Each class
 * mirrors what the service/controller returns and is pinned to it by a compile-time guard at the bottom of
 * this file. `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** GET /admin/health (public liveness probe). */
export class AdminHealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Always "ok" when reachable.' })
  status!: string;
}

export class AdminCronJobDto {
  @ApiProperty({ description: 'Registered cron job name.' }) name!: string;
  @ApiProperty({ description: 'True while the job is scheduled.' })
  running!: boolean;
  @ApiProperty({
    ...DATE_TIME,
    nullable: true,
    description: 'Next scheduled run (null when the job is not active).',
  })
  next_run!: string | null;
  @ApiProperty({
    ...DATE_TIME,
    nullable: true,
    description: 'Last run on this instance (null if it has not run yet).',
  })
  last_run!: string | null;
}

/** GET /admin/crons. */
export class AdminCronListResponseDto {
  @ApiProperty({ type: () => [AdminCronJobDto] }) crons!: AdminCronJobDto[];
}

/** One immutable audit-trail row (GET /admin/audit, cursor-paginated). */
export class AdminAuditLogDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null for a failed login against an unknown email.',
  })
  adminId!: string | null;
  @ApiProperty({ description: 'An `AdminAuditAction` value (stored as text).' })
  action!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty({ type: String, nullable: true }) entityId!: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Free-form JSON context (any JSON type, or null).',
  })
  metadata!: Prisma.JsonValue | null;
  @ApiProperty({ description: 'SUCCESS or a failure outcome.' })
  outcome!: string;
  @ApiProperty({ type: String, nullable: true }) actorEmail!: string | null;
  @ApiProperty({
    nullable: true,
    description: 'JSON snapshot before the change (any JSON type, or null).',
  })
  before!: Prisma.JsonValue | null;
  @ApiProperty({
    nullable: true,
    description: 'JSON snapshot after the change (any JSON type, or null).',
  })
  after!: Prisma.JsonValue | null;
  @ApiProperty({ type: String, nullable: true }) sessionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) requestId!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Ingr = FeedIngredientService;

export type AdminSystemShapeGuards = [
  Assert<Same<Ret<AdminAuditService, 'list'>, CursorPage<AdminAuditLogDto>>>,
  Assert<Same<Ret<Ingr, 'listCatalogueForAdmin'>, FeedIngredientResponseDto[]>>,
  Assert<
    Same<Ret<Ingr, 'createCatalogueIngredient'>, FeedIngredientResponseDto>
  >,
  Assert<
    Same<Ret<Ingr, 'updateCatalogueIngredient'>, FeedIngredientResponseDto>
  >,
  Assert<
    Same<Ret<Ingr, 'setCatalogueIngredientActive'>, FeedIngredientResponseDto>
  >,
];
