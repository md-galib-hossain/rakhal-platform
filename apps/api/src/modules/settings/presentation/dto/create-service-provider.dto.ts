import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ServiceProviderType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /settings/service-providers`. */
export class CreateServiceProviderDto {
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimString)
  phone?: string;

  @IsEnum(ServiceProviderType)
  type!: ServiceProviderType;
}
