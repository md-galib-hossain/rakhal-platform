import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** `GET /notifications?status=unread|all&page=&per_page=` (offset-paged). */
export class ListNotificationQueryDto {
  @IsOptional()
  @IsIn(['unread', 'all'])
  status: 'unread' | 'all' = 'all';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  per_page = 20;
}
