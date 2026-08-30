import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReproStepType } from '@prisma/client';
import { trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `POST /reproduction/protocols/apply` — apply a protocol to one or more cows. */
export class ApplyProtocolDto {
  @Transform(trimString)
  @IsString()
  protocolId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  cattleIds!: string[];

  /** Day-0 of the protocol (YYYY-MM-DD); defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;
}

/** `POST /reproduction/protocols/instances/:id/ai` — record the timed AI step done. */
export class RecordAiDto {
  /** Optional semen batch to decrement one straw from (Inventory §15.4). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  semenBatchId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  inseminator?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'aiDate must be YYYY-MM-DD' })
  aiDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  notes?: string;
}

/** `POST /reproduction/protocols/instances/:id/outcome` — record the pregnancy outcome. */
export class RecordOutcomeDto {
  @IsIn(['PREGNANT', 'OPEN', 'PREGNANCY_LOSS'])
  outcome!: 'PREGNANT' | 'OPEN' | 'PREGNANCY_LOSS';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  notes?: string;
}

/** `POST /reproduction/protocols/instances/:id/close` — cancel or fail an instance. */
export class CloseInstanceDto {
  @IsIn(['CANCELLED', 'FAILED'])
  status!: 'CANCELLED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  reason?: string;
}

/** One day-by-day step of a protocol (GnRH/PGF₂α/AI/PD/...), used by
 * `CreateProtocolDto`/`UpdateProtocolDto`'s `steps[]`. Mirrors `ReproProtocolStep`. */
export class ProtocolStepDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  dayNumber!: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsEnum(ReproStepType)
  stepType!: ReproStepType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

/** `POST /reproduction/protocols` — create a farm-owned protocol (RAKHAL-407). */
export class CreateProtocolDto {
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

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProtocolStepDto)
  steps!: ProtocolStepDto[];
}

/** `PATCH /reproduction/protocols/:id` — edit a farm-owned protocol. `steps`, when present,
 * wholesale-replaces the existing step list (delete+recreate — same convention
 * `HealthPlanService#updatePlan` already established for this shape). */
export class UpdateProtocolDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProtocolStepDto)
  steps?: ProtocolStepDto[];
}

/** `GET /reproduction/protocols/instances` — cursor list with filters. */
export class ListInstanceQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  protocolId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsIn([
    'DRAFT',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
  ])
  status?: string;
}
