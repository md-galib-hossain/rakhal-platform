import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { MedicineCategory } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Expiry-based status filter for the medicine list (PRD/API §11). */
export type MedicineListStatus = 'active' | 'expired' | 'expiring_soon';

/**
 * Query for `GET /inventory/medicines` — cursor-paginated, with search,
 * category, and expiry-status filters.
 */
export class ListMedicineQueryDto extends CursorPaginationQueryDto {
  /** Free-text match on name / manufacturer / batch id. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MedicineCategory)
  category?: MedicineCategory;

  /** active = not yet expired · expired · expiring_soon (≤30 days). */
  @IsOptional()
  @Transform(trimString)
  @IsIn(['active', 'expired', 'expiring_soon'])
  status?: MedicineListStatus;

  /** Include soft-archived medicines (default false). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
