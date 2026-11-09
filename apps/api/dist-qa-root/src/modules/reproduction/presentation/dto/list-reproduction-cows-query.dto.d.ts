import { ReproductionState } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListReproductionCowsQueryDto extends CursorPaginationQueryDto {
    status?: ReproductionState;
}
