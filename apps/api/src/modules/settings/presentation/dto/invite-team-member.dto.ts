import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /settings/team/invite` (RAKHAL-030). Phone-first invite (PRD §5/§21.4). */
export class InviteTeamMemberDto {
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'phone must be a valid Bangladeshi mobile number (01XXXXXXXXX)',
  })
  @Transform(trimString)
  phone!: string;

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
