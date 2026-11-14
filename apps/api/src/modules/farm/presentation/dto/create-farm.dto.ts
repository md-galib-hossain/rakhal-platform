import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** PRD §5.1 Step 2 — approximate herd-size bands offered in the onboarding wizard. */
export const HERD_SIZE_BANDS = ['10-50', '51-200', '201-500'] as const;

/** Create a farm (the caller becomes its Owner). Tenant context is established by this call. */
export class CreateFarmDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Captured `?ref=<code>` at signup (REF-01, RAKHAL-223). Bound once, permanently. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  division?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  district?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  upazila?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  operationalPurpose?: string;

  /** PRD §5.1 Step 2 — approximate herd size band. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsIn(HERD_SIZE_BANDS)
  herdSizeBand?: string;

  /** Tag/Farm-ID prefix (e.g. "GVD"). Auto-derived from `name` if omitted. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(6)
  @Matches(/^[A-Za-z0-9]+$/)
  cattleIdPrefix?: string;
}
