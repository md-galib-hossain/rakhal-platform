import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MilkSession } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** One cow's yield for a session. The tank is derived server-side (withholding is locked). */
export class MilkLogEntryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(100, { message: 'yieldL must not exceed 100 L per session' })
  yieldL!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  anomalyNote?: string;

  /** Specific `MilkTank` chosen for this cow's collection (header default or a per-row
   * override) — optional; when absent, `submit()` falls back to "first active tank of the
   * matching SELLABLE/WITHHOLDING type" like before this field existed. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  tankId?: string;

  /** Optional note when overwriting a session already `submitted` — the tank
   * balance is reconciled automatically either way, this is just an audit trail. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  editReason?: string;

  /**
   * Offline-sync version check (WP8a, ADR-006). The `updatedAt` of the row this device last saw for
   * (cow, date, session), or `null` when it saw none. When a row exists and is newer than this (or this is
   * `null`), the entry is NOT overwritten and comes back in `conflicts`. Omit the field to keep the plain
   * upsert the web app uses.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  baseUpdatedAt?: string | null;
}

/** `POST /milk/log` — save/update draft entries for a session on a date. */
export class SaveMilkLogDto {
  @IsDateString()
  date!: string;

  @IsEnum(MilkSession)
  session!: MilkSession;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilkLogEntryDto)
  entries!: MilkLogEntryDto[];
}
