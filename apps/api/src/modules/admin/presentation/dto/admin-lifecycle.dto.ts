import { PlatformAdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

export class CreateAdminDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(PlatformAdminRole)
  role!: PlatformAdminRole;
}

export class UpdateAdminDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PlatformAdminRole)
  role?: PlatformAdminRole;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  /** Policy (length/classes) is enforced in the service for a clear message. */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  newPassword!: string;
}
