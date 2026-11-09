import { FarmStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListAdminFarmsQueryDto extends CursorPaginationQueryDto {
    search?: string;
    status?: FarmStatus;
}
export declare class ListAdminUsersQueryDto extends CursorPaginationQueryDto {
    search?: string;
}
