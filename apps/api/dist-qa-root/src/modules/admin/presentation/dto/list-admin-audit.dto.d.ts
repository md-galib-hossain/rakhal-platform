import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListAdminAuditQueryDto extends CursorPaginationQueryDto {
    adminId?: string;
    action?: string;
}
