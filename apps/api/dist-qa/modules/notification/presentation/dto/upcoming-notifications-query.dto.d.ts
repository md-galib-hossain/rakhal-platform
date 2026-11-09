import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class UpcomingNotificationsQueryDto extends CursorPaginationQueryDto {
    from?: string;
    to?: string;
    sortOrder: 'asc' | 'desc';
}
