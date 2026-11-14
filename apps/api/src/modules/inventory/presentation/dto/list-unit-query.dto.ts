import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UnitDimension } from '@prisma/client';
import { toBoolean } from 'src/common/dto';

/** `GET /inventory/units` — merged system + farm unit catalog, optionally filtered. */
export class ListUnitQueryDto {
  @IsOptional()
  @IsEnum(UnitDimension)
  dimension?: UnitDimension;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
