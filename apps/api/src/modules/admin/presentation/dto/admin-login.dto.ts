import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from 'src/common/dto';

export class AdminLoginDto {
  @Transform(trimString)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** Required once 2FA is enabled (RAKHAL-225); omitted on the first-ever login. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit TOTP code' })
  code?: string;
}
