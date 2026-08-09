import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { toBoolean } from 'src/common/dto';

/** Query for `GET /feed/ingredients` (RAKHAL-310 — not cursor-paginated, this list is the merged
 * catalogue + farm overrides and stays a plain array response; only the archived-toggle was missing). */
export class ListIngredientsQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
