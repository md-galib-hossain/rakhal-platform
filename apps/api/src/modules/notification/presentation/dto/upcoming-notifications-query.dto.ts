import { IsIn, IsOptional, Matches } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /notifications/upcoming?from=&to=&cursor=&limit=`: farm-local `YYYY-MM-DD` window, default today..+14 days. */
export class UpcomingNotificationsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /** Soonest first by default. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
