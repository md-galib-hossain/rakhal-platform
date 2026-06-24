import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/** Query for `GET /calves` — cursor-paginated, with KPIs attached in `meta`. */
export class ListCalfQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsIn(['newborn', 'young', 'pre_weaning', 'post_weaning'])
  stage?: 'newborn' | 'young' | 'pre_weaning' | 'post_weaning';

  @IsOptional()
  @Transform(trimString)
  @IsIn(['healthy', 'concern'])
  healthStatus?: 'healthy' | 'concern';
}
