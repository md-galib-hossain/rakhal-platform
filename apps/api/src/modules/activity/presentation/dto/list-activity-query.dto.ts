import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';
import { ActivityLogModule } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Query for `GET /activity-log` — cursor-paginated timeline with filters (PRD §19.1). */
export class ListActivityQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(ActivityLogModule)
  module?: ActivityLogModule;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Only entries that changed an AQR score. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  aqrImpactOnly = false;

  /** Only entries with a financial impact. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  financialImpactOnly = false;
}
