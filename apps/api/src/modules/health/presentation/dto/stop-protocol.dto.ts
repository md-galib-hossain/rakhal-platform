import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `POST /health/cattle/:cattleId/protocols/stop` — take one animal off one protocol it is running.
 * Exactly one of `healthCaseId` (a treatment protocol running on a sickness case) or `planEnrollmentId` (a preventive /
 * breeding round) is required; the service rejects both-or-neither with a 400.
 */
export class StopCattleProtocolDto {
  @IsOptional()
  @IsString()
  healthCaseId?: string;

  @IsOptional()
  @IsString()
  planEnrollmentId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
