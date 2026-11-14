import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** Omit to auto-resolve from the caller's memberships: 0 farms → scoped
   * token with `needs_farm`, 1 farm → auto-scoped, 2+ → `farms` list returned
   * for the client to pick, then `POST /auth/refresh {farmId}` (no re-login). */
  @IsOptional()
  @IsString()
  farmId?: string;
}
