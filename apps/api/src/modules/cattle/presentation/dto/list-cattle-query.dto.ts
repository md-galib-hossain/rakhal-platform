import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CattleGender, CattlePurpose, CattleStatus } from '@prisma/client';
import { PaginationQueryDto, trimString } from './common.dto';

export class ListCattleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  farmId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsEnum(CattleGender)
  gender?: CattleGender;

  @IsOptional()
  @IsEnum(CattlePurpose)
  purpose?: CattlePurpose;

  @IsOptional()
  @IsEnum(CattleStatus)
  status?: CattleStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;
}
