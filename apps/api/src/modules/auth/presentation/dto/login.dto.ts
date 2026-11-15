import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  /** Legacy field, still what the web sends. Takes precedence over `identifier` when both are present. */
  @ValidateIf((o: LoginDto) => !o.identifier)
  @IsEmail()
  email?: string;

  /** WP5b: an email address or a username (told apart by `@`). Send this or `email`. */
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier?: string;

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
