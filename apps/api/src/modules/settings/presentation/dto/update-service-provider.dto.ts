import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ServiceProviderType } from '@prisma/client';
import { trimString } from 'src/common/dto';

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

  /** Archive/restore toggle: send `null` to restore, any non-null value to archive
   * (the server always stamps its own `new Date()` — the client's value is never
   * trusted as the actual timestamp). */
  @IsOptional()
  @ValidateIf((o: UpdateServiceProviderDto) => o.deleted_at !== null)
  @IsString()
  deleted_at?: string | null;
}
