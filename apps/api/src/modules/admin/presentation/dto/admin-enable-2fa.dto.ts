import { IsString, Matches } from 'class-validator';

export class AdminEnableTwoFactorDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit TOTP code' })
  code!: string;
}
