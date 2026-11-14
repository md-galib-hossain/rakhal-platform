import { IsEnum, IsOptional } from 'class-validator';
import { ReproductionState } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /reproduction/cows` — every cow currently in an active reproductive cycle
 * (OPEN / BRED_AWAITING_CONFIRMATION / PREGNANT), replacing the old dashboard-embedded,
 * uncapped `open_cows[]` list. Optional `status` narrows to one of the three. */
export class ListReproductionCowsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(ReproductionState)
  status?: ReproductionState;
}
