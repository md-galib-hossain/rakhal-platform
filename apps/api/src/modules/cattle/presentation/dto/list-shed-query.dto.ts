import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto, trimString } from './common.dto';

export class ListShedQueryDto extends PaginationQueryDto {
  @Transform(trimString)
  @IsString()
  farmId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;
}
