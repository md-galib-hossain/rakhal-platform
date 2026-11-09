import { MedicineCategory } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export type MedicineListStatus = 'active' | 'expired' | 'expiring_soon';
export declare class ListMedicineQueryDto extends CursorPaginationQueryDto {
    search?: string;
    category?: MedicineCategory;
    status?: MedicineListStatus;
    includeArchived: boolean;
}
