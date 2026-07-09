import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReconciliationStatus, ReconciliationType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `GET /admin/reconciliation` filters. */
export class ListReconciliationQueryDto {
  @IsOptional()
  @IsIn(Object.values(ReconciliationStatus))
  status?: ReconciliationStatus;

  @IsOptional()
  @IsIn(Object.values(ReconciliationType))
  type?: ReconciliationType;
}

/** `POST /admin/reconciliation/:id/resolve` — clear (RESOLVED) or dismiss (IGNORED). */
export class ResolveReconciliationDto {
  @IsIn([ReconciliationStatus.RESOLVED, ReconciliationStatus.IGNORED])
  status!: ReconciliationStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  note?: string;
}
