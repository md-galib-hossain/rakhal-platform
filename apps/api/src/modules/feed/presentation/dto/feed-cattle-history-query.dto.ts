import { IsDateString, IsOptional } from 'class-validator';

/** `GET /feed/grid/cattle/:cattleId/history` — one cow's own feeding entries for one exact day;
 * omit `date` to default to today (matches `FeedFeedingGridService#cattleHistory`'s own default). */
export class FeedCattleHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
