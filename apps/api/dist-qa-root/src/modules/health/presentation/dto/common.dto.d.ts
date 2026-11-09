import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare const trimString: ({ value }: {
    value: unknown;
}) => unknown;
export declare class HealthListQueryDto extends CursorPaginationQueryDto {
    cattleId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
}
