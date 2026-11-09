import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class RoundsQueryDto extends CursorPaginationQueryDto {
    status?: 'RUNNING' | 'FINISHED';
    kind?: 'TREATMENT' | 'PREVENTION' | 'BREEDING';
    search?: string;
    healthPlanId?: string;
}
export declare class RoundGridQueryDto extends CursorPaginationQueryDto {
    dueOnly?: boolean;
}
export declare class AddRoundAnimalsDto {
    cattleIds: string[];
}
export declare class UndoReasonDto {
    reason?: string;
}
