import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export class CreateFeedGroupDto {
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  /** Refusal-rate target, % of planned kg (2026-08-13, feeding-system upgrade). Per-group,
   * not farm-wide — doc explicitly warns against one universal refusal target. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  refusalTargetPct?: number;
}
