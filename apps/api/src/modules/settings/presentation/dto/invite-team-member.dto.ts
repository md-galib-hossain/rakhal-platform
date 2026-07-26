import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /settings/team/invite` (RAKHAL-030). Delivered by email (no SMS provider
 * is wired — `phone` is optional metadata for a future SMS adapter). */
export class InviteTeamMemberDto {
  @IsEmail()
  @Transform(trimString)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'phone must be a valid Bangladeshi mobile number (01XXXXXXXXX)',
  })
  @Transform(trimString)
  phone?: string;

  /** Role to grant: a system role name (Owner/Manager/Worker) or a farm custom role id. */
  @IsString()
  @MaxLength(60)
  @Transform(trimString)
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  name?: string;
}
