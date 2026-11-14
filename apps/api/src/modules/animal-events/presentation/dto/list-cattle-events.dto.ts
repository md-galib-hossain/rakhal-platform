import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const EVENT_GROUPS = [
  'REPRODUCTION',
  'HEALTH',
  'GROWTH',
  'MOVEMENT',
  'OTHER',
] as const;

export class EligibleEventsDto {
  /** Event date to check (ISO); defaults to now. */
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class ListCattleEventsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;

  /** Include VOIDED events (default: hidden). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeVoided?: boolean;

  /** Filter by type group (catalogue `group`). */
  @IsOptional()
  @IsIn(EVENT_GROUPS)
  group?: (typeof EVENT_GROUPS)[number];
}
