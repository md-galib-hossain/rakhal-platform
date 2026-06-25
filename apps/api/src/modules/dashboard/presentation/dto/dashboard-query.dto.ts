import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { trimString } from 'src/common/dto';

export type DashboardPeriod = 'today' | 'week' | 'month';

/** Widget frequency selector (PRD §7.3 — Today / Week / Month). */
export class DashboardPeriodQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsIn(['today', 'week', 'month'])
  period: DashboardPeriod = 'today';
}
