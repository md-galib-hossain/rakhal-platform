import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationStatus, ReconciliationType } from '@prisma/client';
import type { ReconciliationService } from 'src/modules/billing/application/services/reconciliation.service';

/**
 * Documented response shapes for the settlement-reconciliation console (`/admin/reconciliation*`, admin-api,
 * RD-140). Each class mirrors what `ReconciliationService` returns and is pinned to it by a compile-time
 * guard at the bottom of this file. Timestamps are ISO-8601 strings already (the service serialises them).
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** A reconciliation exception (GET list rows; POST :id/resolve). snake_case as the service returns it. */
export class AdminReconciliationExceptionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ReconciliationType, enumName: 'ReconciliationType' })
  type!: ReconciliationType;
  @ApiProperty({ enum: ReconciliationStatus, enumName: 'ReconciliationStatus' })
  status!: ReconciliationStatus;
  @ApiProperty({ type: String, nullable: true }) payment_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) invoice_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) farm_id!: string | null;
  @ApiProperty({ type: String, nullable: true })
  provider_payment_id!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  expected_amount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) actual_amount!: number | null;
  @ApiProperty({ type: String, nullable: true }) detail!: string | null;
  @ApiProperty({ type: String, nullable: true })
  resolved_by_admin_id!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) resolved_at!: string | null;
  @ApiProperty({ type: String, nullable: true })
  resolution_note!: string | null;
  @ApiProperty(DATE_TIME) created_at!: string;
}

/** POST /admin/reconciliation/run. */
export class AdminReconciliationRunResponseDto {
  @ApiProperty() checked!: number;
  @ApiProperty() flagged!: number;
  @ApiProperty({
    required: false,
    description: 'Present when the run was skipped; explains why.',
  })
  skipped?: string;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Rec<K extends keyof ReconciliationService> =
  ReconciliationService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type AdminReconciliationShapeGuards = [
  Assert<Same<Rec<'list'>, AdminReconciliationExceptionDto[]>>,
  Assert<Same<Rec<'runReconciliation'>, AdminReconciliationRunResponseDto>>,
  Assert<Same<Rec<'resolve'>, AdminReconciliationExceptionDto>>,
];
