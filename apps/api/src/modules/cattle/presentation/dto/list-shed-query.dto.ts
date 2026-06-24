import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

export class ListShedQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
