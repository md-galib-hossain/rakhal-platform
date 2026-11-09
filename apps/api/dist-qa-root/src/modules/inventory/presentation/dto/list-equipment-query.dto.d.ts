import { EquipmentType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListEquipmentQueryDto extends CursorPaginationQueryDto {
    search?: string;
    type?: EquipmentType;
    includeArchived: boolean;
}
