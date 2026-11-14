import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type ScoreboardScope = 'national' | 'district' | 'division';
export type ScoreboardView = 'star_cows' | 'top_firms';

/** `GET /scoreboard/leaderboard?scope=&view=&page=` — ranked, offset-paged (ranks are absolute). */
export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(['national', 'district', 'division'])
  scope: ScoreboardScope = 'national';

  @IsOptional()
  @IsIn(['star_cows', 'top_firms'])
  view: ScoreboardView = 'star_cows';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  per_page = 50;
}
