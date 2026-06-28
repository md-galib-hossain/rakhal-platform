import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /onboarding/accept-invite` (RAKHAL-025). The invite token authorizes the
 * farm + role; the accepting user comes from the JWT. */
export class AcceptInviteDto {
  @IsString()
  @MinLength(8)
  @Transform(trimString)
  token!: string;
}
