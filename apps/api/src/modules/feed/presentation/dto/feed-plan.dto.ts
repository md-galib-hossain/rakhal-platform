import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FeedPlanKind, FeedPlanLineType, FeedPlanTarget } from '@prisma/client';
import { toBoolean, trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** One plan line (RAKHAL-455). Exactly one of `feedItemId` / `concentrationId`, matching `lineType`
 * (also enforced by a DB CHECK). `kgPerDay` is as-fed kg **per head per day**. */
export class FeedPlanLineDto {
  @IsEnum(FeedPlanLineType)
  lineType!: FeedPlanLineType;

  @ValidateIf((o: FeedPlanLineDto) => o.lineType === 'FEED_ITEM')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  feedItemId?: string;

  @ValidateIf((o: FeedPlanLineDto) => o.lineType === 'PREPARED')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  concentrationId?: string;

  @IsNumber()
  @Min(0.01)
  @Max(500)
  kgPerDay!: number;
}

const MAX_LINES = 30;

/** `POST /feed/plans`. */
export class CreateFeedPlanDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEnum(FeedPlanKind)
  kind?: FeedPlanKind;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Formulation reference ("made for") — which requirement this plan was balanced against. Not
   * feeding logic; the plan reaches the Feeding page only through Apply. At most one of the two. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  madeForCattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  madeForAnimalGroupId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => FeedPlanLineDto)
  lines!: FeedPlanLineDto[];
}

/** `PATCH /feed/plans/:id`. Every field optional and omitted = unchanged. `lines`, when given,
 * **replaces** the whole line set (the editor always submits the full list). */
export class UpdateFeedPlanDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(FeedPlanKind)
  kind?: FeedPlanKind;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  madeForCattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  madeForAnimalGroupId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => FeedPlanLineDto)
  lines?: FeedPlanLineDto[];
}

/** `GET /feed/plans` — cursor-paginated. */
export class ListFeedPlansQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;

  /** Case-insensitive name search. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsEnum(FeedPlanKind)
  kind?: FeedPlanKind;
}

/** `GET /feed/plans/:id/fit?cattleIds=a,b,c[&date=]`. Falls back to the plan's own "made for" cow
 * when `cattleIds` is omitted. */
export class FeedPlanFitQueryDto {
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

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

/** `POST /feed/plans/:id/apply` (RAKHAL-456). `INDIVIDUAL` takes one or many cows (one active
 * assignment per cow), `GROUP` an `AnimalGroup`, `HERD` no ids. Applying replaces the target's active
 * assignment in one transaction. No dates — the owner applies programs by hand (ADR-027 D4). */
export class ApplyFeedPlanDto {
  @IsEnum(FeedPlanTarget)
  targetType!: FeedPlanTarget;

  @ValidateIf((o: ApplyFeedPlanDto) => o.targetType === 'INDIVIDUAL')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  cattleIds?: string[];

  @ValidateIf((o: ApplyFeedPlanDto) => o.targetType === 'GROUP')
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  animalGroupId?: string;
}

/** `DELETE /feed/plans/:id?removeAssignments=true` — the "Remove from all & delete" action. Without it
 * a plan that is applied refuses to be archived (409). */
export class ArchiveFeedPlanQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  removeAssignments = false;
}

/** `GET /feed/plan-assignments` — active and ended, newest first, cursor-paginated. */
export class ListPlanAssignmentsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  animalGroupId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  planId?: string;

  /** Omit for both. */
  @IsOptional()
  @IsIn(['ACTIVE', 'ENDED'])
  status?: 'ACTIVE' | 'ENDED';
}

/** Hand-entered animal figures for the plan editor's requirement scratchpad — same bounds as
 * `GET /feed/requirements`' manual mode. */
export class PreviewManualRequirementDto {
  @IsNumber()
  @Min(1)
  @Max(2000)
  weightKg!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  milkTargetL!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  milkFatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  milkProteinPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(305)
  gestationDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  bcs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999)
  dim?: number;

  @IsOptional()
  @IsIn(['COW', 'HEIFER', 'DRY'])
  animalType?: 'COW' | 'HEIFER' | 'DRY';
}

/**
 * `POST /feed/plans/preview-fit` — "does this plan fit?" for lines that are not saved yet, against ONE animal
 * (`cattleId`) or hand-entered figures (`manual`). Exactly one of the two. Read-only: nothing is created.
 * `lines` may be empty (a blank editor shows the requirement alone).
 */
export class PreviewPlanFitDto {
  @IsArray()
  @ArrayMaxSize(MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => FeedPlanLineDto)
  lines!: FeedPlanLineDto[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreviewManualRequirementDto)
  manual?: PreviewManualRequirementDto;
}
