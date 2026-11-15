import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';
import { USERNAME_MAX_LENGTH } from '../../domain/username';

/** `PATCH /auth/me/username` (WP5b). Format and reserved-word rules live in `AuthService.updateUsername`
 * so the same rules apply to every caller; the DTO only bounds the input. */
export class UpdateUsernameDto {
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH + 16)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  username!: string;
}
