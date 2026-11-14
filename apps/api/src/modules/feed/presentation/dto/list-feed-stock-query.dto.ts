import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { toBoolean } from 'src/common/dto';

/** Query for `GET /feed/stock` (RAKHAL-310 — not cursor-paginated, this list stays a plain array
 * response; only the archived-toggle was missing). */
export class ListFeedStockQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
