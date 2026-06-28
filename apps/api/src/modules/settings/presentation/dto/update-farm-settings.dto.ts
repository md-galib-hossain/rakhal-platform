import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

export class UpdateFarmSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  farm_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimString)
  division?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimString)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimString)
  upazila?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimString)
  operational_purpose?: string;
}
