import { IsDateString } from 'class-validator';

/** `GET /feed/grid` — one day's per-cow feeding grid. */
export class FeedGridQueryDto {
  @IsDateString()
  date!: string;
}
