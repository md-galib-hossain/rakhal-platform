import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * Body of every support action (Phase 4). `reason` goes into the audit trail;
 * `confirm` must equal the target's identifying text (farm name / user email) —
 * checked on the server, so a client bug or a mis-clicked row cannot act on the
 * wrong target.
 */
export class AdminSupportActionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  confirm!: string;
}

export class AdminSendPasswordResetDto extends AdminSupportActionDto {
  /** Also sign the user out everywhere (use when the account may be compromised). */
  @IsOptional()
  @IsBoolean()
  revokeSessions?: boolean;
}
