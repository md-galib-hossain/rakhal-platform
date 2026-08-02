import { IsIn, IsOptional } from 'class-validator';
import type { WeightHistoryPeriod } from '../../application/services/weight.service';

const PERIODS: WeightHistoryPeriod[] = ['day', 'week', 'month', 'year'];

/** `GET /cattle/:id/weight/history` — day/week/month/year toggle for the Overview weight chart. */
export class WeightHistoryQueryDto {
  @IsOptional()
  @IsIn(PERIODS)
  period?: WeightHistoryPeriod;
}
