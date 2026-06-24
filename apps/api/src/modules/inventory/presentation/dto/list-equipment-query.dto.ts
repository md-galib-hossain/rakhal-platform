import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { EquipmentType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Query for `GET /inventory/equipment` — cursor-paginated with search + type. */
export class ListEquipmentQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
