import { IsIn, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /notifications/schedules?scope=mine|farm&status=&cursor=&limit=` (USER schedules only). */
export class ListNotificationSchedulesQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsIn(['mine', 'farm'])
  scope: 'mine' | 'farm' = 'mine';

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'DONE', 'CANCELLED'])
  status?: 'ACTIVE' | 'PAUSED' | 'DONE' | 'CANCELLED';
}
