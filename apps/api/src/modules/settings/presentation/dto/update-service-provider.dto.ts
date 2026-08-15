import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ServiceProviderType } from '@prisma/client';
import { toBoolean, trimString } from 'src/common/dto';

/** `PATCH /settings/service-providers/:id`. All fields optional. */
export class UpdateServiceProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimString)
  phone?: string;

  @IsOptional()
  @IsEnum(ServiceProviderType)
  type?: ServiceProviderType;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  is_active?: boolean;
}
