import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
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
