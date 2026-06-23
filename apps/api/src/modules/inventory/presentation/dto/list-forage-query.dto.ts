import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ForageType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Query for `GET /inventory/forages` — cursor-paginated with search + type. */
export class ListForageQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ForageType)
  type?: ForageType;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
