import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { AnimalType } from '../../domain/requirements';

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

/** `GET /feed/requirements` query (PRD §12.4, RAKHAL-081). Either supply `cattleId`
 * (cow-driven — weight/milk-yield auto-derived from real records) or the manual `weightKg`/
 * `milkTargetL` pair (original behavior, for farms without complete cattle/milk data). The two
 * modes are mutually exclusive-by-convention, not enforced at the DTO level (the service falls
 * back to manual fields when cattle data is incomplete, so a farm can supply both as a safety net). */
export class FeedRequirementsQueryDto {
  @IsOptional()
  @IsString()
  cattleId?: string;

  /** RAKHAL-454 — batch mode: comma-separated cattle ids (`?cattleIds=a,b,c`, max 500). Returns one
   * requirement + flags per cow; every manual override above is ignored in this mode. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  cattleIds?: string[];

  /** RAKHAL-454 — batch mode as-of date (YYYY-MM-DD), defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ValidateIf((o: FeedRequirementsQueryDto) => !o.cattleId && !o.cattleIds)
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(2000)
  weightKg?: number;

  @ValidateIf((o: FeedRequirementsQueryDto) => !o.cattleId && !o.cattleIds)
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
