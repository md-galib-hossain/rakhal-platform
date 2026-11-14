import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { toBoolean } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from './common.dto';

/** `GET /health/rounds` (RAKHAL-471). Newest round first by default; `sortOrder=asc` is oldest first. */
export class RoundsQueryDto extends CursorPaginationQueryDto {
  /** `RUNNING` = a live open step exists; `FINISHED` = none. Omit for both. */
  @IsOptional()
  @IsIn(['RUNNING', 'FINISHED'])
  status?: 'RUNNING' | 'FINISHED';

  /** The UI's single protocol kind (treatment / prevention / breeding). */
  @IsOptional()
  @IsIn(['TREATMENT', 'PREVENTION', 'BREEDING'])
  kind?: 'TREATMENT' | 'PREVENTION' | 'BREEDING';

  /** Protocol name contains (case-insensitive). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  /** Only rounds of this protocol. */
  @IsOptional()
  @IsString()
  healthPlanId?: string;
}

/** `GET /health/rounds/:roundKey/grid` (RAKHAL-472). Pages by animal (limit ≤100), most urgent animal first. */
export class RoundGridQueryDto extends CursorPaginationQueryDto {
  /** Only animals with a step due today or late. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  dueOnly?: boolean;
}

/** `POST /health/rounds/:roundKey/animals` (RAKHAL-473) — animals to add to a round that already exists. */
export class AddRoundAnimalsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  cattleIds!: string[];
}

/** Body of the undo routes (`POST /health/rounds/:roundKey/cancel`, `POST /health/treatments/:id/void`): why it is undone. */
export class UndoReasonDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;
}
