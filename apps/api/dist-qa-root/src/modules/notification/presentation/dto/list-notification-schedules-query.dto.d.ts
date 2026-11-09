import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListNotificationSchedulesQueryDto extends CursorPaginationQueryDto {
    scope: 'mine' | 'farm';
    status?: 'ACTIVE' | 'PAUSED' | 'DONE' | 'CANCELLED';
}
