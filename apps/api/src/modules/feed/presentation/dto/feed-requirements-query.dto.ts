import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { AnimalType } from '../../domain/requirements';

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

/** `GET /feed/requirements` query (PRD §12.4, RAKHAL-081). Either supply `cattleId`/`feedGroupId`
 * (cow-driven — weight/milk-yield auto-derived from real records) or the manual `weightKg`/
 * `milkTargetL` pair (original behavior, for farms without complete cattle/milk data). The two
 * modes are mutually exclusive-by-convention, not enforced at the DTO level (the service falls
 * back to manual fields when cattle data is incomplete, so a farm can supply both as a safety net). */
export class FeedRequirementsQueryDto {
  @IsOptional()
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsString()
  feedGroupId?: string;

  @ValidateIf((o: FeedRequirementsQueryDto) => !o.cattleId && !o.feedGroupId)
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(2000)
  weightKg?: number;

  @ValidateIf((o: FeedRequirementsQueryDto) => !o.cattleId && !o.feedGroupId)
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(100)
  milkTargetL?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(15)
  milkFatPct?: number;

  /** RAKHAL-258 — v2 requirement-engine inputs, all optional manual overrides (cow/group modes
   * auto-derive these from records where available; see `feed-requirements.service.ts`). */
  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(10)
  milkProteinPct?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(305)
  gestationDays?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(5)
  bcs?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(999)
  dim?: number;

  @IsOptional()
  @IsIn(['COW', 'HEIFER', 'DRY'])
  animalType?: AnimalType;
}
