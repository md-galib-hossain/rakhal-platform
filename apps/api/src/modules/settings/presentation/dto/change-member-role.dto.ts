import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `PATCH /settings/team/:id/role` (RAKHAL-030 follow-up). */
export class ChangeMemberRoleDto {
  /** A system role name (Owner/Manager/Worker) or a farm custom role id. */
  @IsString()
  @MaxLength(60)
  @Transform(trimString)
  role!: string;
}
