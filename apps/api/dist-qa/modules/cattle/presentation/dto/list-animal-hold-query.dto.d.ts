import { AnimalHoldType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListAnimalHoldQueryDto extends CursorPaginationQueryDto {
    type?: AnimalHoldType;
    includeReleased: boolean;
}
